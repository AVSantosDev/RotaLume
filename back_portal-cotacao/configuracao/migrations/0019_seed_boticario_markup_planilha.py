# Atualiza percentual_base para BOTICARIO conforme planilha SPOT (malha por LAIR + K11/L11).

from decimal import Decimal

from django.db import migrations


def _almost_eq(a, b, eps=0.02):
    return abs(float(a) - float(b)) <= eps


# Espelho de markupSpotLookup.js — BOTICARIO_POR_LAIR
BOTICARIO = {
    20: {
        "pairs": [(18, 18, "57.42"), (3, 3, "57.55"), (7, 7, "57.53"), (12, 12, "57.48")],
        "l": [(17, "57.43"), (12, "59.23"), (7, "58.50"), (0, "57.59"), (5, "57.55")],
    },
    18: {
        "pairs": [(18, 18, "59.37"), (3, 3, "59.49"), (7, 7, "59.48"), (12, 12, "59.43")],
        "l": [(17, "59.38"), (12, "61.24"), (7, "60.45"), (0, "59.54"), (5, "59.50")],
    },
    15: {
        "pairs": [(18, 18, "62.31"), (3, 3, "62.46"), (7, 7, "62.43"), (12, 12, "62.37")],
        "l": [(17, "62.32"), (12, "64.27"), (7, "63.40"), (0, "62.49"), (5, "62.45")],
    },
    12: {
        "pairs": [(18, 18, "65.26"), (3, 3, "65.42"), (7, 7, "65.38"), (12, 12, "65.33")],
        "l": [(17, "65.27"), (12, "67.31"), (7, "66.48"), (0, "65.45"), (5, "65.40")],
    },
    10: {
        "pairs": [(18, 18, "67.23"), (3, 3, "67.38"), (7, 7, "67.36"), (12, 12, "67.31")],
        "l": [(17, "67.24"), (12, "69.35"), (7, "68.47"), (0, "67.43"), (5, "67.38")],
    },
}


def _markup_boticario(lair_pct, k, l):
    tiers = [20, 18, 15, 12, 10]
    tier = None
    for t in tiers:
        if _almost_eq(float(lair_pct), t):
            tier = t
            break
    if tier is None:
        return Decimal("0")
    row = BOTICARIO[tier]
    fk, fl = float(k), float(l)
    for kk, ll, v in row["pairs"]:
        if _almost_eq(fk, kk) and _almost_eq(fl, ll):
            return Decimal(v)
    for ll, v in row["l"]:
        if _almost_eq(fl, ll):
            return Decimal(v)
    return Decimal("0")


def seed_boticario(apps, schema_editor):
    MarkupClienteFaixa = apps.get_model("configuracao", "MarkupClienteFaixa")

    lairs = (Decimal("20"), Decimal("18"), Decimal("15"), Decimal("12"), Decimal("10"))

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

    for nome in ("BOTICARIO", "BOTICÁRIO"):
        for lair in lairs:
            for k, l in pares_rota:
                base = _markup_boticario(lair, k, l)
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
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0018_cliente_solicitante"),
    ]

    operations = [
        migrations.RunPython(seed_boticario, noop_reverse),
    ]
