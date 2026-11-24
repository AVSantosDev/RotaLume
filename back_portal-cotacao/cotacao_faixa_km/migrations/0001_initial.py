# Generated manually

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('novacotacao', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CotacaoFaixaKm',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('layout_mode', models.CharField(choices=[('matrix', 'Matriz'), ('planilha', 'Planilha')], default='matrix', max_length=20)),
                ('pct_operacional_frac', models.DecimalField(blank=True, decimal_places=6, help_text='Divisor operacional (fração 0–1) usado no MCP, se houver.', max_digits=10, null=True)),
                ('arquivo_importado_nome', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('cliente', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='cotacoes_faixa_km', to='novacotacao.cliente')),
            ],
            options={
                'verbose_name': 'Cotação faixa KM',
                'verbose_name_plural': 'Cotações faixa KM',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='CotacaoFaixaKmLinha',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ordem', models.PositiveIntegerField(default=0)),
                ('uf_origem', models.CharField(max_length=2)),
                ('uf_destino', models.CharField(max_length=2)),
                ('faixa_id', models.CharField(max_length=80)),
                ('faixa_label', models.CharField(max_length=160)),
                ('km_representativo', models.DecimalField(decimal_places=2, max_digits=10)),
                ('cotacao', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='linhas', to='cotacao_faixa_km.cotacaofaixakm')),
            ],
            options={
                'ordering': ['ordem', 'id'],
            },
        ),
        migrations.CreateModel(
            name='CotacaoFaixaKmVeiculo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ordem', models.PositiveSmallIntegerField(default=0)),
                ('tipo_veiculo', models.CharField(max_length=255)),
                ('cotacao', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='veiculos_inclusos', to='cotacao_faixa_km.cotacaofaixakm')),
                ('veiculo', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='cotacoes_faixa_km_uso', to='novacotacao.veiculo')),
            ],
            options={
                'ordering': ['ordem', 'id'],
            },
        ),
        migrations.CreateModel(
            name='CotacaoFaixaKmCelula',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('custo', models.DecimalField(decimal_places=4, max_digits=16)),
                ('mcp', models.DecimalField(decimal_places=4, max_digits=16)),
                ('linha', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='celulas', to='cotacao_faixa_km.cotacaofaixakmlinha')),
                ('veiculo', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='novacotacao.veiculo')),
            ],
        ),
        migrations.AddConstraint(
            model_name='cotacaofaixakmveiculo',
            constraint=models.UniqueConstraint(fields=('cotacao', 'veiculo'), name='uniq_cotacao_faixa_km_veiculo'),
        ),
        migrations.AddConstraint(
            model_name='cotacaofaixakmcelula',
            constraint=models.UniqueConstraint(fields=('linha', 'veiculo'), name='uniq_cotacao_faixa_km_celula'),
        ),
    ]
