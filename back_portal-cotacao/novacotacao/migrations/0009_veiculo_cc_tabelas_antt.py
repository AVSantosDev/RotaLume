from django.db import migrations, models


def copiar_taxa_para_cc(apps, schema_editor):
    Veiculo = apps.get_model('novacotacao', 'Veiculo')
    for v in Veiculo.objects.all():
        taxa = v.taxa_correcao or 0
        v.cc_tabela_a = taxa
        v.cc_tabela_b = taxa
        v.cc_tabela_c = taxa
        v.cc_tabela_d = taxa
        v.save(update_fields=['cc_tabela_a', 'cc_tabela_b', 'cc_tabela_c', 'cc_tabela_d'])


class Migration(migrations.Migration):

    dependencies = [
        ('novacotacao', '0008_cotacao_faixa_km_snapshot'),
    ]

    operations = [
        migrations.AddField(
            model_name='veiculo',
            name='cc_tabela_a',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14, verbose_name='CC tabela A (R$)'),
        ),
        migrations.AddField(
            model_name='veiculo',
            name='cc_tabela_b',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14, verbose_name='CC tabela B (R$)'),
        ),
        migrations.AddField(
            model_name='veiculo',
            name='cc_tabela_c',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14, verbose_name='CC tabela C (R$)'),
        ),
        migrations.AddField(
            model_name='veiculo',
            name='cc_tabela_d',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14, verbose_name='CC tabela D (R$)'),
        ),
        migrations.RunPython(copiar_taxa_para_cc, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='veiculo',
            name='taxa_correcao',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                max_digits=14,
                verbose_name='CC legado / CTRB Nova Cotação (R$)',
            ),
        ),
    ]
