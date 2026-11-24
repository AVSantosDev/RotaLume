# Dados iniciais: matriz Markup (cliente × LAIR × alíquota bruta × aliquota reduzida).
# percentual_base espelha markupSpotLookup.js (DIVERSOS vs malha Renault+).

from decimal import Decimal

from django.db import migrations


def _almost_eq(a, b, eps=0.02):
    return abs(float(a) - float(b)) <= eps


def _markup_base_diversos(k, l):
    k, l = float(k), float(l)
    if _almost_eq(k, 20) and _almost_eq(l, 20):
        return Decimal("59.19")
    if _almost_eq(k, 18) and _almost_eq(l, 18):
        return Decimal("57.42")
    if _almost_eq(k, 3) and _almost_eq(l, 3):
        return Decimal("57.55")
    if _almost_eq(k, 7) and _almost_eq(l, 7):
        return Decimal("57.53")
    if _almost_eq(k, 12) and _almost_eq(l, 12):
        return Decimal("57.48")
    if _almost_eq(l, 17):
        return Decimal("57.43")
    if _almost_eq(l, 12):
        return Decimal("59.23")
    if _almost_eq(l, 7):
        return Decimal("58.50")
    if _almost_eq(l, 0):
        return Decimal("57.59")
    if _almost_eq(l, 5):
        return Decimal("57.55")
    return Decimal("0")


def _markup_base_renault(k, l):
    k, l = float(k), float(l)
    if _almost_eq(k, 18) and _almost_eq(l, 18):
        return Decimal("57.42")
    if _almost_eq(k, 3) and _almost_eq(l, 3):
        return Decimal("57.55")
    if _almost_eq(k, 7) and _almost_eq(l, 7):
        return Decimal("57.53")
    if _almost_eq(k, 12) and _almost_eq(l, 12):
        return Decimal("57.48")
    if _almost_eq(l, 17):
        return Decimal("57.43")
    if _almost_eq(l, 12):
        return Decimal("59.23")
    if _almost_eq(l, 7):
        return Decimal("58.50")
    if _almost_eq(l, 0):
        return Decimal("57.59")
    if _almost_eq(l, 5):
        return Decimal("57.55")
    return Decimal("0")


def _usa_malha_renault(nome):
    n = (nome or "").upper().strip().replace("  ", " ")
    if not n:
        return False
    if n == "RENAULT" or "RENAULT" in n:
        return True
    tags = ("MAHLE", "ROD CNH", "NIDEC", "ROD IVECO")
    return any(t in n or n == t for t in tags)


def _base_para(nome_cliente, k, l):
    if _usa_malha_renault(nome_cliente):
        return _markup_base_renault(k, l)
    return _markup_base_diversos(k, l)


def seed_markup(apps, schema_editor):
    MarkupClienteFaixa = apps.get_model("configuracao", "MarkupClienteFaixa")

    clientes = (
        "DIVERSOS",
        "CNH",
        "RENAULT",
        "MAHLE",
        "ROD CNH",
        "NIDEC",
        "BOTICARIO",
        "ROD IVECO",
    )

    # LAIR (% C26) — linhas usuais da matriz
    lairs = (Decimal("20"), Decimal("18"), Decimal("15"), Decimal("12"), Decimal("10"), Decimal("1"), Decimal("0"))

    # (aliquota_reduzida K11, aliquota_bruta L11) — cobre os SE aninhados da planilha + rota PR típica
    pares_rota = (
        (Decimal("20"), Decimal("20")),
        (Decimal("18"), Decimal("18")),
        (Decimal("3"), Decimal("3")),
        (Decimal("7"), Decimal("7")),
        (Decimal("12"), Decimal("12")),
        (Decimal("12"), Decimal("17")),
        (Decimal("17"), Decimal("17")),
        (Decimal("9.6"), Decimal("12")),
        (Decimal("9.6"), Decimal("7")),
        (Decimal("9.6"), Decimal("0")),
        (Decimal("9.6"), Decimal("5")),
        (Decimal("0"), Decimal("0")),
        (Decimal("5"), Decimal("5")),
    )

    for nome in clientes:
        for lair in lairs:
            for k, l in pares_rota:
                base = _base_para(nome, k, l)
                if base <= 0:
                    continue
                MarkupClienteFaixa.objects.update_or_create(
                    nome_cliente=nome,
                    percentual_markup=lair,
                    aliquota_bruta=l,
                    aliquota_reduzida=k,
                    defaults={"percentual_base": base},
                )


def noop_reverse(apps, schema_editor):
    """Não remove linhas: evita apagar ajustes manuais feitos após o seed."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0015_alter_imposto_options_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_markup, noop_reverse),
    ]
