from django.db import models

# Create your models here.

class IcmsEstado(models.Model):
    
    origem = models.CharField(max_length=2)
    destino = models.CharField(max_length=2)
    aliquota = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        managed = False          
        db_table = 'tabela_icms' 
        ordering = ['origem', 'destino']

    def __str__(self):
        return f"{self.origem} -> {self.destino}: {self.aliquota}%"




class Imposto(models.Model):
    """
    Tabela para armazenar alíquotas de impostos como PIS/COFINS, IR/CSLL e CPRB.
    """
    nome = models.CharField(max_length=50, unique=True)
    aliquota = models.DecimalField(max_digits=5, decimal_places=2) # Ex: 1.65, 34.00

    class Meta:
        verbose_name = "Imposto"
        verbose_name_plural = "Impostos"

    def __str__(self):
        return f"{self.nome}: {self.aliquota}%"


class CustoSeguroCarga(models.Model):
    """
    Taxas de seguro como RCTR-C, RCF-DC e IOF.
    """
    tipo = models.CharField(max_length=50, unique=True) # Ex: RCTR-C, RCF-DC
    taxa = models.DecimalField(max_digits=8, decimal_places=5) # Ex: 0.01200

    class Meta:
        verbose_name = "Custo Seguro Carga"
        verbose_name_plural = "Custos Seguro Carga"

    def __str__(self):
        return f"{self.tipo}: {self.taxa}%"

class CustoGris(models.Model):
    """
    Custos de pesquisas e consultas de gerenciamento de risco.
    """
    CATEGORIA_CHOICES = [
        ('MOTORISTA', 'Pesquisa Motorista'),
        ('VEICULO', 'Pesquisa Veículos/Carreta'),
        ('CONJUNTO', 'Conjunto: Motorista e Veículo'),
        ('GERAL', 'GRIS Geral'),
    ]

    categoria = models.CharField(max_length=20, choices=CATEGORIA_CHOICES)
    descricao = models.CharField(max_length=50) # Ex: Expressa, Normal, Plus, Consulta
    valor = models.DecimalField(max_digits=10, decimal_places=2) # Valor em R$

    class Meta:
        verbose_name = "Custo GRIS"
        verbose_name_plural = "Custos GRIS"

    def __str__(self):
        return f"{self.get_categoria_display()} - {self.descricao}: R$ {self.valor}"


class CustoDespesaOperacional(models.Model):
    """
    Taxas administrativas e custos operacionais diversos (CGO, PAMCARD, etc).
    """
    TIPO_UNIDADE_CHOICES = [
        ('PERCENTUAL', 'Percentual (%)'),
        ('MOEDA', 'Valor Fixo (R$)'),
    ]

    nome = models.CharField(max_length=100) # Ex: CGO, DESP.ADM, PAMCARD R$
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    unidade = models.CharField(max_length=15, choices=TIPO_UNIDADE_CHOICES)

    class Meta:
        verbose_name = "Custo/Despesa Operacional"
        verbose_name_plural = "Custos/Despesas Operacionais"

    def __str__(self):
        sufixo = "%" if self.unidade == 'PERCENTUAL' else "R$"
        return f"{self.nome}: {self.valor} {sufixo}"


class MarkupClienteFaixa(models.Model):
    """
    Configuração de Markup por cliente e faixa/nível.

    Exemplo de uso (tela em formato de matriz):
    - Colunas: clientes
    - Linhas: faixas (níveis)
    - Célula: percentual de markup
    """

    nome_cliente = models.CharField(max_length=100)
    faixa = models.PositiveSmallIntegerField(help_text="Nível/faixa (ex: 1..n)")
    percentual_base = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, help_text="Base (%) usada no divisor do CTRB (ex: 59.23)")
    percentual_markup = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, help_text="Markup/Percentual (%) (ex: 20.00)")

    class Meta:
        verbose_name = "Configuração de Markup"
        verbose_name_plural = "Configurações de Markup"
        ordering = ["nome_cliente", "faixa"]
        constraints = [
            models.UniqueConstraint(fields=["nome_cliente", "faixa"], name="uniq_markup_cliente_faixa")
        ]

    def __str__(self):
        return f"{self.nome_cliente} (faixa {self.faixa}): base {self.percentual_base}% / markup {self.percentual_markup}%"




class RegistroMarkup(models.Model):
    """
    Grava os dados utilizados na calculadora de Markup para cada operação.
    """
    # 1. Identificação
    cliente = models.ForeignKey('novacotacao.Cliente', on_delete=models.CASCADE, verbose_name="Cliente")
    data_calculo = models.DateTimeField(auto_now_add=True)

    # 2. Valores Base (Entradas)
    valor_custo_operacional = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Valor Custo (R$)")
    
    # 3. Percentuais (Configurações aplicadas)
    percentual_lucro = models.DecimalField(max_digits=5, decimal_places=2, verbose_name="Lucro Base (%)")
    
    # 4. Despesas Utilizadas (Financeiro e Pamcard)
    percentual_financeiro = models.DecimalField(max_digits=5, decimal_places=2, verbose_name="Financeiro (%)")
    percentual_pamcard = models.DecimalField(max_digits=5, decimal_places=2, verbose_name="Pamcard (%)")

    # 5. Prazo de Pagamento
    # Aqui gravamos o prazo e o encargo que foi aplicado naquele momento
    prazo_dias = models.IntegerField(verbose_name="Prazo de Pagamento (Dias)")
    percentual_encargo_prazo = models.DecimalField(max_digits=5, decimal_places=2, verbose_name="Encargo Prazo (%)")

    # 6. Resultado Gravado (O valor final que o sistema gerou)
    valor_final_frete = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Preço Final Gerado (R$)")

    class Meta:
        verbose_name = "Registro de Markup"
        verbose_name_plural = "Registros de Markup"
        ordering = ['-data_calculo']

    def __str__(self):
        return f"Cálculo {self.cliente.nome_empresa} - {self.data_calculo.strftime('%d/%m/%Y')}"


class ClienteTaxasConfig(models.Model):
    nome_cliente = models.CharField(max_length=100, unique=True)

    # --- SEGURO ---
    seguro_taxa_1 = models.DecimalField(max_digits=8, decimal_places=5)
    seguro_taxa_2 = models.DecimalField(max_digits=8, decimal_places=5)
    valor_mercadoria_limite = models.DecimalField(max_digits=15, decimal_places=2)

    # --- AJUDANTE ---
    valor_ajudante = models.DecimalField(max_digits=10, decimal_places=2)

    # --- TAXAS ENTREGA ---
    taxa_utilitarios = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    taxa_cavalo_4x2 = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    taxa_truck = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    taxa_toco = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    taxa_3_4 = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    taxa_cavalo_6x2 = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        db_table = 'cliente_taxas_config'
        ordering = ['nome_cliente']

    def __str__(self):
        return self.nome_cliente