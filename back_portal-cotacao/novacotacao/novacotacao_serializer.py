from rest_framework import serializers
from .models import (
    Cliente, Solicitante, Veiculo, Semireboque)
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
