from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

import requests


def _dec(v) -> Decimal:
    if v is None:
        return Decimal('0')
    try:
        return Decimal(str(v))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal('0')


def somar_pedagios_por_eixo(pedagios: list | None, eixos: int) -> Decimal:
    key = str(int(eixos))
    total = Decimal('0')
    for p in pedagios or []:
        if not isinstance(p, dict):
            continue
        tar = p.get('tarifa')
        if isinstance(tar, dict) and key in tar:
            total += _dec(tar.get(key))
        elif isinstance(tar, dict) and tar:
            try:
                nums = sorted(int(k) for k in tar.keys() if str(k).isdigit())
                pick = next((n for n in nums if n >= int(eixos)), nums[-1] if nums else None)
                if pick is not None:
                    total += _dec(tar.get(str(pick)))
            except (ValueError, TypeError):
                pass
    return total


def post_rotas_v4(
    base_url: str,
    access_token: str,
    locations: list[str],
    axis: int,
) -> requests.Response:
    url = f'{base_url.rstrip("/")}/rotas/v4'
    headers = {'Access-Token': access_token.strip(), 'Content-Type': 'application/json'}
    body: dict[str, Any] = {
        'locations': locations,
        'config': {
            'route': {},
            'vehicle': {'type': 'truck', 'axis': int(axis)},
        },
        'show': {'tolls': True, 'polyline': False, 'freight_table': False},
    }
    return requests.post(url, json=body, headers=headers, timeout=90)


def _deep_find_freight_value(obj: Any, depth: int = 0, max_depth: int = 5) -> float | None:
    """Último recurso: primeiro número em dict aninhado cuja chave sugira frete/piso mínimo."""
    if depth > max_depth or not isinstance(obj, dict):
        return None
    priority = ('minimum_freight', 'freight_cost', 'frete_minimo', 'total_freight', 'valor_frete')
    for pk in priority:
        if pk in obj:
            n = _num_br(obj.get(pk))
            if n is not None:
                return n
    for k, v in obj.items():
        kl = (k or '').lower()
        if any(a in kl for a in ('carga', 'descarga', 'load_unload', 'resolution', 'params')):
            continue
        if isinstance(v, dict):
            n = _deep_find_freight_value(v, depth + 1, max_depth)
            if n is not None:
                return n
        elif isinstance(v, (int, float, str)) and any(
            x in kl for x in ('freight', 'frete', 'minimum', 'minimo', 'piso', 'antt', 'total')
        ):
            n = _num_br(v)
            if n is not None:
                return n
    return None


def _num_br(v) -> float | None:
    """Converte int/float/str (incl. '1.234,56' ou '1234.56') em float."""
    if v is None or v is False:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace('R$', '').replace('r$', '').strip()
        if not s:
            return None
        if ',' in s and '.' in s:
            s = s.replace('.', '').replace(',', '.')
        elif ',' in s and s.rfind(',') > s.rfind('.'):
            s = s.replace(',', '.')
        try:
            return float(s)
        except ValueError:
            return None
    return None


def extrair_piso_e_carga_descarga(tf_js: dict | Any) -> tuple[float | None, float | None]:
    """
    Lê piso ANTT e carga/descarga da resposta tabela-frete/v1.

    Formatos vistos na QualP:
    - `{ "data": { ... } }` (legado / docs)
    - `{ "params", "costs", "antt_resolution" }` — piso e carga/descarga vêm em `costs` (não há `data`).
    """
    if not isinstance(tf_js, dict):
        return None, None

    raw = tf_js.get('data')
    if isinstance(raw, list) and raw:
        data = raw[0] if isinstance(raw[0], dict) else {}
    elif isinstance(raw, dict):
        data = raw
    else:
        data = {}

    costs_top = tf_js.get('costs')

    def first_float(*keys, root=None):
        r = root if root is not None else data
        if not isinstance(r, dict):
            return None
        for k in keys:
            n = _num_br(r.get(k))
            if n is not None:
                return n
        return None

    def pick_by_name_substring(d: dict, must: tuple[str, ...], avoid: tuple[str, ...] = ()) -> float | None:
        if not isinstance(d, dict):
            return None
        for k, v in d.items():
            kl = (k or '').lower()
            if any(a in kl for a in avoid):
                continue
            if not any(m in kl for m in must):
                continue
            n = _num_br(v)
            if n is not None and n >= 0:
                return n
        return None

    freight_keys = (
        'freight_cost',
        'minimum_freight',
        'minimum_freight_cost',
        'minimum_table_freight',
        'total_minimum_freight',
        'frete_minimo',
        'frete_minimo_antt',
        'valor_frete_minimo',
        'valor_minimo',
        'valor_piso',
        'piso_minimo',
        'minimum_cost',
        'total',
        'total_freight',
        'minimum_total_freight',
    )

    freight = None
    load_unload = None

    # 1) Formato atual QualP: objeto `costs` no topo
    if isinstance(costs_top, dict):
        freight = first_float(*freight_keys, root=costs_top)
        if freight is None and isinstance(costs_top.get('freight'), dict):
            freight = first_float(
                'minimum',
                'minimum_freight',
                'cost',
                'value',
                'valor',
                'total',
                root=costs_top['freight'],
            )
        if freight is None:
            freight = pick_by_name_substring(
                costs_top,
                ('freight', 'frete', 'piso', 'minimo', 'minimum', 'antt'),
                ('carga', 'load_unload', 'descarga', 'params'),
            )
        load_unload = first_float(
            'load_unload_cost',
            'carga_descarga',
            'load_unload',
            'valor_carga_descarga',
            'carga_descarga_antt',
            root=costs_top,
        )
        if load_unload is None:
            load_unload = pick_by_name_substring(
                costs_top,
                ('carga', 'descarga', 'load_unload'),
                ('freight', 'frete', 'antt_resolution'),
            )
        if freight is None:
            freight = _deep_find_freight_value(costs_top)

    # 2) Formato com `data`
    if freight is None:
        freight = first_float(*freight_keys)
    if freight is None and isinstance(data.get('freight'), dict):
        freight = first_float('minimum', 'minimum_freight', 'cost', 'value', 'valor', root=data['freight'])
    if freight is None and isinstance(data.get('costs'), dict):
        freight = first_float(
            'freight_minimum',
            'minimum_freight',
            'freight_cost',
            root=data['costs'],
        )
    if freight is None:
        freight = first_float(*freight_keys, root=tf_js)
    if freight is None:
        freight = pick_by_name_substring(
            data,
            ('freight', 'frete', 'piso', 'minimo', 'minimum', 'antt'),
            ('carga', 'load_unload', 'descarga'),
        )
    if freight is None:
        freight = pick_by_name_substring(
            tf_js,
            ('freight', 'frete', 'piso', 'minimo', 'minimum'),
            ('carga', 'load_unload', 'descarga', 'resolution', 'params'),
        )

    if load_unload is None:
        load_unload = first_float(
            'load_unload_cost',
            'carga_descarga',
            'load_unload',
            'valor_carga_descarga',
            'carga_descarga_antt',
        )
    if load_unload is None and isinstance(data.get('costs'), dict):
        load_unload = first_float('load_unload', 'carga_descarga', root=data['costs'])

    return freight, load_unload


def post_tabela_frete(
    base_url: str,
    access_token: str,
    distance_km: float,
    axis: int,
    freight_type: str,
    load_type: str,
    is_empty_return: bool,
    retroactive_date: str | None,
) -> requests.Response:
    url = f'{base_url.rstrip("/")}/tabela-frete/v1'
    headers = {'Access-Token': access_token.strip(), 'Content-Type': 'application/json'}
    body: dict[str, Any] = {
        'distance': float(distance_km),
        'axis': int(axis),
        'freight_type': freight_type.strip().upper(),
        'load_type': load_type.strip(),
        'is_empty_return': bool(is_empty_return),
    }
    if retroactive_date:
        body['retroactive_date'] = retroactive_date.strip()
    return requests.post(url, json=body, headers=headers, timeout=60)
