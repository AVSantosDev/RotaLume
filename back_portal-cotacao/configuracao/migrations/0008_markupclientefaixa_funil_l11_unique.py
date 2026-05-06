# Generated manually: FUNIL pode ser por (K11,L11) ou só por L11 (k11 nulo)

from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0007_markupclientefaixa_funil_kl"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="markupclientefaixa",
            name="uniq_markup_cliente_funil_kl",
        ),
        migrations.AddConstraint(
            model_name="markupclientefaixa",
            constraint=models.UniqueConstraint(
                fields=("nome_cliente", "k11", "l11"),
                condition=Q(tipo="FUNIL", k11__isnull=False),
                name="uniq_markup_cliente_funil_kl",
            ),
        ),
        migrations.AddConstraint(
            model_name="markupclientefaixa",
            constraint=models.UniqueConstraint(
                fields=("nome_cliente", "l11"),
                condition=Q(tipo="FUNIL", k11__isnull=True),
                name="uniq_markup_cliente_funil_l",
            ),
        ),
    ]

