from rest_framework import serializers
from .models import (
    Cliente, Solicitante, Veiculo, Semireboque, IcmsEstado, Imposto, 
    CustoSeguroCarga, CustoGris, CustoDespesaOperacional, 
    TabelaPrecoCliente, RegistroMarkup
)
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

class TabelaPrecoClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TabelaPrecoCliente
        fields = '__all__'

class RegistroMarkupSerializer(serializers.ModelSerializer):
    # Mostra o nome do cliente em vez de apenas o ID no GET
    cliente_nome = serializers.ReadOnlyField(source='cliente.nome_cliente')

    class Meta:
        model = RegistroMarkup
        fields = '__all__'