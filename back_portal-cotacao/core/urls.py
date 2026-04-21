
from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from novacotacao.novacotacao_viewsets import(ClienteViewSet, SolicitanteViewSet, VeiculoViewSet, SemireboqueViewSet)


router = routers.DefaultRouter()
router.register(r'clientes', ClienteViewSet, basename='cliente')
router.register(r'solicitantes', SolicitanteViewSet, basename='solicitante')
router.register(r'veiculos', VeiculoViewSet, basename='veiculo')
router.register(r'semireboques', SemireboqueViewSet, basename='semireboque')

urlpatterns = [
   
    path('admin/', admin.site.urls),
    path('',include(router.urls))

    #path('api/', include(router.urls)),
]
