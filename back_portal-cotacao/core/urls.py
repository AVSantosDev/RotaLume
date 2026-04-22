
from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from novacotacao.novacotacao_viewsets import(ClienteViewSet, SolicitanteViewSet, VeiculoViewSet, SemireboqueViewSet, IcmsEstadoViewSet,ImpostoViewSet, 
CustoSeguroCargaViewSet, CustoGrisViewSet, CustoDespesaOperacionalViewSet, TabelaPrecoClienteViewSet, RegistroMarkupViewSet)


router = routers.DefaultRouter()
router.register(r'clientes', ClienteViewSet, basename='cliente')
router.register(r'solicitantes', SolicitanteViewSet, basename='solicitante')
router.register(r'veiculos', VeiculoViewSet, basename='veiculo')
router.register(r'semireboques', SemireboqueViewSet, basename='semireboque')
router.register(r'icms', IcmsEstadoViewSet, basename='icms')
router.register(r'impostos', ImpostoViewSet, basename='impostos')
router.register(r'seguros', CustoSeguroCargaViewSet, basename='seguros')
router.register(r'gris', CustoGrisViewSet, basename='gris')
router.register(r'despesas-operacionais', CustoDespesaOperacionalViewSet, basename='despesas')
router.register(r'tabela-preco-clientes', TabelaPrecoClienteViewSet, basename='tabela-preco-clientes')
router.register(r'registros-markup', RegistroMarkupViewSet, basename='registros-markup')

urlpatterns = [
   
    path('admin/', admin.site.urls),
    path('',include(router.urls))
   
    #path('api/', include(router.urls)),
]
