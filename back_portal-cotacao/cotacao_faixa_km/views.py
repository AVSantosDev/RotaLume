from django.db import transaction
from django.db.models import Count, Prefetch
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from novacotacao.models import Veiculo

from .models import (
    CotacaoFaixaKm,
    CotacaoFaixaKmVeiculo,
    CotacaoFaixaKmLinha,
    CotacaoFaixaKmCelula,
    CotacaoFaixaKmRound,
)
from .serializers import (
    AdicionarLinhaSerializer,
    AdicionarVeiculoSerializer,
    CotacaoFaixaKmCreateSerializer,
    CotacaoFaixaKmListSerializer,
    CotacaoFaixaKmDetailSerializer,
    CotacaoFaixaKmWriteResponseSerializer,
    CotacaoFaixaKmUpdateSerializer,
)
from .services import append_linha_a_cotacao, append_veiculo_a_cotacao


class CotacaoFaixaKmViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """
    API dedicada à cotação por faixa de KM (dados normalizados em tabelas).
    PUT/PATCH: corpo completo com `linhas` (id + celulas custo) e `rounds`.
    """

    queryset = CotacaoFaixaKm.objects.select_related('cliente').all()

    def get_queryset(self):
        qs = CotacaoFaixaKm.objects.select_related('cliente')
        if self.action == 'list':
            qs = qs.annotate(linhas_count=Count('linhas'))
        if self.action in (
            'retrieve',
            'update',
            'partial_update',
            'adicionar_veiculo',
            'adicionar_linha',
        ):
            round_qs = CotacaoFaixaKmRound.objects.order_by('ordem', 'id').prefetch_related(
                'markup_veiculos',
                'markup_rotas',
                'descontos_faixa',
                'descontos_coluna',
            )
            qs = qs.prefetch_related(
                Prefetch(
                    'veiculos_inclusos',
                    queryset=CotacaoFaixaKmVeiculo.objects.select_related('veiculo').order_by('ordem', 'id'),
                ),
                Prefetch(
                    'linhas',
                    queryset=CotacaoFaixaKmLinha.objects.order_by('ordem', 'id').prefetch_related(
                        Prefetch('celulas', queryset=CotacaoFaixaKmCelula.objects.select_related('veiculo'))
                    ),
                ),
                Prefetch('rounds', queryset=round_qs),
            )
        return qs.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return CotacaoFaixaKmCreateSerializer
        if self.action == 'retrieve':
            return CotacaoFaixaKmDetailSerializer
        return CotacaoFaixaKmListSerializer

    def create(self, request, *args, **kwargs):
        ser = CotacaoFaixaKmCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cot = ser.save()
        cot = self.get_queryset().get(pk=cot.pk)
        out = CotacaoFaixaKmWriteResponseSerializer(cot, context=self.get_serializer_context())
        return Response(out.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        ser = CotacaoFaixaKmUpdateSerializer(data=request.data, context={'cotacao': instance})
        ser.is_valid(raise_exception=True)
        ser.update(instance, ser.validated_data)
        instance.refresh_from_db()
        instance = self.get_queryset().get(pk=instance.pk)
        out = CotacaoFaixaKmWriteResponseSerializer(instance, context=self.get_serializer_context())
        return Response(out.data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def _write_response(self, instance):
        instance = self.get_queryset().get(pk=instance.pk)
        return Response(CotacaoFaixaKmWriteResponseSerializer(instance, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], url_path='adicionar-veiculo')
    @transaction.atomic
    def adicionar_veiculo(self, request, pk=None):
        cot = self.get_object()
        ser = AdicionarVeiculoSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vid = int(ser.validated_data['veiculo_id'])
        try:
            v = Veiculo.objects.get(pk=vid)
        except Veiculo.DoesNotExist:
            return Response({'veiculo_id': 'Veículo não encontrado.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            append_veiculo_a_cotacao(cot, v, tipo_override=ser.validated_data.get('tipo'))
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return self._write_response(cot)

    @action(detail=True, methods=['post'], url_path='adicionar-linha')
    @transaction.atomic
    def adicionar_linha(self, request, pk=None):
        cot = self.get_object()
        ser = AdicionarLinhaSerializer(data=request.data, context={'cotacao': cot})
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            append_linha_a_cotacao(
                cot,
                uf_origem=d['uf_origem'],
                uf_destino=d['uf_destino'],
                faixa_id=d['faixa_id'],
                faixa_label=d['faixa_label'],
                km_representativo=d['km_representativo'],
                ordem=d.get('ordem'),
                celulas=d.get('celulas'),
            )
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return self._write_response(cot)
