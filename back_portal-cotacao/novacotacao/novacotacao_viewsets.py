from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from novacotacao import novacotacao_serializer
from django.shortcuts import render
from .models import (Cliente, Solicitante, Veiculo, Semireboque)
from .novacotacao_serializer import (ClienteSerializer, SolicitanteSerializer,  VeiculoSerializer, SemireboqueSerializer)
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


