from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cotacao_faixa_km', '0006_cotacaofaixakmlinha_frequencia'),
    ]

    operations = [
        migrations.AddField(
            model_name='cotacaofaixakmcelula',
            name='frequencia',
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text='Frequência de carga deste veículo nesta linha (ex.: viagens/mês).',
                max_digits=12,
                null=True,
            ),
        ),
    ]
