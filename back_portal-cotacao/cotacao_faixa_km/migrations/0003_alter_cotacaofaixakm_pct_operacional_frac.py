from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cotacao_faixa_km', '0002_rounds_markup_descontos_remove_mcp'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cotacaofaixakm',
            name='pct_operacional_frac',
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text='Legado: divisor operacional (fração 0–1); preferir rounds/markup.',
                max_digits=10,
                null=True,
            ),
        ),
    ]
