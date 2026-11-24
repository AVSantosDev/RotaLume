from django.db import migrations, models


def inferir_malha(apps, schema_editor):
    ClienteTaxasConfig = apps.get_model("configuracao", "ClienteTaxasConfig")

    def norm(s: str) -> str:
        return " ".join((s or "").upper().strip().split())

    renault_tags = ("RENAULT", "MAHLE", "ROD CNH", "NIDEC", "ROD IVECO")

    for row in ClienteTaxasConfig.objects.all():
        n = norm(getattr(row, "nome_cliente", ""))
        if not n:
            continue
        if "BOTICARIO" in n or "BOTICÁRIO" in n:
            row.malha_spot_tipo = "BOTICARIO"
        elif "RENAULT" in n or any(tag == n or tag in n for tag in renault_tags):
            row.malha_spot_tipo = "RENAULT"
        else:
            row.malha_spot_tipo = "DIVERSOS"
        row.save(update_fields=["malha_spot_tipo"])


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0020_seed_markup_planilha_lair_tiers"),
    ]

    operations = [
        migrations.AddField(
            model_name="clientetaxasconfig",
            name="malha_spot_tipo",
            field=models.CharField(
                choices=[("DIVERSOS", "DIVERSOS"), ("RENAULT", "RENAULT"), ("BOTICARIO", "BOTICARIO"), ("CUSTOM", "CUSTOM")],
                default="DIVERSOS",
                help_text="Tipo de malha SPOT (árvore de SE da planilha) usada para calcular o percentual base por LAIR/K/L.",
                max_length=12,
            ),
        ),
        migrations.RunPython(inferir_malha, migrations.RunPython.noop),
    ]

