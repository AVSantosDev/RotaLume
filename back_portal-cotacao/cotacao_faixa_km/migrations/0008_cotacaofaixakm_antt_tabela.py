from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cotacao_faixa_km', '0007_cotacaofaixakmcelula_frequencia'),
    ]

    operations = [
        migrations.AddField(
            model_name='cotacaofaixakm',
            name='antt_tabela',
            field=models.CharField(
                default='A',
                help_text='Tabela de frete mínimo ANTT (A, B, C ou D) usada na formação de custo.',
                max_length=1,
                verbose_name='Tabela ANTT',
            ),
        ),
    ]
