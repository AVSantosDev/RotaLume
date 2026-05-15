
from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from novacotacao.novacotacao_viewsets import (VeiculoViewSet, SemireboqueViewSet)
from cotacoes.viewsets import CotacaoViewSet
from cotacao_faixa_km.views import CotacaoFaixaKmViewSet
from configuracao.configuracao_viewsets import (
    IcmsEstadoViewSet,
    MatrizISSViewSet,
    ImpostoViewSet,
    CustoSeguroCargaViewSet,
    CustoGrisViewSet,
    CustoDespesaOperacionalViewSet,
    RegistroMarkupViewSet,
    ClienteTaxasConfigViewSet,
    MarkupClienteFaixaViewSet,
    ClienteViewSet,
    SolicitanteViewSet,
)
from configsistema.qualp_views import QualpConfigApiView, QualpConsultaApiView
from configsistema.proposta_template_views import PropostaTemplateApiView
from configsistema.email_views import EmailEgressIpApiView, EmailEnvioConfigApiView, EnviarPropostaEmailApiView


router = routers.DefaultRouter()
router.register(r'clientes', ClienteViewSet, basename='cliente')
router.register(r'solicitantes', SolicitanteViewSet, basename='solicitante')
router.register(r'veiculos', VeiculoViewSet, basename='veiculo')
router.register(r'semireboques', SemireboqueViewSet, basename='semireboque')
router.register(r'cotacoes', CotacaoViewSet, basename='cotacoes')
router.register(r'cotacao-faixa-km', CotacaoFaixaKmViewSet, basename='cotacao-faixa-km')
router.register(r'icms', IcmsEstadoViewSet, basename='icms')
router.register(r'matriz-iss', MatrizISSViewSet, basename='matriz-iss')
router.register(r'impostos', ImpostoViewSet, basename='impostos')
router.register(r'seguros', CustoSeguroCargaViewSet, basename='seguros')
router.register(r'gris', CustoGrisViewSet, basename='gris')
router.register(r'despesas-operacionais', CustoDespesaOperacionalViewSet, basename='despesas')
router.register(r'registros-markup', RegistroMarkupViewSet, basename='registros-markup')
router.register(r'cliente-taxas-config',ClienteTaxasConfigViewSet, basename='cliente-taxas-config')
router.register(r'markup-config', MarkupClienteFaixaViewSet, basename='markup-config')


urlpatterns = [
   
    path('admin/', admin.site.urls),
    path('calculadora-frete/', include('calculadora_frete.urls')),
    path('qualp-config/', QualpConfigApiView.as_view(), name='qualp-config'),
    path('qualp/consulta/', QualpConsultaApiView.as_view(), name='qualp-consulta'),
    path('proposta-template/', PropostaTemplateApiView.as_view(), name='proposta-template'),
    path('email-config/', EmailEnvioConfigApiView.as_view(), name='email-config'),
    path('email/egress-ip/', EmailEgressIpApiView.as_view(), name='email-egress-ip'),
    path('email/enviar-proposta/', EnviarPropostaEmailApiView.as_view(), name='email-enviar-proposta'),
    path('',include(router.urls))
   
    #path('api/', include(router.urls)),
]
