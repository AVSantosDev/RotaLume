from django.contrib import admin

from .models import QualpCacheRota, QualpConfiguracao, QualpConsultaHistorico


@admin.register(QualpConfiguracao)
class QualpConfiguracaoAdmin(admin.ModelAdmin):
    list_display = ('singleton_key', 'api_base_url', 'eixos_padrao', 'tipo_tabela_frete_padrao', 'validade_cache_dias', 'atualizado_em')

    def get_readonly_fields(self, request, obj=None):
        return () if request.user.is_superuser else ('access_token',)


@admin.register(QualpConsultaHistorico)
class QualpConsultaHistoricoAdmin(admin.ModelAdmin):
    list_display = ('criado_em', 'origem_texto', 'destino_texto', 'distancia_km', 'pedagio_total', 'frete_antt_referencia', 'tabela_antt')


@admin.register(QualpCacheRota)
class QualpCacheRotaAdmin(admin.ModelAdmin):
    list_display = ('origem_texto', 'destino_texto', 'freight_type', 'eixos', 'consultado_em', 'valido_ate', 'distancia_km')
