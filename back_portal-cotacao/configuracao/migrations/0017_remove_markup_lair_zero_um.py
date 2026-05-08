# Remove linhas de markup com LAIR 0% e 1% (não usadas na matriz operacional).

from decimal import Decimal

from django.db import migrations


def forwards(apps, schema_editor):
    MarkupClienteFaixa = apps.get_model("configuracao", "MarkupClienteFaixa")
    MarkupClienteFaixa.objects.filter(
        percentual_markup__in=[Decimal("0"), Decimal("1")]
    ).delete()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0016_seed_markup_matriz_completa"),
    ]

    operations = [
        migrations.RunPython(forwards, noop_reverse),
    ]
