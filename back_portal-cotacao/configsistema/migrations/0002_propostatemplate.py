from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configsistema", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="PropostaTemplate",
            fields=[
                ("singleton_key", models.CharField(default="global", editable=False, max_length=40, primary_key=True, serialize=False)),
                ("empresa_nome", models.CharField(blank=True, default="ESTRELA DO ORIENTE", max_length=120)),
                ("titulo", models.CharField(blank=True, default="PROPOSTA COMERCIAL", max_length=120)),
                ("email_comercial", models.CharField(blank=True, default="comercial@estrelaoriente.com.br", max_length=160)),
                ("telefone_comercial", models.CharField(blank=True, default="fone/whatsapp: 41 9973-1834", max_length=80)),
                (
                    "condicoes_comerciais",
                    models.TextField(
                        blank=True,
                        default="* Pedágio incluso no frete\n* ICMS/ISS não incluso no frete, cobrado conforme legislação vigente\n* Seguro não incluso no frete - 0,10% sobre o valor da mercadoria\n* GRIS não incluso no frete - 0,08% sobre o valor da mercadoria\n* Carga/Descarga não incluso no frete\n* Custo adicional por Ajudante de R$ 360 acrescido dos impostos conforme legislação vigente\n* Taxa adicional a partir da 2ª Entrega de R$ 590 acrescido dos impostos conforme legislação vigente\n* Prazo de Pagamento: 15 dias a partir da emissão do documento fiscal\n* Cobrança bancária\n* Devolução da Mercadoria: Será cobrado 100% do Frete Original\n* Reentrega da Mercadoria: Será cobrado 70% do Frete Original\n* Transit time: Será sendo realizado de acordo com a Lei nº 13103/2015, que determina o tempo de duração da jornada do motorista.\n* Tempo de carga: 4 horas\n* Tempo de descarga: 4 horas\n* Acima será cobrado diária de R$ 900,00 para 3/4 toco e R$ 1.200,00 para carretas a cada 24 horas + impostos\n",
                    ),
                ),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Template proposta",
                "verbose_name_plural": "Templates proposta",
            },
        ),
    ]

