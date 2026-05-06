# Generated manually: remove campos FUNIL/tipo de MarkupClienteFaixa

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0009_markupclientefaixa_simplify_columns"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="markupclientefaixa",
            name="uniq_markup_cliente_pctmarkup",
        ),
        migrations.RemoveConstraint(
            model_name="markupclientefaixa",
            name="uniq_markup_cliente_funil_l",
        ),
        migrations.RemoveField(
            model_name="markupclientefaixa",
            name="tipo",
        ),
        migrations.RemoveField(
            model_name="markupclientefaixa",
            name="l11",
        ),
        migrations.RemoveField(
            model_name="markupclientefaixa",
            name="percentual_operacional",
        ),
        migrations.AddConstraint(
            model_name="markupclientefaixa",
            constraint=models.UniqueConstraint(
                fields=("nome_cliente", "percentual_markup"),
                name="uniq_markup_cliente_pctmarkup",
            ),
        ),
    ]

