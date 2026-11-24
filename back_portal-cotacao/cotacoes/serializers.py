from rest_framework import serializers
from novacotacao.models import Cotacao


class CotacaoSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        """
        Frontend pode enviar `null` quando algum Number() vira NaN (JSON.stringify -> null).
        Para campos não-null (ex.: DecimalField com default=0), normalizamos para o default.
        """
        for f in Cotacao._meta.fields:
            name = f.name
            if name not in attrs:
                continue
            v = attrs.get(name)
            if v is None:
                # Decimal/Float/Integer com default -> usa 0
                if isinstance(f, (serializers.DecimalField,)):
                    # não chega aqui (serializers field), mas mantém por segurança
                    attrs[name] = 0
                elif f.get_internal_type() in ("DecimalField", "FloatField", "IntegerField", "BigIntegerField"):
                    if getattr(f, "null", False):
                        continue
                    attrs[name] = 0
                elif f.get_internal_type() in ("CharField", "TextField"):
                    if getattr(f, "null", False):
                        continue
                    attrs[name] = ""
                elif f.get_internal_type() == "BooleanField":
                    attrs[name] = False
        return attrs

    class Meta:
        model = Cotacao
        fields = "__all__"

