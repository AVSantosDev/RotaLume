from django.db import transaction
from rest_framework import serializers

from novacotacao.models import Cliente, Veiculo

from .models import (
    CotacaoFaixaKm,
    CotacaoFaixaKmVeiculo,
    CotacaoFaixaKmLinha,
    CotacaoFaixaKmCelula,
    CotacaoFaixaKmRound,
    CotacaoFaixaKmRoundMarkupVeiculo,
    CotacaoFaixaKmRoundMarkupRota,
    CotacaoFaixaKmRoundDescontoFaixa,
    CotacaoFaixaKmRoundDescontoColuna,
)
from .services import build_table_payload


class CelulaWriteSerializer(serializers.Serializer):
    veiculo_id = serializers.IntegerField()
    custo = serializers.DecimalField(max_digits=16, decimal_places=4)


class LinhaWriteSerializer(serializers.Serializer):
    ordem = serializers.IntegerField(required=False, default=0)
    uf_origem = serializers.CharField(max_length=2)
    uf_destino = serializers.CharField(max_length=2)
    faixa_id = serializers.CharField(max_length=80)
    faixa_label = serializers.CharField(max_length=160)
    km_representativo = serializers.DecimalField(max_digits=10, decimal_places=2)
    celulas = CelulaWriteSerializer(many=True)


class VeiculoWriteSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    tipo = serializers.CharField(max_length=255, required=False, allow_blank=True)


def _create_rounds(cot, rounds_data, vids):
    for rnd in sorted(rounds_data, key=lambda x: int(x.get('ordem', 1))):
        r = CotacaoFaixaKmRound.objects.create(
            cotacao=cot,
            ordem=int(rnd.get('ordem', 1)),
            nome=str(rnd.get('nome') or '')[:80],
        )
        mvs = rnd.get('markup_veiculos') or [{'veiculo_id': vid, 'percentual_markup': 0} for vid in vids]
        for mv in mvs:
            CotacaoFaixaKmRoundMarkupVeiculo.objects.create(
                round=r,
                veiculo_id=int(mv['veiculo_id']),
                percentual_markup=mv.get('percentual_markup', 0),
            )
        for mr in rnd.get('markup_rotas') or []:
            CotacaoFaixaKmRoundMarkupRota.objects.create(
                round=r,
                uf_origem=str(mr['uf_origem']).upper().strip()[:2],
                uf_destino=str(mr['uf_destino']).upper().strip()[:2],
                veiculo_id=mr.get('veiculo_id'),
                percentual_markup=mr.get('percentual_markup', 0),
            )
        for df in rnd.get('descontos_faixa') or []:
            raw = df.get('veiculo_ids')
            if raw is not None and not isinstance(raw, (list, tuple)):
                raw = None
            v_id_list = None
            if isinstance(raw, (list, tuple)):
                v_id_list = [int(x) for x in raw]
            CotacaoFaixaKmRoundDescontoFaixa.objects.create(
                round=r,
                faixa_id=str(df['faixa_id'])[:80],
                percentual_desconto=df.get('percentual_desconto', 0),
                veiculo_ids=v_id_list,
            )
        for dc in rnd.get('descontos_coluna') or []:
            CotacaoFaixaKmRoundDescontoColuna.objects.create(
                round=r,
                veiculo_id=int(dc['veiculo_id']),
                percentual_desconto=dc.get('percentual_desconto', 0),
            )


class CotacaoFaixaKmCreateSerializer(serializers.Serializer):
    cliente_id = serializers.IntegerField()
    layout_mode = serializers.ChoiceField(choices=['matrix', 'planilha'])
    pct_operacional_frac = serializers.DecimalField(
        max_digits=10, decimal_places=6, required=False, allow_null=True
    )
    arquivo_importado_nome = serializers.CharField(required=False, allow_blank=True, default='')
    status_cotacao = serializers.CharField(max_length=64, required=False, allow_blank=True, default='')
    veiculos = VeiculoWriteSerializer(many=True)
    linhas = LinhaWriteSerializer(many=True)
    rounds = serializers.ListField(child=serializers.DictField(), required=False)

    def validate(self, attrs):
        if not attrs.get('linhas'):
            raise serializers.ValidationError({'linhas': 'Informe ao menos uma linha.'})
        try:
            Cliente.objects.get(pk=attrs['cliente_id'])
        except Cliente.DoesNotExist as e:
            raise serializers.ValidationError({'cliente_id': 'Cliente não encontrado.'}) from e
        vlist = attrs['veiculos']
        ids = [v['id'] for v in vlist]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError({'veiculos': 'IDs de veículo repetidos.'})
        vids = set(ids)
        found = set(Veiculo.objects.filter(pk__in=vids).values_list('pk', flat=True))
        if found != vids:
            raise serializers.ValidationError({'veiculos': 'Um ou mais veículos não existem.'})
        for i, linha in enumerate(attrs['linhas']):
            cids = {c['veiculo_id'] for c in linha['celulas']}
            if cids != vids:
                raise serializers.ValidationError(
                    {'linhas': f'Linha {i}: celulas devem cobrir os mesmos veículos da cotação.'}
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        cliente = Cliente.objects.get(pk=validated_data['cliente_id'])
        cot = CotacaoFaixaKm.objects.create(
            cliente=cliente,
            layout_mode=validated_data['layout_mode'],
            pct_operacional_frac=validated_data.get('pct_operacional_frac'),
            arquivo_importado_nome=validated_data.get('arquivo_importado_nome') or '',
            status_cotacao=str(validated_data.get('status_cotacao') or '')[:64],
        )
        veiculos_map = {v.pk: v for v in Veiculo.objects.filter(pk__in={x['id'] for x in validated_data['veiculos']})}
        vids_ordered = [x['id'] for x in validated_data['veiculos']]
        for ordem, item in enumerate(validated_data['veiculos']):
            v = veiculos_map[item['id']]
            tipo = (item.get('tipo') or '').strip() or v.tipo_veiculo
            CotacaoFaixaKmVeiculo.objects.create(
                cotacao=cot,
                ordem=ordem,
                veiculo=v,
                tipo_veiculo=tipo,
            )
        for linha in validated_data['linhas']:
            ordem_linha = linha['ordem'] if linha.get('ordem') is not None else 0
            ln = CotacaoFaixaKmLinha.objects.create(
                cotacao=cot,
                ordem=int(ordem_linha),
                uf_origem=str(linha['uf_origem']).upper().strip()[:2],
                uf_destino=str(linha['uf_destino']).upper().strip()[:2],
                faixa_id=str(linha['faixa_id'])[:80],
                faixa_label=str(linha['faixa_label'])[:160],
                km_representativo=linha['km_representativo'],
            )
            for c in linha['celulas']:
                CotacaoFaixaKmCelula.objects.create(
                    linha=ln,
                    veiculo_id=c['veiculo_id'],
                    custo=c['custo'],
                )
        rounds_data = validated_data.get('rounds')
        if not rounds_data:
            rounds_data = [
                {
                    'ordem': 1,
                    'nome': 'Frete KM round 1',
                    'markup_veiculos': [{'veiculo_id': vid, 'percentual_markup': 0} for vid in vids_ordered],
                }
            ]
        _create_rounds(cot, rounds_data, vids_ordered)
        return cot


class CelulaPatchSerializer(serializers.Serializer):
    veiculo_id = serializers.IntegerField()
    custo = serializers.DecimalField(max_digits=16, decimal_places=4)


class LinhaPatchSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    celulas = CelulaPatchSerializer(many=True)


class CotacaoFaixaKmUpdateSerializer(serializers.Serializer):
    linhas = LinhaPatchSerializer(many=True)
    rounds = serializers.ListField(child=serializers.DictField())
    status_cotacao = serializers.CharField(max_length=64, required=False, allow_blank=True)

    def validate(self, attrs):
        cot = self.context['cotacao']
        ids = {int(x['id']) for x in attrs['linhas']}
        existing = set(cot.linhas.values_list('id', flat=True))
        if ids != existing:
            raise serializers.ValidationError({'linhas': 'Conjunto de linhas deve corresponder à cotação.'})
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        if 'status_cotacao' in validated_data:
            instance.status_cotacao = str(validated_data.get('status_cotacao') or '')[:64]
            instance.save(update_fields=['status_cotacao'])
        for ln in validated_data['linhas']:
            ln_obj = CotacaoFaixaKmLinha.objects.get(pk=ln['id'], cotacao=instance)
            for c in ln['celulas']:
                CotacaoFaixaKmCelula.objects.filter(linha=ln_obj, veiculo_id=c['veiculo_id']).update(custo=c['custo'])
        instance.rounds.all().delete()
        vids_ordered = list(instance.veiculos_inclusos.order_by('ordem', 'id').values_list('veiculo_id', flat=True))
        _create_rounds(instance, validated_data['rounds'], vids_ordered)
        return instance


class AdicionarVeiculoSerializer(serializers.Serializer):
    veiculo_id = serializers.IntegerField()
    tipo = serializers.CharField(required=False, allow_blank=True, default='')


class AdicionarLinhaSerializer(serializers.Serializer):
    uf_origem = serializers.CharField(max_length=2)
    uf_destino = serializers.CharField(max_length=2)
    faixa_id = serializers.CharField(max_length=80)
    faixa_label = serializers.CharField(max_length=160)
    km_representativo = serializers.DecimalField(max_digits=10, decimal_places=2)
    ordem = serializers.IntegerField(required=False, allow_null=True)
    celulas = CelulaWriteSerializer(many=True, required=False)

    def validate(self, attrs):
        cot = self.context['cotacao']
        vids = set(cot.veiculos_inclusos.order_by('ordem', 'id').values_list('veiculo_id', flat=True))
        if not vids:
            raise serializers.ValidationError('A cotação não possui veículos.')
        cells = attrs.get('celulas')
        if cells is not None:
            cids = {int(c['veiculo_id']) for c in cells}
            if cids != vids:
                raise serializers.ValidationError({'celulas': 'Informe custo para todos os veículos da cotação ou omita celulas.'})
        return attrs


class CotacaoFaixaKmListSerializer(serializers.ModelSerializer):
    cliente_nome = serializers.CharField(source='cliente.nome_empresa', read_only=True)
    linhas_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = CotacaoFaixaKm
        fields = [
            'id',
            'cliente',
            'cliente_nome',
            'layout_mode',
            'created_at',
            'arquivo_importado_nome',
            'linhas_count',
            'status_cotacao',
        ]


class CotacaoFaixaKmDetailSerializer(serializers.ModelSerializer):
    cliente_nome = serializers.CharField(source='cliente.nome_empresa', read_only=True)
    table = serializers.SerializerMethodField()

    class Meta:
        model = CotacaoFaixaKm
        fields = [
            'id',
            'cliente',
            'cliente_nome',
            'layout_mode',
            'pct_operacional_frac',
            'arquivo_importado_nome',
            'status_cotacao',
            'created_at',
            'table',
        ]

    def get_table(self, obj):
        return build_table_payload(obj)


class CotacaoFaixaKmWriteResponseSerializer(serializers.ModelSerializer):
    cliente_nome = serializers.CharField(source='cliente.nome_empresa', read_only=True)
    table = serializers.SerializerMethodField()

    class Meta:
        model = CotacaoFaixaKm
        fields = [
            'id',
            'cliente',
            'cliente_nome',
            'layout_mode',
            'pct_operacional_frac',
            'arquivo_importado_nome',
            'status_cotacao',
            'created_at',
            'table',
        ]

    def get_table(self, obj):
        return build_table_payload(obj)
