# Generated manually — malha Bases (PIS/COFINS, repasse, crédito)

from decimal import Decimal

from django.db import migrations, models


def seed_impostos_bases(apps, schema_editor):
    Imposto = apps.get_model("configuracao", "Imposto")
    linhas = [
        ("PIS", Decimal("1.65"), 10),
        ("COFINS", Decimal("7.60"), 11),
        ("IR/CSLL", Decimal("34.00"), 20),
        ("CPRB", Decimal("1.20"), 30),
        ("CREDITO", Decimal("6.94"), 40),
        ("PIS/COFINS/CPRB/TX", Decimal("9.73"), 50),
    ]
    for nome, aliquota, ordem in linhas:
        obj, created = Imposto.objects.get_or_create(
            nome=nome,
            defaults={"aliquota": aliquota, "ordem": ordem},
        )
        if not created:
            obj.aliquota = aliquota
            obj.ordem = ordem
            obj.save(update_fields=["aliquota", "ordem"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0004_remove_markupclientefaixa_percentual_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="imposto",
            name="ordem",
            field=models.PositiveSmallIntegerField(
                default=100,
                help_text="Ordem na tela e nos relatórios (menor = primeiro).",
            ),
        ),
        migrations.AlterField(
            model_name="imposto",
            name="nome",
            field=models.CharField(max_length=60, unique=True),
        ),
        migrations.RunPython(seed_impostos_bases, noop_reverse),
    ]
