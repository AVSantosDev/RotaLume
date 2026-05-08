from django.db import models
from django.utils import timezone
from datetime import timedelta


class Cliente(models.Model):
    id = models.BigAutoField(primary_key=True)
    nome_empresa = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=14)
    endereco = models.CharField(max_length=255)
    cep = models.CharField(max_length=8)
    numero = models.IntegerField( null= True, blank=True)
   
    def __str__(self):
        return self.nome_empresa


class Solicitante(models.Model):
    id= models.BigAutoField(primary_key=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='solicitantes')
    nome = models.CharField(max_length=255)
    email = models.EmailField()
    telefone = models.CharField()

    def __str__(self):
        return f"{self.nome} ({self.cliente.nome_empresa})"



class Veiculo(models.Model):
    id = models.BigAutoField(primary_key=True)
    tipo_veiculo = models.CharField(max_length=255, verbose_name="Tipo de veiculo")
    eixos_veiculo = models.IntegerField()

    frete_minimo_ate_50km = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Frete mínimo até 50 km (R$)",
    )
    tarifa_0_50 = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="0–50 km (R$)"
    )
    tarifa_51_100 = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="51–100 km (R$)"
    )
    tarifa_101_150 = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="101–150 km (R$)"
    )
    tarifa_151_200 = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="151–200 km (R$)"
    )
    tarifa_201_300 = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="201–300 km (R$)"
    )
    tarifa_301_400 = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="301–400 km (R$)"
    )
    tarifa_401_500 = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="401–500 km (R$)"
    )
    tarifa_acima_500 = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="Acima de 500 km (R$)"
    )
    taxa_correcao = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Taxa de correção (R$)",
    )
    ctrb_somar_taxa_correcao = models.BooleanField(
        default=False,
        verbose_name="Somar taxa de correção no CTRB orçado",
    )

    def __str__(self):
        return f"{self.tipo_veiculo} ({self.eixos_veiculo})"




class Semireboque(models.Model):
    id = models.BigAutoField(primary_key=True)
    tipo_semireboque = models.CharField(max_length=255)
    eixos_semireboque = models.IntegerField()

    def __str__(self):
        return f"{self.tipo_semireboque} ({self.eixos_semireboque})"


class Cotacao(models.Model):
    """
    Snapshot completo da cotação para reabrir/visualizar no futuro.
    Guardamos um JSON com todos os dados da tela (form, cálculos, DRE, etc).
    """

    TIPO_CHOICES = [
        ("SPOT", "SPOT"),
        ("DEDICADO", "DEDICADO"),
        ("FAIXA_KM", "FAIXA_KM"),
    ]

    id = models.BigAutoField(primary_key=True)

    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default="SPOT")

    # Metadados para facilitar busca/listagem
    cliente_id = models.BigIntegerField(null=True, blank=True)
    cliente_nome = models.CharField(max_length=255, blank=True, default="")
    cliente_cnpj = models.CharField(max_length=14, blank=True, default="")
    solicitante_nome = models.CharField(max_length=255, blank=True, default="")
    solicitante_email = models.CharField(max_length=255, blank=True, default="")
    solicitante_telefone = models.CharField(max_length=60, blank=True, default="")

    origem = models.CharField(max_length=120, blank=True, default="")
    uf_origem = models.CharField(max_length=2, blank=True, default="")
    destino = models.CharField(max_length=120, blank=True, default="")
    uf_destino = models.CharField(max_length=2, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateTimeField(null=True, blank=True)

    STATUS_AGUARDANDO = "AGUARDANDO_APROVACAO"
    STATUS_APROVADA = "APROVADA"
    STATUS_NAO_APROVADA = "NAO_APROVADA"

    STATUS_CHOICES = [
        (STATUS_AGUARDANDO, "AGUARDANDO APROVAÇÃO"),
        (STATUS_APROVADA, "APROVADA"),
        (STATUS_NAO_APROVADA, "NÃO APROVADA"),
    ]

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_AGUARDANDO)
    motivo_nao_aprovacao = models.TextField(blank=True, default="")
    pdf_path = models.CharField(max_length=500, blank=True, default="")

    # Campos para reabrir a cotação sem JSON snapshot
    observacao = models.TextField(blank=True, default="")
    contratacao = models.CharField(max_length=30, blank=True, default="SPOT")
    tabela_cliente = models.CharField(max_length=120, blank=True, default="")
    tipo_veiculo = models.CharField(max_length=255, blank=True, default="")
    tipo_semireboque = models.CharField(max_length=255, blank=True, default="")

    pedagio_utilizado = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    distancia_km = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    frete_minimo_antt = models.DecimalField(max_digits=20, decimal_places=2, default=0)

    valor_mercadoria = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    taxa_adicional_entrega = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    qtd_ajudante = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    lair_desejada = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    ajuste_comercial_pct = models.DecimalField(max_digits=7, decimal_places=2, default=0)

    aliquota_bruta = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    aliquota_reduzida = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    spot_k11_pct = models.DecimalField(max_digits=7, decimal_places=2, default=0)

    antt_freight_type = models.CharField(max_length=2, blank=True, default="A")
    antt_load_type = models.CharField(max_length=60, blank=True, default="geral")
    antt_empty_return = models.BooleanField(default=False)
    antt_retroactive_date = models.CharField(max_length=20, blank=True, default="")

    # Resumos para listagem rápida
    ctrb_orcado = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    frete_all_in_sicms = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    frete_all_in_cicms = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    frete_all_in_desc = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    lair_pct = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    lair_valor = models.DecimalField(max_digits=20, decimal_places=2, default=0)

    # Composição do frete (S/ICMS)
    frete_peso_sicms = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    seguro_sicms = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    gris_sicms = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    pedagio_sicms = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    outros_sicms = models.DecimalField(max_digits=20, decimal_places=2, default=0)

    # Composição do frete (C/ICMS)
    frete_peso_cicms = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    seguro_cicms = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    gris_cicms = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    pedagio_cicms = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    outros_cicms = models.DecimalField(max_digits=20, decimal_places=2, default=0)

    # DRE (valores)
    dre_rob = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    dre_icms_iss = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    dre_imp_fed = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    dre_credito = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    dre_rol = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    dre_cv = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    dre_cf = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    dre_csp = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    dre_lo = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    dre_desp_fin = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    dre_lair = models.DecimalField(max_digits=20, decimal_places=2, default=0)

    def save(self, *args, **kwargs):
        if not self.valid_until and self.created_at:
            self.valid_until = self.created_at + timedelta(days=30)
        if not self.valid_until and not self.created_at:
            self.valid_until = timezone.now() + timedelta(days=30)
        super().save(*args, **kwargs)

