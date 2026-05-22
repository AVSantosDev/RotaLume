from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0022_create_tabela_icms_if_missing"),
    ]

    operations = [
        migrations.CreateModel(
            name="Representante",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nome", models.CharField(max_length=255)),
                (
                    "percentual_comissao",
                    models.DecimalField(
                        decimal_places=2,
                        help_text="Percentual de comissão (ex.: 5.00 = 5%).",
                        max_digits=5,
                    ),
                ),
                ("ativo", models.BooleanField(default=True)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Representante",
                "verbose_name_plural": "Representantes",
                "ordering": ["nome"],
            },
        ),
    ]
