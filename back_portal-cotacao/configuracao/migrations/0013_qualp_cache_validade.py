from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0012_qualp_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="qualpconfiguracao",
            name="validade_cache_dias",
            field=models.PositiveSmallIntegerField(
                default=30,
                help_text="Dias em que km, pedágio e frete mín. da mesma OD permanecem válidos sem nova chamada à API.",
            ),
        ),
        migrations.CreateModel(
            name="QualpCacheRota",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("origem_texto", models.CharField(max_length=512)),
                ("destino_texto", models.CharField(max_length=512)),
                ("freight_type", models.CharField(max_length=1)),
                ("load_type", models.CharField(max_length=48)),
                ("eixos", models.PositiveSmallIntegerField()),
                ("retorno_vazio", models.BooleanField(default=False)),
                ("retroactive_date", models.CharField(blank=True, default="", max_length=12)),
                ("consultado_em", models.DateTimeField()),
                ("valido_ate", models.DateTimeField()),
                ("distancia_km", models.DecimalField(decimal_places=2, max_digits=12)),
                ("pedagio_total", models.DecimalField(decimal_places=2, max_digits=14)),
                ("frete_antt_referencia", models.DecimalField(decimal_places=2, max_digits=14)),
                ("carga_descarga_antt", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("resolucao_antt_nome", models.CharField(blank=True, default="", max_length=255)),
                ("resolucao_antt_url", models.URLField(blank=True, default="", max_length=500)),
                ("id_transacao_qualp", models.BigIntegerField(blank=True, null=True)),
                ("link_site_qualp", models.URLField(blank=True, default="", max_length=500)),
                ("distancia_texto", models.CharField(blank=True, default="", max_length=64)),
            ],
            options={
                "verbose_name": "Cache QualP (rota)",
                "verbose_name_plural": "Cache QualP (rotas)",
            },
        ),
        migrations.AddConstraint(
            model_name="qualpcacherota",
            constraint=models.UniqueConstraint(
                fields=(
                    "origem_texto",
                    "destino_texto",
                    "freight_type",
                    "load_type",
                    "eixos",
                    "retorno_vazio",
                    "retroactive_date",
                ),
                name="uniq_qualp_cache_od_antt",
            ),
        ),
    ]
