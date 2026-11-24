from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("novacotacao", "0007_veiculo_taxa_correcao_ctrb"),
    ]

    operations = [
        migrations.AddField(
            model_name="cotacao",
            name="faixa_km_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
