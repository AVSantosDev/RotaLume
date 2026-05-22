from decimal import Decimal

from django.db import migrations, models


def copiar_tarifas_para_tabela_a(apps, schema_editor):
    Veiculo = apps.get_model('novacotacao', 'Veiculo')
    VeiculoTarifaAntt = apps.get_model('novacotacao', 'VeiculoTarifaAntt')
    fields = (
        'frete_minimo_ate_50km',
        'tarifa_0_50',
        'tarifa_51_100',
        'tarifa_101_150',
        'tarifa_151_200',
        'tarifa_201_300',
        'tarifa_301_400',
        'tarifa_401_500',
        'tarifa_acima_500',
    )
    for v in Veiculo.objects.all():
        base = {f: getattr(v, f, 0) or Decimal('0') for f in fields}
        for tabela in ('A', 'B', 'C', 'D'):
            data = base if tabela == 'A' else {f: Decimal('0') for f in fields}
            VeiculoTarifaAntt.objects.create(veiculo_id=v.pk, tabela=tabela, **data)


class Migration(migrations.Migration):

    dependencies = [
        ('novacotacao', '0009_veiculo_cc_tabelas_antt'),
    ]

    operations = [
        migrations.CreateModel(
            name='VeiculoTarifaAntt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tabela', models.CharField(choices=[('A', 'Tabela A'), ('B', 'Tabela B'), ('C', 'Tabela C'), ('D', 'Tabela D')], max_length=1)),
                ('frete_minimo_ate_50km', models.DecimalField(decimal_places=2, default=0, max_digits=14, verbose_name='Frete mín. até 50 km (R$)')),
                ('tarifa_0_50', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('tarifa_51_100', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('tarifa_101_150', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('tarifa_151_200', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('tarifa_201_300', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('tarifa_301_400', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('tarifa_401_500', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('tarifa_acima_500', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('veiculo', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='tarifas_antt', to='novacotacao.veiculo')),
            ],
            options={
                'verbose_name': 'Tarifa ANTT do veículo',
                'verbose_name_plural': 'Tarifas ANTT do veículo',
            },
        ),
        migrations.AddConstraint(
            model_name='veiculotarifaantt',
            constraint=models.UniqueConstraint(fields=('veiculo', 'tabela'), name='uniq_veiculo_tarifa_antt'),
        ),
        migrations.RunPython(copiar_tarifas_para_tabela_a, migrations.RunPython.noop),
    ]
