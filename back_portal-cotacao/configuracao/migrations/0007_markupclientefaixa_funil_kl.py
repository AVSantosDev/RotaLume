# Generated manually to extend MarkupClienteFaixa (FAIXA + FUNIL K/L)

from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0006_matriziss"),
    ]

    operations = [
        migrations.AddField(
            model_name="markupclientefaixa",
            name="tipo",
            field=models.CharField(
                choices=[("FAIXA", "Faixa (LAIR)"), ("FUNIL", "Funil K11/L11")],
                default="FAIXA",
                help_text="Define se o registro é por faixa (LAIR) ou por combinação K11/L11.",
                max_length=10,
            ),
        ),
        migrations.AlterField(
            model_name="markupclientefaixa",
            name="faixa",
            field=models.PositiveSmallIntegerField(
                blank=True, help_text="Nível/faixa (ex: 1..n)", null=True
            ),
        ),
        migrations.AddField(
            model_name="markupclientefaixa",
            name="k11",
            field=models.DecimalField(
                blank=True, decimal_places=4, max_digits=6, null=True, verbose_name="K11 (fração)"
            ),
        ),
        migrations.AddField(
            model_name="markupclientefaixa",
            name="l11",
            field=models.DecimalField(
                blank=True, decimal_places=4, max_digits=6, null=True, verbose_name="L11 (fração)"
            ),
        ),
        migrations.AddField(
            model_name="markupclientefaixa",
            name="percentual_operacional",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text="Percentual operacional (fração). Ex: 0.5923 = 59,23%.",
                max_digits=7,
                null=True,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="markupclientefaixa",
            name="uniq_markup_cliente_faixa",
        ),
        migrations.AddConstraint(
            model_name="markupclientefaixa",
            constraint=models.UniqueConstraint(
                fields=("nome_cliente", "faixa"),
                condition=Q(tipo="FAIXA"),
                name="uniq_markup_cliente_faixa",
            ),
        ),
        migrations.AddConstraint(
            model_name="markupclientefaixa",
            constraint=models.UniqueConstraint(
                fields=("nome_cliente", "k11", "l11"),
                condition=Q(tipo="FUNIL"),
                name="uniq_markup_cliente_funil_kl",
            ),
        ),
    ]

