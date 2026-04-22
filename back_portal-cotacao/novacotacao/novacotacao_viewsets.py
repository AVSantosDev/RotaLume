from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from novacotacao import novacotacao_serializer
from django.shortcuts import render
from .models import (Cliente, Solicitante, Veiculo, Semireboque, IcmsEstado,
 Imposto, CustoSeguroCarga, CustoGris,CustoDespesaOperacional, TabelaPrecoCliente,RegistroMarkup)
from .novacotacao_serializer import (ClienteSerializer, SolicitanteSerializer,  VeiculoSerializer, SemireboqueSerializer,
IcmsEstadoSerializer, ImpostoSerializer, CustoSeguroCargaSerializer, CustoGrisSerializer, CustoDespesaOperacionalSerializer, TabelaPrecoClienteSerializer, RegistroMarkupSerializer)
from django.db.models import Q


class ClienteViewSet(viewsets.ModelViewSet):
    serializer_class = ClienteSerializer
    
    def get_queryset(self):
        queryset = Cliente.objects.all()
        termo = self.request.query_params.get('search', None)
        if termo:
            queryset = queryset.filter(
                Q(nome_empresa__icontains=termo) | Q(cnpj__icontains=termo)
            )
        return queryset

class SolicitanteViewSet(viewsets.ModelViewSet):
    serializer_class = SolicitanteSerializer
    queryset = Solicitante.objects.all()

class VeiculoViewSet(viewsets.ModelViewSet):
    queryset = Veiculo.objects.all()
    serializer_class = VeiculoSerializer

class SemireboqueViewSet(viewsets.ModelViewSet):
    queryset = Semireboque.objects.all() 
    serializer_class = SemireboqueSerializer 




class IcmsEstadoViewSet(viewsets.ModelViewSet):
    queryset = IcmsEstado.objects.all()
    serializer_class = IcmsEstadoSerializer
    # Opcional: permitir filtrar por origem/destino na URL
    def get_queryset(self):
        queryset = IcmsEstado.objects.all()
        origem = self.request.query_params.get('origem')
        if origem:
            queryset = queryset.filter(origem=origem.upper())
        return queryset
    
    def create(self, request, *args, **kwargs):
        origem = request.data.get('origem','').upper()
        destino = request.data.get('destino', '').upper()

        if IcmsEstado.objects.filter(origem=origem, destino=destino).exists():
            return Response(
                {"error":f"a Aliquota {origem}-{destino} já está cadastrada"},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        origem = request.data.get('origem','').upper()
        destino = request.data.get('destino', '').upper()
        instance_id = kwargs.get('pk')

        existe_conflito = IcmsEstado.objects.filter(origem=origem, destino=destino).exclude(id=instance_id).exists()
        if existe_conflito:
            return Response(
                {"error": f"Não é possível alterar para {origem}-{destino} pois essa rota já existe."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().update(request, *args, **kwargs)



class ImpostoViewSet(viewsets.ModelViewSet):
    queryset = Imposto.objects.all()
    serializer_class = ImpostoSerializer

class CustoSeguroCargaViewSet(viewsets.ModelViewSet):
    queryset = CustoSeguroCarga.objects.all()
    serializer_class = CustoSeguroCargaSerializer

class CustoGrisViewSet(viewsets.ModelViewSet):
    queryset = CustoGris.objects.all()
    serializer_class = CustoGrisSerializer

class CustoDespesaOperacionalViewSet(viewsets.ModelViewSet):
    queryset = CustoDespesaOperacional.objects.all()
    serializer_class = CustoDespesaOperacionalSerializer

class TabelaPrecoClienteViewSet(viewsets.ModelViewSet):
    queryset = TabelaPrecoCliente.objects.all()
    serializer_class = TabelaPrecoClienteSerializer

class RegistroMarkupViewSet(viewsets.ModelViewSet):
    queryset = RegistroMarkup.objects.all()
    serializer_class = RegistroMarkupSerializer


