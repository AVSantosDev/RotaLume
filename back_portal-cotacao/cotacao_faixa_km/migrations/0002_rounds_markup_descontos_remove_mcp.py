# Generated manually

import django.db.models.deletion
from django.db import migrations, models


def seed_round_1(apps, schema_editor):
    CotacaoFaixaKm = apps.get_model('cotacao_faixa_km', 'CotacaoFaixaKm')
    Round = apps.get_model('cotacao_faixa_km', 'CotacaoFaixaKmRound')
    MV = apps.get_model('cotacao_faixa_km', 'CotacaoFaixaKmRoundMarkupVeiculo')
    VeiculoIncluso = apps.get_model('cotacao_faixa_km', 'CotacaoFaixaKmVeiculo')
    for cot in CotacaoFaixaKm.objects.all():
        if Round.objects.filter(cotacao_id=cot.pk).exists():
            continue
        r1 = Round.objects.create(cotacao_id=cot.pk, ordem=1, nome='Round 1')
        for iv in VeiculoIncluso.objects.filter(cotacao_id=cot.pk):
            MV.objects.create(round_id=r1.pk, veiculo_id=iv.veiculo_id, percentual_markup=0)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('cotacao_faixa_km', '0001_initial'),
        ('novacotacao', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CotacaoFaixaKmRound',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ordem', models.PositiveSmallIntegerField(default=1)),
                ('nome', models.CharField(blank=True, default='', max_length=80)),
                ('cotacao', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rounds', to='cotacao_faixa_km.cotacaofaixakm')),
            ],
            options={
                'ordering': ['ordem', 'id'],
            },
        ),
        migrations.CreateModel(
            name='CotacaoFaixaKmRoundDescontoColuna',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('percentual_desconto', models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ('round', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='descontos_coluna', to='cotacao_faixa_km.cotacaofaixakmround')),
                ('veiculo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='novacotacao.veiculo')),
            ],
        ),
        migrations.CreateModel(
            name='CotacaoFaixaKmRoundDescontoFaixa',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('faixa_id', models.CharField(max_length=80)),
                ('percentual_desconto', models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ('round', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='descontos_faixa', to='cotacao_faixa_km.cotacaofaixakmround')),
            ],
        ),
        migrations.CreateModel(
            name='CotacaoFaixaKmRoundMarkupRota',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('uf_origem', models.CharField(max_length=2)),
                ('uf_destino', models.CharField(max_length=2)),
                ('percentual_markup', models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ('round', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='markup_rotas', to='cotacao_faixa_km.cotacaofaixakmround')),
                ('veiculo', models.ForeignKey(blank=True, help_text='Vazio = aplica a todos os veículos nesta rota.', null=True, on_delete=django.db.models.deletion.CASCADE, to='novacotacao.veiculo')),
            ],
        ),
        migrations.CreateModel(
            name='CotacaoFaixaKmRoundMarkupVeiculo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('percentual_markup', models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ('round', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='markup_veiculos', to='cotacao_faixa_km.cotacaofaixakmround')),
                ('veiculo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='novacotacao.veiculo')),
            ],
        ),
        migrations.AddConstraint(
            model_name='cotacaofaixakmround',
            constraint=models.UniqueConstraint(fields=('cotacao', 'ordem'), name='uniq_cotacao_faixa_km_round_ordem'),
        ),
        migrations.AddConstraint(
            model_name='cotacaofaixakmroundmarkupveiculo',
            constraint=models.UniqueConstraint(fields=('round', 'veiculo'), name='uniq_cfkr_markup_veiculo'),
        ),
        migrations.AddConstraint(
            model_name='cotacaofaixakmrounddescontocoluna',
            constraint=models.UniqueConstraint(fields=('round', 'veiculo'), name='uniq_cfkr_desc_coluna'),
        ),
        migrations.RunPython(seed_round_1, noop_reverse),
        migrations.RemoveField(
            model_name='cotacaofaixakmcelula',
            name='mcp',
        ),
    ]
