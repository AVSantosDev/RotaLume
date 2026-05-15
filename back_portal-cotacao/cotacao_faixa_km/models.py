from django.db import models


class CotacaoFaixaKm(models.Model):
    """Cabeçalho de uma cotação matricial (faixa de km × rotas × veículos)."""

    LAYOUT_MATRIX = 'matrix'
    LAYOUT_PLANILHA = 'planilha'
    LAYOUT_CHOICES = [
        (LAYOUT_MATRIX, 'Matriz'),
        (LAYOUT_PLANILHA, 'Planilha'),
    ]

    cliente = models.ForeignKey(
        'novacotacao.Cliente',
        on_delete=models.PROTECT,
        related_name='cotacoes_faixa_km',
    )
    layout_mode = models.CharField(max_length=20, choices=LAYOUT_CHOICES, default=LAYOUT_MATRIX)
    pct_operacional_frac = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='Legado: divisor operacional (fração 0–1); preferir rounds/markup.',
    )
    arquivo_importado_nome = models.CharField(max_length=255, blank=True, default='')
    status_cotacao = models.CharField(
        max_length=64,
        blank=True,
        default='',
        verbose_name='Status da cotação',
        help_text='Livre para fluxos futuros (ex.: rascunho, enviada, aprovada).',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Cotação faixa KM'
        verbose_name_plural = 'Cotações faixa KM'

    def __str__(self):
        return f'Faixa KM #{self.pk} — {self.cliente_id}'


class CotacaoFaixaKmVeiculo(models.Model):
    """Veículos incluídos na cotação (ordem das colunas)."""

    cotacao = models.ForeignKey(
        CotacaoFaixaKm,
        on_delete=models.CASCADE,
        related_name='veiculos_inclusos',
    )
    ordem = models.PositiveSmallIntegerField(default=0)
    veiculo = models.ForeignKey(
        'novacotacao.Veiculo',
        on_delete=models.PROTECT,
        related_name='cotacoes_faixa_km_uso',
    )
    tipo_veiculo = models.CharField(max_length=255)

    class Meta:
        ordering = ['ordem', 'id']
        constraints = [
            models.UniqueConstraint(fields=['cotacao', 'veiculo'], name='uniq_cotacao_faixa_km_veiculo'),
        ]

    def __str__(self):
        return f'{self.tipo_veiculo} ({self.cotacao_id})'


class CotacaoFaixaKmLinha(models.Model):
    """Uma linha da tabela: combinação UF origem/destino + faixa de distância."""

    cotacao = models.ForeignKey(
        CotacaoFaixaKm,
        on_delete=models.CASCADE,
        related_name='linhas',
    )
    ordem = models.PositiveIntegerField(default=0)
    uf_origem = models.CharField(max_length=2)
    uf_destino = models.CharField(max_length=2)
    faixa_id = models.CharField(max_length=80)
    faixa_label = models.CharField(max_length=160)
    km_representativo = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ['ordem', 'id']

    def __str__(self):
        return f'{self.uf_origem}-{self.uf_destino} — {self.faixa_label}'


class CotacaoFaixaKmCelula(models.Model):
    """Custo (R$/km editável) por veículo em cada linha. Frete KM vem dos rounds."""

    linha = models.ForeignKey(
        CotacaoFaixaKmLinha,
        on_delete=models.CASCADE,
        related_name='celulas',
    )
    veiculo = models.ForeignKey(
        'novacotacao.Veiculo',
        on_delete=models.PROTECT,
    )
    custo = models.DecimalField(max_digits=16, decimal_places=4)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['linha', 'veiculo'], name='uniq_cotacao_faixa_km_celula'),
        ]

    def __str__(self):
        return f'L{self.linha_id} V{self.veiculo_id}'


class CotacaoFaixaKmRound(models.Model):
    """Round de precificação (Frete KM round 1, 2, … em sequência)."""

    cotacao = models.ForeignKey(
        CotacaoFaixaKm,
        on_delete=models.CASCADE,
        related_name='rounds',
    )
    ordem = models.PositiveSmallIntegerField(default=1)
    nome = models.CharField(max_length=80, blank=True, default='')

    class Meta:
        ordering = ['ordem', 'id']
        constraints = [
            models.UniqueConstraint(fields=['cotacao', 'ordem'], name='uniq_cotacao_faixa_km_round_ordem'),
        ]

    def __str__(self):
        return f'Round {self.ordem} ({self.cotacao_id})'


class CotacaoFaixaKmRoundMarkupVeiculo(models.Model):
    """% markup por veículo no round (Frete = custo * (1 + %/100) após descontos)."""

    round = models.ForeignKey(
        CotacaoFaixaKmRound,
        on_delete=models.CASCADE,
        related_name='markup_veiculos',
    )
    veiculo = models.ForeignKey(
        'novacotacao.Veiculo',
        on_delete=models.CASCADE,
    )
    percentual_markup = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['round', 'veiculo'], name='uniq_cfkr_markup_veiculo'),
        ]


class CotacaoFaixaKmRoundMarkupRota(models.Model):
    """Override de % markup por par UF (e opcionalmente por veículo)."""

    round = models.ForeignKey(
        CotacaoFaixaKmRound,
        on_delete=models.CASCADE,
        related_name='markup_rotas',
    )
    uf_origem = models.CharField(max_length=2)
    uf_destino = models.CharField(max_length=2)
    veiculo = models.ForeignKey(
        'novacotacao.Veiculo',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text='Vazio = aplica a todos os veículos nesta rota.',
    )
    percentual_markup = models.DecimalField(max_digits=8, decimal_places=2, default=0)


class CotacaoFaixaKmRoundDescontoFaixa(models.Model):
    """Desconto % aplicado às linhas com esta faixa_id no round (registro explícito)."""

    round = models.ForeignKey(
        CotacaoFaixaKmRound,
        on_delete=models.CASCADE,
        related_name='descontos_faixa',
    )
    faixa_id = models.CharField(max_length=80)
    percentual_desconto = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    veiculo_ids = models.JSONField(
        null=True,
        blank=True,
        help_text='Lista de IDs de veículo; null = todos. Lista vazia = não aplica a ninguém (usa só desconto da coluna). Se preenchido, só esses veículos usam o desconto da faixa no lugar do desconto da coluna.',
    )


class CotacaoFaixaKmRoundDescontoColuna(models.Model):
    """Desconto % na coluna inteira (veículo) no round."""

    round = models.ForeignKey(
        CotacaoFaixaKmRound,
        on_delete=models.CASCADE,
        related_name='descontos_coluna',
    )
    veiculo = models.ForeignKey(
        'novacotacao.Veiculo',
        on_delete=models.CASCADE,
    )
    percentual_desconto = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['round', 'veiculo'], name='uniq_cfkr_desc_coluna'),
        ]
