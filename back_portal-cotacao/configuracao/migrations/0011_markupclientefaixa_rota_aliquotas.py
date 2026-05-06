# Generated manually: adiciona alíquotas (bruta/reduzida) ao MarkupClienteFaixa

from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0010_markupclientefaixa_drop_funil_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="markupclientefaixa",
            name="aliquota_bruta",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Alíquota bruta da rota (%). Ex: 12.00",
                max_digits=5,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="markupclientefaixa",
            name="aliquota_reduzida",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Alíquota reduzida usada no cálculo (%). Ex: 9.60",
                max_digits=5,
                null=True,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="markupclientefaixa",
            name="uniq_markup_cliente_pctmarkup",
        ),
        migrations.AddConstraint(
            model_name="markupclientefaixa",
            constraint=models.UniqueConstraint(
                fields=("nome_cliente", "percentual_markup"),
                condition=Q(aliquota_bruta__isnull=True, aliquota_reduzida__isnull=True),
                name="uniq_markup_cliente_pctmarkup",
            ),
        ),
        migrations.AddConstraint(
            model_name="markupclientefaixa",
            constraint=models.UniqueConstraint(
                fields=("nome_cliente", "percentual_markup", "aliquota_bruta", "aliquota_reduzida"),
                condition=Q(aliquota_bruta__isnull=False, aliquota_reduzida__isnull=False),
                name="uniq_markup_cliente_lair_rota",
            ),
        ),
    ]

