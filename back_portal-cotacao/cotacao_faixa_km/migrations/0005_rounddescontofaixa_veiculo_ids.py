from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cotacao_faixa_km', '0004_cotacaofaixakm_status_cotacao'),
    ]

    operations = [
        migrations.AddField(
            model_name='cotacaofaixakmrounddescontofaixa',
            name='veiculo_ids',
            field=models.JSONField(
                blank=True,
                help_text='Lista de IDs de veículo; null = todos. Lista vazia = não aplica a ninguém (usa só desconto da coluna). Se preenchido, só esses veículos usam o desconto da faixa no lugar do desconto da coluna.',
                null=True,
            ),
        ),
    ]
