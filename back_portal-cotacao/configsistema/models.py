from django.db import models


class QualpConfiguracao(models.Model):
    """
    Configuração única da integração QualP (token e padrões ANTT).
    Tabela legada: configuracao_qualpconfiguracao
    """

    singleton_key = models.CharField(primary_key=True, max_length=40, default='global', editable=False)

    access_token = models.TextField(blank=True, default='', verbose_name='Access-Token QualP')
    api_base_url = models.URLField(
        default='https://api.qualp.com.br',
        max_length=255,
        help_text='URL base da API (geralmente https://api.qualp.com.br)',
    )
    eixos_padrao = models.PositiveSmallIntegerField(default=5)
    tipo_carga_padrao = models.CharField(max_length=48, default='geral')
    tipo_tabela_frete_padrao = models.CharField(max_length=1, default='A')
    retorno_vazio_padrao = models.BooleanField(default=False)
    validade_cache_dias = models.PositiveSmallIntegerField(
        default=30,
        help_text='Dias em que km, pedágio e frete mín. da mesma OD permanecem válidos sem nova chamada à API.',
    )
    auto_consultar_ao_selecionar_veiculo = models.BooleanField(
        default=False,
        help_text='Se ativo, ao trocar o veículo na Nova Cotação o sistema consulta a QualP automaticamente (quando origem/destino já estiverem preenchidos).',
    )
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'configuracao_qualpconfiguracao'
        verbose_name = 'Configuração QualP'
        verbose_name_plural = 'Configuração QualP'

    def save(self, *args, **kwargs):
        if not getattr(self, 'singleton_key', None):
            self.singleton_key = 'global'
        super().save(*args, **kwargs)

    def __str__(self):
        return 'QualP (configuração global)'


class QualpCacheRota(models.Model):
    origem_texto = models.CharField(max_length=512)
    destino_texto = models.CharField(max_length=512)
    freight_type = models.CharField(max_length=1)
    load_type = models.CharField(max_length=48)
    eixos = models.PositiveSmallIntegerField()
    retorno_vazio = models.BooleanField(default=False)
    retroactive_date = models.CharField(max_length=12, blank=True, default='')

    consultado_em = models.DateTimeField()
    valido_ate = models.DateTimeField()

    distancia_km = models.DecimalField(max_digits=12, decimal_places=2)
    pedagio_total = models.DecimalField(max_digits=14, decimal_places=2)
    frete_antt_referencia = models.DecimalField(max_digits=14, decimal_places=2)
    carga_descarga_antt = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    resolucao_antt_nome = models.CharField(max_length=255, blank=True, default='')
    resolucao_antt_url = models.URLField(blank=True, default='', max_length=500)
    id_transacao_qualp = models.BigIntegerField(null=True, blank=True)
    link_site_qualp = models.URLField(blank=True, default='', max_length=500)
    distancia_texto = models.CharField(max_length=64, blank=True, default='')

    class Meta:
        db_table = 'configuracao_qualpcacherota'
        verbose_name = 'Cache QualP (rota)'
        verbose_name_plural = 'Cache QualP (rotas)'
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'origem_texto',
                    'destino_texto',
                    'freight_type',
                    'load_type',
                    'eixos',
                    'retorno_vazio',
                    'retroactive_date',
                ],
                name='uniq_qualp_cache_od_antt',
            )
        ]

    def __str__(self):
        return f'{self.origem_texto} → {self.destino_texto} (até {self.valido_ate:%d/%m/%Y})'


class QualpConsultaHistorico(models.Model):
    criado_em = models.DateTimeField(auto_now_add=True)
    origem_texto = models.CharField(max_length=512)
    destino_texto = models.CharField(max_length=512)
    distancia_km = models.DecimalField(max_digits=12, decimal_places=2)
    pedagio_total = models.DecimalField(max_digits=14, decimal_places=2)
    frete_antt_referencia = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        help_text='freight_cost retornado pela tabela ANTT (piso de referência)',
    )
    carga_descarga_antt = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tabela_antt = models.CharField(max_length=1)
    tipo_carga_antt = models.CharField(max_length=48, blank=True, default='')
    eixos = models.PositiveSmallIntegerField(default=5)
    resolucao_antt_nome = models.CharField(max_length=255, blank=True, default='')
    resolucao_antt_url = models.URLField(blank=True, default='')
    id_transacao_qualp = models.BigIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'configuracao_qualpconsultahistorico'
        verbose_name = 'Histórico consulta QualP'
        verbose_name_plural = 'Históricos consulta QualP'
        ordering = ['-criado_em']

    def __str__(self):
        return f'{self.origem_texto} → {self.destino_texto} ({self.criado_em:%d/%m/%Y %H:%M})'


class PropostaTemplate(models.Model):
    """
    Template global da Proposta Comercial/Técnica (PDF).
    Mantemos simples: campos textuais e contatos, sem editor por arrastar (por enquanto).
    """

    singleton_key = models.CharField(primary_key=True, max_length=40, default='global', editable=False)

    empresa_nome = models.CharField(max_length=120, blank=True, default='ESTRELA DO ORIENTE')
    titulo = models.CharField(max_length=120, blank=True, default='PROPOSTA COMERCIAL')
    email_comercial = models.CharField(max_length=160, blank=True, default='comercial@estrelaoriente.com.br')
    telefone_comercial = models.CharField(max_length=80, blank=True, default='fone/whatsapp: 41 9973-1834')
    logo_data_url = models.TextField(blank=True, default="")

    condicoes_comerciais = models.TextField(
        blank=True,
        default=(
            '* Pedágio incluso no frete\n'
            '* ICMS/ISS não incluso no frete, cobrado conforme legislação vigente\n'
            '* Seguro não incluso no frete - 0,10% sobre o valor da mercadoria\n'
            '* GRIS não incluso no frete - 0,08% sobre o valor da mercadoria\n'
            '* Carga/Descarga não incluso no frete\n'
            '* Custo adicional por Ajudante de R$ 360 acrescido dos impostos conforme legislação vigente\n'
            '* Taxa adicional a partir da 2ª Entrega de R$ 590 acrescido dos impostos conforme legislação vigente\n'
            '* Prazo de Pagamento: 15 dias a partir da emissão do documento fiscal\n'
            '* Cobrança bancária\n'
            '* Devolução da Mercadoria: Será cobrado 100% do Frete Original\n'
            '* Reentrega da Mercadoria: Será cobrado 70% do Frete Original\n'
            '* Transit time: Será sendo realizado de acordo com a Lei nº 13103/2015, que determina o tempo de duração da jornada do motorista.\n'
            '* Tempo de carga: 4 horas\n'
            '* Tempo de descarga: 4 horas\n'
            '* Acima será cobrado diária de R$ 900,00 para 3/4 toco e R$ 1.200,00 para carretas a cada 24 horas + impostos\n'
        ),
    )

    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Template proposta'
        verbose_name_plural = 'Templates proposta'

    def save(self, *args, **kwargs):
        if not getattr(self, 'singleton_key', None):
            self.singleton_key = 'global'
        super().save(*args, **kwargs)

    def __str__(self):
        return 'Template proposta (global)'


class EmailEnvioConfiguracao(models.Model):
    """
    Configuração única para envio de e-mails (SMTP).
    Guardado como singleton (1 linha).
    """

    singleton_key = models.CharField(primary_key=True, max_length=40, default='global', editable=False)

    habilitado = models.BooleanField(default=False)
    modo_envio = models.CharField(
        max_length=10,
        default="AUTH",
        choices=[("AUTH", "AUTH"), ("RELAY", "RELAY")],
        help_text="AUTH = SMTP com usuário/senha. RELAY = sem autenticação (via conector/IP liberado).",
    )
    remetente_nome = models.CharField(max_length=120, blank=True, default="")
    remetente_email = models.CharField(max_length=160, blank=True, default="")

    smtp_host = models.CharField(max_length=255, blank=True, default="")
    smtp_port = models.PositiveSmallIntegerField(default=587)
    smtp_usuario = models.CharField(max_length=255, blank=True, default="")
    smtp_senha = models.TextField(blank=True, default="")
    smtp_use_tls = models.BooleanField(default=True)

    relay_ip_publico = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="IP público de saída do servidor (egress) a ser liberado no conector do Microsoft 365.",
    )

    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuração e-mail (envio)"
        verbose_name_plural = "Configurações e-mail (envio)"

    def save(self, *args, **kwargs):
        if not getattr(self, "singleton_key", None):
            self.singleton_key = "global"
        super().save(*args, **kwargs)

    def __str__(self):
        return "E-mail (configuração global)"
