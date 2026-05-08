"""
Atualiza percentual_base conforme planilha (DIVERSOS e malha Renault+) por faixa de LAIR.

Motivo: o seed antigo (0016) calculava percentual_base sem depender do LAIR (C26),
mas as fórmulas do Excel variam por LAIR (20/18/15/12/10).
"""

from decimal import Decimal

from django.db import migrations


def _almost_eq(a, b, eps=Decimal("0.02")):
    return abs(Decimal(a) - Decimal(b)) <= eps


DIVERSOS = {
    Decimal("20"): {
        "pairs": [
            (Decimal("20"), Decimal("20"), Decimal("59.19")),
            (Decimal("18"), Decimal("18"), Decimal("57.42")),
            (Decimal("3"), Decimal("3"), Decimal("57.55")),
            (Decimal("7"), Decimal("7"), Decimal("57.53")),
            (Decimal("12"), Decimal("12"), Decimal("57.48")),
        ],
        "l": [
            (Decimal("17"), Decimal("57.43")),
            (Decimal("12"), Decimal("59.23")),
            (Decimal("7"), Decimal("58.50")),
            (Decimal("0"), Decimal("57.59")),
            (Decimal("5"), Decimal("57.55")),
        ],
    },
    Decimal("18"): {
        "pairs": [
            (Decimal("20"), Decimal("20"), Decimal("61.14")),
            (Decimal("18"), Decimal("18"), Decimal("59.37")),
            (Decimal("3"), Decimal("3"), Decimal("59.49")),
            (Decimal("7"), Decimal("7"), Decimal("59.48")),
            (Decimal("12"), Decimal("12"), Decimal("59.43")),
        ],
        "l": [
            (Decimal("17"), Decimal("59.38")),
            (Decimal("12"), Decimal("61.24")),
            (Decimal("7"), Decimal("60.45")),
            (Decimal("0"), Decimal("59.54")),
            (Decimal("5"), Decimal("59.50")),
        ],
    },
    Decimal("15"): {
        "pairs": [
            (Decimal("20"), Decimal("20"), Decimal("64.00")),
            (Decimal("18"), Decimal("18"), Decimal("62.31")),
            (Decimal("3"), Decimal("3"), Decimal("62.46")),
            (Decimal("7"), Decimal("7"), Decimal("62.43")),
            (Decimal("12"), Decimal("12"), Decimal("62.37")),
        ],
        "l": [
            (Decimal("17"), Decimal("62.32")),
            (Decimal("12"), Decimal("64.27")),
            (Decimal("7"), Decimal("63.40")),
            (Decimal("0"), Decimal("62.49")),
            (Decimal("5"), Decimal("62.45")),
        ],
    },
    Decimal("12"): {
        "pairs": [
            (Decimal("20"), Decimal("20"), Decimal("67.04")),
            (Decimal("18"), Decimal("18"), Decimal("65.26")),
            (Decimal("3"), Decimal("3"), Decimal("65.42")),
            (Decimal("7"), Decimal("7"), Decimal("65.38")),
            (Decimal("12"), Decimal("12"), Decimal("65.33")),
        ],
        "l": [
            (Decimal("17"), Decimal("65.27")),
            (Decimal("12"), Decimal("67.31")),
            (Decimal("7"), Decimal("66.48")),
            (Decimal("0"), Decimal("65.45")),
            (Decimal("5"), Decimal("65.40")),
        ],
    },
    Decimal("10"): {
        "pairs": [
            (Decimal("20"), Decimal("20"), Decimal("69.02")),
            (Decimal("18"), Decimal("18"), Decimal("67.23")),
            (Decimal("3"), Decimal("3"), Decimal("67.38")),
            (Decimal("7"), Decimal("7"), Decimal("67.36")),
            (Decimal("12"), Decimal("12"), Decimal("67.31")),
        ],
        "l": [
            (Decimal("17"), Decimal("67.24")),
            (Decimal("12"), Decimal("69.35")),
            (Decimal("7"), Decimal("68.47")),
            (Decimal("0"), Decimal("67.43")),
            (Decimal("5"), Decimal("67.38")),
        ],
    },
}


RENAULT = {
    Decimal("20"): {
        "pairs": [
            (Decimal("18"), Decimal("18"), Decimal("57.42")),
            (Decimal("3"), Decimal("3"), Decimal("57.55")),
            (Decimal("7"), Decimal("7"), Decimal("57.53")),
            (Decimal("12"), Decimal("12"), Decimal("57.48")),
        ],
        "l": [
            (Decimal("17"), Decimal("57.43")),
            (Decimal("12"), Decimal("59.23")),
            (Decimal("7"), Decimal("58.50")),
            (Decimal("0"), Decimal("57.59")),
            (Decimal("5"), Decimal("57.55")),
        ],
    },
    Decimal("18"): {
        "pairs": [
            (Decimal("18"), Decimal("18"), Decimal("59.37")),
            (Decimal("3"), Decimal("3"), Decimal("59.49")),
            (Decimal("7"), Decimal("7"), Decimal("59.48")),
            (Decimal("12"), Decimal("12"), Decimal("59.43")),
        ],
        "l": [
            (Decimal("17"), Decimal("59.38")),
            (Decimal("12"), Decimal("61.24")),
            (Decimal("7"), Decimal("60.45")),
            (Decimal("0"), Decimal("59.54")),
            (Decimal("5"), Decimal("59.50")),
        ],
    },
    Decimal("15"): {
        "pairs": [
            (Decimal("18"), Decimal("18"), Decimal("62.31")),
            (Decimal("3"), Decimal("3"), Decimal("62.46")),
            (Decimal("7"), Decimal("7"), Decimal("62.43")),
            (Decimal("12"), Decimal("12"), Decimal("62.37")),
        ],
        "l": [
            (Decimal("17"), Decimal("62.32")),
            (Decimal("12"), Decimal("64.27")),
            (Decimal("7"), Decimal("63.40")),
            (Decimal("0"), Decimal("62.49")),
            (Decimal("5"), Decimal("62.45")),
        ],
    },
    Decimal("12"): {
        "pairs": [
            (Decimal("18"), Decimal("18"), Decimal("65.26")),
            (Decimal("3"), Decimal("3"), Decimal("65.42")),
            (Decimal("7"), Decimal("7"), Decimal("65.38")),
            (Decimal("12"), Decimal("12"), Decimal("65.33")),
        ],
        "l": [
            (Decimal("17"), Decimal("65.27")),
            (Decimal("12"), Decimal("67.31")),
            (Decimal("7"), Decimal("66.48")),
            (Decimal("0"), Decimal("65.45")),
            (Decimal("5"), Decimal("65.40")),
        ],
    },
    Decimal("10"): {
        "pairs": [
            (Decimal("18"), Decimal("18"), Decimal("67.23")),
            (Decimal("3"), Decimal("3"), Decimal("67.38")),
            (Decimal("7"), Decimal("7"), Decimal("67.36")),
            (Decimal("12"), Decimal("12"), Decimal("67.31")),
        ],
        "l": [
            (Decimal("17"), Decimal("67.24")),
            (Decimal("12"), Decimal("69.35")),
            (Decimal("7"), Decimal("68.47")),
            (Decimal("0"), Decimal("67.43")),
            (Decimal("5"), Decimal("67.38")),
        ],
    },
}


def _usa_malha_renault(nome):
    n = (nome or "").upper().strip().replace("  ", " ")
    if not n:
        return False
    if n == "RENAULT" or "RENAULT" in n:
        return True
    tags = ("MAHLE", "ROD CNH", "NIDEC", "ROD IVECO")
    return any(t in n or n == t for t in tags)


def _base(mapper, lair, k, l):
    row = mapper.get(lair)
    if not row:
        return Decimal("0")
    for kk, ll, v in row["pairs"]:
        if _almost_eq(k, kk) and _almost_eq(l, ll):
            return v
    for ll, v in row["l"]:
        if _almost_eq(l, ll):
            return v
    return Decimal("0")


def seed_markup_lair_tiers(apps, schema_editor):
    MarkupClienteFaixa = apps.get_model("configuracao", "MarkupClienteFaixa")

    clientes = ("DIVERSOS", "CNH", "RENAULT", "MAHLE", "ROD CNH", "NIDEC", "ROD IVECO")
    lairs = (Decimal("20"), Decimal("18"), Decimal("15"), Decimal("12"), Decimal("10"))

    # Mesmo conjunto que 0016/0019 já usam (inclui o par 20/20 que só DIVERSOS possui)
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
        mapper = RENAULT if _usa_malha_renault(nome) else DIVERSOS
        for lair in lairs:
            for k, l in pares_rota:
                base = _base(mapper, lair, k, l)
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
        ("configuracao", "0019_seed_boticario_markup_planilha"),
    ]

    operations = [
        migrations.RunPython(seed_markup_lair_tiers, noop_reverse),
    ]

