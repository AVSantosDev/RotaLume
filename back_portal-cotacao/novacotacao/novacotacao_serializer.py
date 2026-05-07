from rest_framework import serializers
from .models import (
    Cliente, Solicitante, Veiculo, Semireboque, Cotacao)
class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = '__all__'


class SolicitanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Solicitante
        fields = '__all__'


class VeiculoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Veiculo
        fields = '__all__'


class SemireboqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semireboque
        fields = '__all__'


class CotacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cotacao
        fields = "__all__"
