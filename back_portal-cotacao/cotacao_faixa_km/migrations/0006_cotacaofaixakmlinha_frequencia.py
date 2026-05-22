from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cotacao_faixa_km', '0005_rounddescontofaixa_veiculo_ids'),
    ]

    operations = [
        migrations.AddField(
            model_name='cotacaofaixakmlinha',
            name='frequencia',
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text='Frequência de carga (ex.: viagens/mês).',
                max_digits=12,
                null=True,
            ),
        ),
    ]
