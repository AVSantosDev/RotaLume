from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configsistema", "0003_propostatemplate_logo"),
    ]

    operations = [
        migrations.AddField(
            model_name="qualpconfiguracao",
            name="auto_consultar_ao_selecionar_veiculo",
            field=models.BooleanField(
                default=False,
                help_text="Se ativo, ao trocar o veículo na Nova Cotação o sistema consulta a QualP automaticamente (quando origem/destino já estiverem preenchidos).",
            ),
        ),
    ]

