from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("novacotacao", "0002_veiculo_faixas_frete"),
    ]

    operations = [
        migrations.CreateModel(
            name="Cotacao",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("tipo", models.CharField(choices=[("SPOT", "SPOT"), ("DEDICADO", "DEDICADO"), ("FAIXA_KM", "FAIXA_KM")], default="SPOT", max_length=20)),
                ("cliente_id", models.BigIntegerField(blank=True, null=True)),
                ("cliente_nome", models.CharField(blank=True, default="", max_length=255)),
                ("cliente_cnpj", models.CharField(blank=True, default="", max_length=14)),
                ("solicitante_nome", models.CharField(blank=True, default="", max_length=255)),
                ("solicitante_email", models.CharField(blank=True, default="", max_length=255)),
                ("solicitante_telefone", models.CharField(blank=True, default="", max_length=60)),
                ("origem", models.CharField(blank=True, default="", max_length=120)),
                ("uf_origem", models.CharField(blank=True, default="", max_length=2)),
                ("destino", models.CharField(blank=True, default="", max_length=120)),
                ("uf_destino", models.CharField(blank=True, default="", max_length=2)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("valid_until", models.DateTimeField(blank=True, null=True)),
                ("snapshot", models.JSONField(default=dict)),
            ],
        ),
    ]

