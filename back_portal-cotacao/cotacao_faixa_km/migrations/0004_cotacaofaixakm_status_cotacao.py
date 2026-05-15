from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cotacao_faixa_km', '0003_alter_cotacaofaixakm_pct_operacional_frac'),
    ]

    operations = [
        migrations.AddField(
            model_name='cotacaofaixakm',
            name='status_cotacao',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Livre para fluxos futuros (ex.: rascunho, enviada, aprovada).',
                max_length=64,
                verbose_name='Status da cotação',
            ),
        ),
    ]
