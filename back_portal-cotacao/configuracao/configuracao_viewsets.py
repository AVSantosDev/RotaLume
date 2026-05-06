from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
# from configuracao import configuracao_serializer
from .models import (IcmsEstado, Imposto, MatrizISS, CustoSeguroCarga, CustoGris, CustoDespesaOperacional, RegistroMarkup, ClienteTaxasConfig, MarkupClienteFaixa)
from .configuracao_serializer import (IcmsEstadoSerializer, ImpostoSerializer, MatrizISSSerializer, CustoSeguroCargaSerializer, CustoGrisSerializer,
    CustoDespesaOperacionalSerializer, RegistroMarkupSerializer, ClienteTaxasConfigSerializer, MarkupClienteFaixaSerializer)
from django.db.models import Q
from decimal import Decimal, InvalidOperation





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


class MatrizISSViewSet(viewsets.ModelViewSet):
    queryset = MatrizISS.objects.all().order_by('cidade')
    serializer_class = MatrizISSSerializer

    def create(self, request, *args, **kwargs):
        cidade = (request.data.get('cidade') or '').strip()
        if not cidade:
            return Response(
                {"error": "Informe o nome da cidade."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if MatrizISS.objects.filter(cidade__iexact=cidade).exists():
            return Response(
                {"error": f"A alíquota de ISS para a cidade «{cidade}» já está cadastrada."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        cidade = (request.data.get('cidade') or '').strip()
        if not cidade:
            return Response(
                {"error": "Informe o nome da cidade."},
                status=status.HTTP_400_BAD_REQUEST
            )
        instance_id = kwargs.get('pk')
        if MatrizISS.objects.filter(cidade__iexact=cidade).exclude(id=instance_id).exists():
            return Response(
                {"error": f"Não é possível alterar para «{cidade}» pois essa cidade já possui registro de ISS."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().update(request, *args, **kwargs)


class ImpostoViewSet(viewsets.ModelViewSet):
    queryset = Imposto.objects.all().order_by("ordem", "nome")
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

class MarkupClienteFaixaViewSet(viewsets.ModelViewSet):
    queryset = MarkupClienteFaixa.objects.all()
    serializer_class = MarkupClienteFaixaSerializer



class RegistroMarkupViewSet(viewsets.ModelViewSet):
    queryset = RegistroMarkup.objects.all()
    serializer_class = RegistroMarkupSerializer


class ClienteTaxasConfigViewSet(viewsets.ModelViewSet):
    queryset = ClienteTaxasConfig.objects.all()
    serializer_class = ClienteTaxasConfigSerializer


