# Generated manually: simplifica MarkupClienteFaixa (remove faixa/k11; unique por C26 e por L11)

from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0008_markupclientefaixa_funil_l11_unique"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="markupclientefaixa",
            name="uniq_markup_cliente_faixa",
        ),
        migrations.RemoveConstraint(
            model_name="markupclientefaixa",
            name="uniq_markup_cliente_funil_kl",
        ),
        migrations.RemoveConstraint(
            model_name="markupclientefaixa",
            name="uniq_markup_cliente_funil_l",
        ),
        migrations.RemoveField(
            model_name="markupclientefaixa",
            name="faixa",
        ),
        migrations.RemoveField(
            model_name="markupclientefaixa",
            name="k11",
        ),
        migrations.AddConstraint(
            model_name="markupclientefaixa",
            constraint=models.UniqueConstraint(
                fields=("nome_cliente", "percentual_markup"),
                condition=Q(tipo="FAIXA"),
                name="uniq_markup_cliente_pctmarkup",
            ),
        ),
        migrations.AddConstraint(
            model_name="markupclientefaixa",
            constraint=models.UniqueConstraint(
                fields=("nome_cliente", "l11"),
                condition=Q(tipo="FUNIL"),
                name="uniq_markup_cliente_funil_l",
            ),
        ),
    ]

