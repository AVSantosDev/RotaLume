from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configsistema", "0004_qualp_auto_consultar_ao_selecionar_veiculo"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailEnvioConfiguracao",
            fields=[
                ("singleton_key", models.CharField(default="global", editable=False, max_length=40, primary_key=True, serialize=False)),
                ("habilitado", models.BooleanField(default=False)),
                ("remetente_nome", models.CharField(blank=True, default="", max_length=120)),
                ("remetente_email", models.CharField(blank=True, default="", max_length=160)),
                ("smtp_host", models.CharField(blank=True, default="", max_length=255)),
                ("smtp_port", models.PositiveSmallIntegerField(default=587)),
                ("smtp_usuario", models.CharField(blank=True, default="", max_length=255)),
                ("smtp_senha", models.TextField(blank=True, default="")),
                ("smtp_use_tls", models.BooleanField(default=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Configuração e-mail (envio)",
                "verbose_name_plural": "Configurações e-mail (envio)",
            },
        ),
    ]

