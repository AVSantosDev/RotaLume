"""
Calculadora rápida — custo CTRB + markup (%).

  frete_valor = custo_ctrb * (1 + markup_pct / 100)
"""

from __future__ import annotations

from typing import Any


def calcular_rapido(payload: dict[str, Any]) -> dict[str, Any]:
    custo = float(payload.get("custo_ctrb") or 0)
    markup_pct = float(payload.get("markup_pct") or 0)

    if custo <= 0:
        return {
            "ok": False,
            "error": "Informe custo_ctrb maior que zero.",
        }

    acrescimo = custo * (markup_pct / 100.0)
    frete_valor = custo + acrescimo
    markup_efetivo_pct = (frete_valor / custo - 1.0) * 100.0 if custo > 0 else 0.0

    return {
        "ok": True,
        "custo_ctrb": round(custo, 2),
        "markup_pct": round(markup_pct, 4),
        "valor_acrescimo_markup": round(acrescimo, 2),
        "frete_valor": round(frete_valor, 2),
        "markup_efetivo_sobre_custo_pct": round(markup_efetivo_pct, 4),
        "formulas": {
            "frete_valor": "custo_ctrb * (1 + markup_pct/100)",
            "acrescimo": "custo_ctrb * (markup_pct/100)",
        },
    }
