from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("novacotacao", "0005_cotacao_flat_fields_remove_snapshot_uuid"),
    ]

    operations = [
        migrations.AlterField(model_name="cotacao", name="pedagio_utilizado", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="frete_minimo_antt", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="valor_mercadoria", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),

        migrations.AlterField(model_name="cotacao", name="ctrb_orcado", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="frete_all_in_sicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="frete_all_in_cicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="frete_all_in_desc", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="lair_valor", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),

        migrations.AlterField(model_name="cotacao", name="frete_peso_sicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="seguro_sicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="gris_sicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="pedagio_sicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="outros_sicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),

        migrations.AlterField(model_name="cotacao", name="frete_peso_cicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="seguro_cicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="gris_cicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="pedagio_cicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="outros_cicms", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),

        migrations.AlterField(model_name="cotacao", name="dre_rob", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="dre_icms_iss", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="dre_imp_fed", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="dre_credito", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="dre_rol", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="dre_cv", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="dre_cf", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="dre_csp", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="dre_lo", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="dre_desp_fin", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
        migrations.AlterField(model_name="cotacao", name="dre_lair", field=models.DecimalField(decimal_places=2, default=0, max_digits=20)),
    ]

