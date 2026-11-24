from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configsistema", "0005_emailenvio_configuracao"),
    ]

    operations = [
        migrations.AddField(
            model_name="emailenvioconfiguracao",
            name="modo_envio",
            field=models.CharField(
                choices=[("AUTH", "AUTH"), ("RELAY", "RELAY")],
                default="AUTH",
                help_text="AUTH = SMTP com usuário/senha. RELAY = sem autenticação (via conector/IP liberado).",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="emailenvioconfiguracao",
            name="relay_ip_publico",
            field=models.CharField(
                blank=True,
                default="",
                help_text="IP público de saída do servidor (egress) a ser liberado no conector do Microsoft 365.",
                max_length=64,
            ),
        ),
    ]

