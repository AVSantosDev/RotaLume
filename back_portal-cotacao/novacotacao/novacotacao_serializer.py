from decimal import Decimal

from rest_framework import serializers

from .models import Cliente, Solicitante, Veiculo, VeiculoTarifaAntt, Semireboque, Cotacao
from .veiculo_tarifa import ANTT_TABELAS, FRETE_TARIFA_FIELD_NAMES, tarifas_antt_map


def _decimal_from_raw(val):
    if val is None or val == '':
        return Decimal('0')
    if isinstance(val, Decimal):
        return val
    if isinstance(val, (int, float)):
        return Decimal(str(val))
    s = str(val).strip().replace(',', '.')
    try:
        return Decimal(s)
    except Exception:
        return Decimal('0')


def _sync_veiculo_legacy_tarifas(veiculo, row_a):
    """Mantém campos legados no Veículo alinhados à tabela A."""
    if row_a is None:
        return
    for field in FRETE_TARIFA_FIELD_NAMES:
        setattr(veiculo, field, getattr(row_a, field))
    veiculo.save(update_fields=list(FRETE_TARIFA_FIELD_NAMES))


def _upsert_tarifas_antt(veiculo, tarifas_payload):
    if not isinstance(tarifas_payload, dict):
        return
    for tabela in ANTT_TABELAS:
        chunk = tarifas_payload.get(tabela) or tarifas_payload.get(tabela.lower())
        if not isinstance(chunk, dict):
            chunk = {}
        defaults = {f: _decimal_from_raw(chunk.get(f)) for f in FRETE_TARIFA_FIELD_NAMES}
        VeiculoTarifaAntt.objects.update_or_create(
            veiculo=veiculo,
            tabela=tabela,
            defaults=defaults,
        )
    row_a = veiculo.tarifas_antt.filter(tabela='A').first()
    _sync_veiculo_legacy_tarifas(veiculo, row_a)


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = '__all__'


class SolicitanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Solicitante
        fields = '__all__'


class VeiculoSerializer(serializers.ModelSerializer):
    tarifas_antt = serializers.SerializerMethodField()

    class Meta:
        model = Veiculo
        fields = '__all__'

    def get_tarifas_antt(self, obj):
        mapped = tarifas_antt_map(obj)
        out = {}
        for t, data in mapped.items():
            out[t] = {k: str(data.get(k, 0)) for k in FRETE_TARIFA_FIELD_NAMES}
        return out

    def create(self, validated_data):
        tarifas_payload = self.initial_data.get('tarifas_antt')
        veiculo = super().create(validated_data)
        _upsert_tarifas_antt(veiculo, tarifas_payload)
        return veiculo

    def update(self, instance, validated_data):
        tarifas_payload = self.initial_data.get('tarifas_antt')
        veiculo = super().update(instance, validated_data)
        if tarifas_payload is not None:
            _upsert_tarifas_antt(veiculo, tarifas_payload)
        return veiculo


class SemireboqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semireboque
        fields = '__all__'


class CotacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cotacao
        fields = "__all__"
