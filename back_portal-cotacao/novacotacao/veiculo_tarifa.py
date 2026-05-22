"""Helpers — tarifas CCD por tabela ANTT (A, B, C, D)."""

ANTT_TABELAS = ('A', 'B', 'C', 'D')

FRETE_TARIFA_FIELD_NAMES = (
    'frete_minimo_ate_50km',
    'tarifa_0_50',
    'tarifa_51_100',
    'tarifa_101_150',
    'tarifa_151_200',
    'tarifa_201_300',
    'tarifa_301_400',
    'tarifa_401_500',
    'tarifa_acima_500',
)


def tarifa_row_as_dict(row):
    """Converte `VeiculoTarifaAntt` ou veículo legado em dict de tarifas."""
    if row is None:
        return {k: 0 for k in FRETE_TARIFA_FIELD_NAMES}
    return {k: getattr(row, k, 0) for k in FRETE_TARIFA_FIELD_NAMES}


def tarifas_antt_map(veiculo):
    """{ 'A': { tarifa_0_50: Decimal, ... }, ... }"""
    out = {}
    prefetched = getattr(veiculo, '_prefetched_objects_cache', None)
    if prefetched and 'tarifas_antt' in prefetched:
        rows = veiculo.tarifas_antt.all()
    else:
        rows = veiculo.tarifas_antt.all() if hasattr(veiculo, 'tarifas_antt') else []
    for row in rows:
        out[row.tabela] = tarifa_row_as_dict(row)
    for t in ANTT_TABELAS:
        if t not in out:
            out[t] = tarifa_row_as_dict(veiculo if t == 'A' else None)
    return out


def get_tarifa_row(veiculo, tabela='A'):
    t = str(tabela or 'A').strip().upper()[:1]
    if t not in ANTT_TABELAS:
        t = 'A'
    try:
        return veiculo.tarifas_antt.get(tabela=t)
    except Exception:
        return None


def custo_km_por_faixa(km, veiculo, tabela='A'):
    """CCD (R$/km) conforme km e tabela ANTT."""
    from decimal import Decimal

    row = get_tarifa_row(veiculo, tabela)
    src = row if row is not None else veiculo
    try:
        k = float(km)
    except (TypeError, ValueError):
        k = 0.0

    def _d(field):
        v = getattr(src, field, 0)
        return Decimal(str(v or 0))

    if k <= 50:
        return _d('tarifa_0_50')
    if k <= 100:
        return _d('tarifa_51_100')
    if k <= 150:
        return _d('tarifa_101_150')
    if k <= 200:
        return _d('tarifa_151_200')
    if k <= 300:
        return _d('tarifa_201_300')
    if k <= 400:
        return _d('tarifa_301_400')
    if k <= 500:
        return _d('tarifa_401_500')
    return _d('tarifa_acima_500')
