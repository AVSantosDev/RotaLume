from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("novacotacao", "0004_cotacao_status_pdf_summary_uuid"),
    ]

    operations = [
        migrations.RemoveField(model_name="cotacao", name="public_id"),
        migrations.RemoveField(model_name="cotacao", name="snapshot"),

        migrations.AddField(model_name="cotacao", name="observacao", field=models.TextField(blank=True, default="")),
        migrations.AddField(model_name="cotacao", name="contratacao", field=models.CharField(blank=True, default="SPOT", max_length=30)),
        migrations.AddField(model_name="cotacao", name="tabela_cliente", field=models.CharField(blank=True, default="", max_length=120)),
        migrations.AddField(model_name="cotacao", name="tipo_veiculo", field=models.CharField(blank=True, default="", max_length=255)),
        migrations.AddField(model_name="cotacao", name="tipo_semireboque", field=models.CharField(blank=True, default="", max_length=255)),

        migrations.AddField(model_name="cotacao", name="pedagio_utilizado", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="distancia_km", field=models.DecimalField(decimal_places=2, default=0, max_digits=10)),
        migrations.AddField(model_name="cotacao", name="frete_minimo_antt", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),

        migrations.AddField(model_name="cotacao", name="valor_mercadoria", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="taxa_adicional_entrega", field=models.DecimalField(decimal_places=2, default=0, max_digits=10)),
        migrations.AddField(model_name="cotacao", name="qtd_ajudante", field=models.DecimalField(decimal_places=2, default=0, max_digits=10)),
        migrations.AddField(model_name="cotacao", name="lair_desejada", field=models.DecimalField(decimal_places=2, default=0, max_digits=7)),
        migrations.AddField(model_name="cotacao", name="ajuste_comercial_pct", field=models.DecimalField(decimal_places=2, default=0, max_digits=7)),

        migrations.AddField(model_name="cotacao", name="aliquota_bruta", field=models.DecimalField(decimal_places=2, default=0, max_digits=7)),
        migrations.AddField(model_name="cotacao", name="aliquota_reduzida", field=models.DecimalField(decimal_places=2, default=0, max_digits=7)),
        migrations.AddField(model_name="cotacao", name="spot_k11_pct", field=models.DecimalField(decimal_places=2, default=0, max_digits=7)),

        migrations.AddField(model_name="cotacao", name="antt_freight_type", field=models.CharField(blank=True, default="A", max_length=2)),
        migrations.AddField(model_name="cotacao", name="antt_load_type", field=models.CharField(blank=True, default="geral", max_length=60)),
        migrations.AddField(model_name="cotacao", name="antt_empty_return", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="cotacao", name="antt_retroactive_date", field=models.CharField(blank=True, default="", max_length=20)),

        # composição do frete
        migrations.AddField(model_name="cotacao", name="frete_peso_sicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="seguro_sicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="gris_sicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="pedagio_sicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="outros_sicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),

        migrations.AddField(model_name="cotacao", name="frete_peso_cicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="seguro_cicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="gris_cicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="pedagio_cicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="outros_cicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),

        # DRE
        migrations.AddField(model_name="cotacao", name="dre_rob", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="dre_icms_iss", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="dre_imp_fed", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="dre_credito", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="dre_rol", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="dre_cv", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="dre_cf", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="dre_csp", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="dre_lo", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="dre_desp_fin", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
        migrations.AddField(model_name="cotacao", name="dre_lair", field=models.DecimalField(decimal_places=2, default=0, max_digits=14)),
    ]

