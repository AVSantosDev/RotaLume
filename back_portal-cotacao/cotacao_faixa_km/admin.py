from django.contrib import admin

from .models import (
    CotacaoFaixaKm,
    CotacaoFaixaKmVeiculo,
    CotacaoFaixaKmLinha,
    CotacaoFaixaKmCelula,
    CotacaoFaixaKmRound,
)


@admin.register(CotacaoFaixaKm)
class CotacaoFaixaKmAdmin(admin.ModelAdmin):
    list_display = ('id', 'cliente', 'layout_mode', 'created_at')
    list_filter = ('layout_mode',)


@admin.register(CotacaoFaixaKmVeiculo)
class CotacaoFaixaKmVeiculoAdmin(admin.ModelAdmin):
    list_display = ('id', 'cotacao', 'veiculo', 'ordem')


@admin.register(CotacaoFaixaKmLinha)
class CotacaoFaixaKmLinhaAdmin(admin.ModelAdmin):
    list_display = ('id', 'cotacao', 'uf_origem', 'uf_destino', 'faixa_label', 'ordem')


@admin.register(CotacaoFaixaKmCelula)
class CotacaoFaixaKmCelulaAdmin(admin.ModelAdmin):
    list_display = ('id', 'linha', 'veiculo', 'custo')


@admin.register(CotacaoFaixaKmRound)
class CotacaoFaixaKmRoundAdmin(admin.ModelAdmin):
    list_display = ('id', 'cotacao', 'ordem', 'nome')
