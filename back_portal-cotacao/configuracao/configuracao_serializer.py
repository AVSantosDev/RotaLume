from rest_framework import serializers
from .models import (IcmsEstado, Imposto, 
    CustoSeguroCarga, CustoGris, CustoDespesaOperacional, 
    RegistroMarkup, ClienteTaxasConfig, MarkupClienteFaixa)



class IcmsEstadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = IcmsEstado
        fields='__all__'


class ImpostoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Imposto
        fields = '__all__'

class CustoSeguroCargaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustoSeguroCarga
        fields = '__all__'

class CustoGrisSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustoGris
        fields = '__all__'

class CustoDespesaOperacionalSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustoDespesaOperacional
        fields = '__all__'

class MarkupClienteFaixaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarkupClienteFaixa
        fields = '__all__'



class RegistroMarkupSerializer(serializers.ModelSerializer):
    # Mostra o nome do cliente em vez de apenas o ID no GET
    cliente_nome = serializers.ReadOnlyField(source='cliente.nome_cliente')

    class Meta:
        model = RegistroMarkup
        fields = '__all__'


class ClienteTaxasConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClienteTaxasConfig
        fields = '__all__'