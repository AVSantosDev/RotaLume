from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0011_markupclientefaixa_rota_aliquotas"),
    ]

    operations = [
        migrations.CreateModel(
            name="QualpConfiguracao",
            fields=[
                ("singleton_key", models.CharField(default="global", editable=False, max_length=40, primary_key=True, serialize=False)),
                ("access_token", models.TextField(blank=True, default="", verbose_name="Access-Token QualP")),
                (
                    "api_base_url",
                    models.URLField(
                        default="https://api.qualp.com.br",
                        help_text="URL base da API (geralmente https://api.qualp.com.br)",
                        max_length=255,
                    ),
                ),
                ("eixos_padrao", models.PositiveSmallIntegerField(default=5)),
                ("tipo_carga_padrao", models.CharField(default="geral", max_length=48)),
                ("tipo_tabela_frete_padrao", models.CharField(default="A", max_length=1)),
                ("retorno_vazio_padrao", models.BooleanField(default=False)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Configuração QualP",
                "verbose_name_plural": "Configuração QualP",
            },
        ),
        migrations.CreateModel(
            name="QualpConsultaHistorico",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("origem_texto", models.CharField(max_length=512)),
                ("destino_texto", models.CharField(max_length=512)),
                ("distancia_km", models.DecimalField(decimal_places=2, max_digits=12)),
                ("pedagio_total", models.DecimalField(decimal_places=2, max_digits=14)),
                (
                    "frete_antt_referencia",
                    models.DecimalField(
                        decimal_places=2,
                        help_text="freight_cost retornado pela tabela ANTT (piso de referência)",
                        max_digits=14,
                    ),
                ),
                ("carga_descarga_antt", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("tabela_antt", models.CharField(max_length=1)),
                ("tipo_carga_antt", models.CharField(blank=True, default="", max_length=48)),
                ("eixos", models.PositiveSmallIntegerField(default=5)),
                ("resolucao_antt_nome", models.CharField(blank=True, default="", max_length=255)),
                ("resolucao_antt_url", models.URLField(blank=True, default="")),
                ("id_transacao_qualp", models.BigIntegerField(blank=True, null=True)),
            ],
            options={
                "verbose_name": "Histórico consulta QualP",
                "verbose_name_plural": "Históricos consulta QualP",
                "ordering": ["-criado_em"],
            },
        ),
    ]
