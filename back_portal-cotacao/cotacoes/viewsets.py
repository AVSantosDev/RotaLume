from datetime import timedelta

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from novacotacao.models import Cotacao
from .serializers import CotacaoSerializer


class CotacaoViewSet(viewsets.ModelViewSet):
    queryset = Cotacao.objects.all().order_by("-created_at")
    serializer_class = CotacaoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        tipo = (self.request.query_params.get("tipo") or "").strip().upper()
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs

    @action(detail=True, methods=["post"])
    def clone(self, request, pk=None):
        src = self.get_object()
        cloned = Cotacao.objects.create(
            tipo=src.tipo,
            cliente_id=src.cliente_id,
            cliente_nome=src.cliente_nome,
            cliente_cnpj=src.cliente_cnpj,
            solicitante_nome=src.solicitante_nome,
            solicitante_email=src.solicitante_email,
            solicitante_telefone=src.solicitante_telefone,
            origem=src.origem,
            uf_origem=src.uf_origem,
            destino=src.destino,
            uf_destino=src.uf_destino,
            status=Cotacao.STATUS_AGUARDANDO,
            motivo_nao_aprovacao="",
            pdf_path="",
            observacao=src.observacao,
            contratacao=src.contratacao,
            tabela_cliente=src.tabela_cliente,
            tipo_veiculo=src.tipo_veiculo,
            tipo_semireboque=src.tipo_semireboque,
            pedagio_utilizado=src.pedagio_utilizado,
            distancia_km=src.distancia_km,
            frete_minimo_antt=src.frete_minimo_antt,
            valor_mercadoria=src.valor_mercadoria,
            taxa_adicional_entrega=src.taxa_adicional_entrega,
            qtd_ajudante=src.qtd_ajudante,
            lair_desejada=src.lair_desejada,
            ajuste_comercial_pct=src.ajuste_comercial_pct,
            aliquota_bruta=src.aliquota_bruta,
            aliquota_reduzida=src.aliquota_reduzida,
            spot_k11_pct=src.spot_k11_pct,
            antt_freight_type=src.antt_freight_type,
            antt_load_type=src.antt_load_type,
            antt_empty_return=src.antt_empty_return,
            antt_retroactive_date=src.antt_retroactive_date,
            ctrb_orcado=src.ctrb_orcado,
            frete_all_in_sicms=src.frete_all_in_sicms,
            frete_all_in_cicms=src.frete_all_in_cicms,
            frete_all_in_desc=src.frete_all_in_desc,
            lair_pct=src.lair_pct,
            lair_valor=src.lair_valor,
            frete_peso_sicms=src.frete_peso_sicms,
            seguro_sicms=src.seguro_sicms,
            gris_sicms=src.gris_sicms,
            pedagio_sicms=src.pedagio_sicms,
            outros_sicms=src.outros_sicms,
            frete_peso_cicms=src.frete_peso_cicms,
            seguro_cicms=src.seguro_cicms,
            gris_cicms=src.gris_cicms,
            pedagio_cicms=src.pedagio_cicms,
            outros_cicms=src.outros_cicms,
            dre_rob=src.dre_rob,
            dre_icms_iss=src.dre_icms_iss,
            dre_imp_fed=src.dre_imp_fed,
            dre_credito=src.dre_credito,
            dre_rol=src.dre_rol,
            dre_cv=src.dre_cv,
            dre_cf=src.dre_cf,
            dre_csp=src.dre_csp,
            dre_lo=src.dre_lo,
            dre_desp_fin=src.dre_desp_fin,
            dre_lair=src.dre_lair,
            faixa_km_snapshot=src.faixa_km_snapshot or {},
            valid_until=timezone.now() + timedelta(days=30),
        )
        return Response(CotacaoSerializer(cloned).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def status(self, request, pk=None):
        obj = self.get_object()
        st = (request.data.get("status") or "").strip().upper()
        motivo = (request.data.get("motivo_nao_aprovacao") or "").strip()
        if st not in dict(Cotacao.STATUS_CHOICES).keys():
            return Response({"error": "Status inválido."}, status=status.HTTP_400_BAD_REQUEST)
        obj.status = st
        obj.motivo_nao_aprovacao = motivo if st == Cotacao.STATUS_NAO_APROVADA else ""
        obj.save(update_fields=["status", "motivo_nao_aprovacao"])
        return Response(CotacaoSerializer(obj).data)

