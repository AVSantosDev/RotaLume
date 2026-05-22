from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cotacao_faixa_km', '0008_cotacaofaixakm_antt_tabela'),
    ]

    operations = [
        migrations.AddField(
            model_name='cotacaofaixakmcelula',
            name='km_total',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='KM total do período (editável). Se vazio, usa km representativo × frequência.',
                max_digits=12,
                null=True,
            ),
        ),
    ]
