from decimal import Decimal, ROUND_HALF_UP


def _d(x):
    if x is None:
        return Decimal('0')
    if isinstance(x, Decimal):
        return x
    return Decimal(str(x))


def round_money_1dp(value):
    q = Decimal('0.1')
    return _d(value).quantize(q, rounding=ROUND_HALF_UP)


def markup_efetivo_veiculo_rota(markup_veiculo_pct, regras_rota, uf_o, uf_d, veiculo_id):
    m = _d(markup_veiculo_pct)
    best = None
    best_score = -1
    for r in regras_rota or []:
        if str(r.get('uf_origem', '')).upper()[:2] != str(uf_o).upper()[:2]:
            continue
        if str(r.get('uf_destino', '')).upper()[:2] != str(uf_d).upper()[:2]:
            continue
        vid = r.get('veiculo_id')
        score = 2 if vid is not None and int(vid) == int(veiculo_id) else (1 if vid is None else 0)
        if score == 0:
            continue
        if score > best_score:
            best_score = score
            best = _d(r.get('percentual_markup') or 0)
    if best is not None and best_score > 0:
        return best
    return m


def _desconto_faixa_eh_regra_geral(registro):
    """veiculo_ids ausente = aplica a todos os veículos (regra geral da faixa)."""
    return registro.get('veiculo_ids') is None


def _desconto_faixa_aplica_veiculo(registro, veiculo_id_int):
    raw = registro.get('veiculo_ids')
    if raw is None:
        return True
    if not isinstance(raw, (list, tuple)):
        return True
    if len(raw) == 0:
        return False
    try:
        alvo = int(veiculo_id_int)
    except (TypeError, ValueError):
        return False
    for x in raw:
        try:
            if int(x) == alvo:
                return True
        except (TypeError, ValueError):
            continue
    return False


def _escolher_desconto_faixa_para_veiculo(desconto_faixas, faixa_id, veiculo_id_int):
    mesma = [d for d in (desconto_faixas or []) if str(d.get('faixa_id') or '') == str(faixa_id or '')]
    if not mesma:
        return None
    explicit = [
        d
        for d in mesma
        if not _desconto_faixa_eh_regra_geral(d) and _desconto_faixa_aplica_veiculo(d, veiculo_id_int)
    ]
    if explicit:
        explicit.sort(key=lambda d: len(d.get('veiculo_ids') or []))
        return explicit[0]
    geral = [d for d in mesma if _desconto_faixa_eh_regra_geral(d)]
    return geral[0] if geral else None


def calc_frete_um_round(
    base_valor,
    markup_pct,
    regras_rota,
    uf_o,
    uf_d,
    veiculo_id_int,
    desconto_faixas,
    faixa_id,
    desconto_colunas,
    *,
    apply_discounts=True,
):
    """
    Frete após markup no round 1; nos rounds 2+ o ``base_valor`` já é o frete anterior
    e aplicam-se apenas descontos (``markup_pct`` e ``regras_rota`` devem ser 0 / vazios).
    Descontos de faixa/coluna só quando ``apply_discounts`` é True.
    Retorna (valor_arredondado, meta_dict).
    """
    m_eff = markup_efetivo_veiculo_rota(markup_pct, regras_rota, uf_o, uf_d, veiculo_id_int)
    v = _d(base_valor) * (Decimal('1') + m_eff / Decimal('100'))
    d_faixa_pct = None
    d_col_pct = None

    if apply_discounts:
        usou_faixa = False
        d_esc = _escolher_desconto_faixa_para_veiculo(desconto_faixas, faixa_id, veiculo_id_int)
        if d_esc is not None:
            p = _d(d_esc.get('percentual_desconto') or 0)
            if p != 0:
                d_faixa_pct = float(p)
                v *= Decimal('1') - p / Decimal('100')
                usou_faixa = True

        if not usou_faixa:
            for d in desconto_colunas or []:
                if int(d.get('veiculo_id') or 0) != int(veiculo_id_int):
                    continue
                p = _d(d.get('percentual_desconto') or 0)
                d_col_pct = float(p)
                v *= Decimal('1') - p / Decimal('100')

    val = round_money_1dp(v)
    meta = {
        'markup_efetivo_pct': float(m_eff),
        'desconto_faixa_pct': d_faixa_pct,
        'desconto_coluna_pct': d_col_pct,
        'descontos_aplicados': bool(apply_discounts),
    }
    return val, meta


def _serialize_round_for_calc(rnd):
    return {
        'ordem': rnd.ordem,
        'nome': rnd.nome or '',
        'markup_veiculos': [
            {'veiculo_id': mv.veiculo_id, 'percentual_markup': float(mv.percentual_markup)}
            for mv in rnd.markup_veiculos.all()
        ],
        'markup_rotas': [
            {
                'uf_origem': mr.uf_origem,
                'uf_destino': mr.uf_destino,
                'veiculo_id': mr.veiculo_id,
                'percentual_markup': float(mr.percentual_markup),
            }
            for mr in rnd.markup_rotas.all()
        ],
        'descontos_faixa': [
            {
                'faixa_id': df.faixa_id,
                'percentual_desconto': float(df.percentual_desconto),
                'veiculo_ids': df.veiculo_ids,
            }
            for df in rnd.descontos_faixa.all()
        ],
        'descontos_coluna': [
            {'veiculo_id': dc.veiculo_id, 'percentual_desconto': float(dc.percentual_desconto)}
            for dc in rnd.descontos_coluna.all()
        ],
    }


def _serialize_round_for_api(rnd):
    return {
        'id': rnd.id,
        'ordem': rnd.ordem,
        'nome': rnd.nome or f'Frete KM round {rnd.ordem}',
        'markup_veiculos': [
            {'veiculo_id': mv.veiculo_id, 'percentual_markup': float(mv.percentual_markup)}
            for mv in rnd.markup_veiculos.all()
        ],
        'markup_rotas': [
            {
                'id': mr.id,
                'uf_origem': mr.uf_origem,
                'uf_destino': mr.uf_destino,
                'veiculo_id': mr.veiculo_id,
                'percentual_markup': float(mr.percentual_markup),
            }
            for mr in rnd.markup_rotas.all()
        ],
        'descontos_faixa': [
            {
                'id': df.id,
                'faixa_id': df.faixa_id,
                'percentual_desconto': float(df.percentual_desconto),
                'veiculo_ids': df.veiculo_ids,
            }
            for df in rnd.descontos_faixa.all()
        ],
        'descontos_coluna': [
            {'id': dc.id, 'veiculo_id': dc.veiculo_id, 'percentual_desconto': float(dc.percentual_desconto)}
            for dc in rnd.descontos_coluna.all()
        ],
    }


def build_table_payload(cotacao):
    veiculos_qs = cotacao.veiculos_inclusos.select_related('veiculo').order_by('ordem', 'id')
    veiculos = [{'id': iv.veiculo_id, 'tipo': iv.tipo_veiculo} for iv in veiculos_qs]
    vids = [iv.veiculo_id for iv in veiculos_qs]

    rounds_qs = cotacao.rounds.order_by('ordem', 'id').prefetch_related(
        'markup_veiculos', 'markup_rotas', 'descontos_faixa', 'descontos_coluna'
    )
    rounds_calc = [_serialize_round_for_calc(r) for r in rounds_qs]
    if not rounds_calc and vids:
        rounds_calc = [
            {
                'ordem': 1,
                'nome': 'Frete KM round 1',
                'markup_veiculos': [{'veiculo_id': vid, 'percentual_markup': 0.0} for vid in vids],
                'markup_rotas': [],
                'descontos_faixa': [],
                'descontos_coluna': [],
            }
        ]

    # Não encadear prefetch_related em ``linhas`` se o queryset já veio com celulas
    # (ex.: retrieve no ViewSet) — evita ValueError: 'celulas' lookup was already seen...
    linhas_out = []
    for ln in cotacao.linhas.all():
        uf_o = ln.uf_origem
        uf_d = ln.uf_destino
        faixa_id = ln.faixa_id
        custos = {c.veiculo_id: _d(c.custo) for c in ln.celulas.all()}
        prev = {vid: custos.get(vid, Decimal('0')) for vid in vids}

        fretes_por_round_meta = []

        for ridx, rnd in enumerate(rounds_calc):
            round_ordem = int(rnd.get('ordem') or (ridx + 1))
            apply_disc = round_ordem >= 2

            mk = {int(x['veiculo_id']): _d(x.get('percentual_markup')) for x in (rnd.get('markup_veiculos') or [])}
            rotas = rnd.get('markup_rotas') or []
            d_faixas = rnd.get('descontos_faixa') or []
            d_cols = rnd.get('descontos_coluna') or []

            this_r = {}
            this_meta = {}
            for vid in vids:
                base = prev[vid]
                if round_ordem >= 2:
                    m = Decimal('0')
                    rotas_eff = []
                else:
                    m = mk.get(vid, Decimal('0'))
                    rotas_eff = rotas
                val, meta = calc_frete_um_round(
                    base,
                    m,
                    rotas_eff,
                    uf_o,
                    uf_d,
                    vid,
                    d_faixas,
                    faixa_id,
                    d_cols,
                    apply_discounts=apply_disc,
                )
                this_r[vid] = val
                this_meta[vid] = meta
            fretes_por_round_meta.append(
                {'ordem': round_ordem, 'porVeiculo': this_r, 'porVeiculoMeta': this_meta}
            )
            prev = this_r

        by_v = {}
        for vid in vids:
            custo_f = float(custos.get(vid, 0))
            by_v[str(vid)] = {
                'custo': custo_f,
                'fretesPorRound': [
                    {
                        'ordem': fr['ordem'],
                        'valor': float(fr['porVeiculo'].get(vid, 0)),
                        'markup_efetivo_pct': (fr.get('porVeiculoMeta') or {}).get(vid, {}).get('markup_efetivo_pct'),
                        'desconto_faixa_pct': (fr.get('porVeiculoMeta') or {}).get(vid, {}).get('desconto_faixa_pct'),
                        'desconto_coluna_pct': (fr.get('porVeiculoMeta') or {}).get(vid, {}).get('desconto_coluna_pct'),
                        'descontos_aplicados': (fr.get('porVeiculoMeta') or {}).get(vid, {}).get('descontos_aplicados'),
                    }
                    for fr in fretes_por_round_meta
                ],
            }

        linhas_out.append(
            {
                'id': ln.id,
                'rotaLabel': f'{uf_o}-{uf_d}-{ln.faixa_label}',
                'origem': uf_o,
                'destino': uf_d,
                'faixaLabel': ln.faixa_label,
                'faixaId': faixa_id,
                'kmRepresentativo': float(ln.km_representativo),
                'byVeiculoId': by_v,
            }
        )

    rounds_out = [_serialize_round_for_api(r) for r in rounds_qs]
    if not rounds_out and vids:
        rounds_out = [
            {
                'id': None,
                'ordem': 1,
                'nome': 'Frete KM round 1',
                'markup_veiculos': [{'veiculo_id': vid, 'percentual_markup': 0.0} for vid in vids],
                'markup_rotas': [],
                'descontos_faixa': [],
                'descontos_coluna': [],
            }
        ]

    return {'veiculos': veiculos, 'rows': linhas_out, 'rounds': rounds_out}


def custo_tarifa_cadastro_veiculo(veiculo, km_representativo):
    """Tarifa do cadastro do veículo conforme km representativo da linha (mesma lógica da planilha do front)."""
    try:
        k = float(_d(km_representativo))
    except Exception:
        k = 0.0
    if not k or k != k:  # NaN
        k = 0.0
    if k <= 50:
        return _d(veiculo.tarifa_0_50)
    if k <= 100:
        return _d(veiculo.tarifa_51_100)
    if k <= 150:
        return _d(veiculo.tarifa_101_150)
    if k <= 200:
        return _d(veiculo.tarifa_151_200)
    if k <= 300:
        return _d(veiculo.tarifa_201_300)
    if k <= 400:
        return _d(veiculo.tarifa_301_400)
    if k <= 500:
        return _d(veiculo.tarifa_401_500)
    return _d(veiculo.tarifa_acima_500)


def append_veiculo_a_cotacao(cotacao, veiculo, tipo_override=None):
    """
    Inclui veículo na cotação: linha de inclusão, células em todas as linhas (tarifa cadastro),
    markup 0 em cada round existente.
    """
    from django.db.models import Max

    from .models import (
        CotacaoFaixaKmCelula,
        CotacaoFaixaKmRound,
        CotacaoFaixaKmRoundMarkupVeiculo,
        CotacaoFaixaKmVeiculo,
    )

    existing = set(cotacao.veiculos_inclusos.values_list('veiculo_id', flat=True))
    if veiculo.pk in existing:
        raise ValueError('Este veículo já está na cotação.')

    max_o = cotacao.veiculos_inclusos.aggregate(m=Max('ordem')).get('m')
    next_o = int(max_o) + 1 if max_o is not None else 0
    tipo = (tipo_override or '').strip() or veiculo.tipo_veiculo
    CotacaoFaixaKmVeiculo.objects.create(
        cotacao=cotacao,
        ordem=next_o,
        veiculo=veiculo,
        tipo_veiculo=tipo[:255],
    )

    for ln in cotacao.linhas.order_by('ordem', 'id'):
        custo = custo_tarifa_cadastro_veiculo(veiculo, ln.km_representativo)
        CotacaoFaixaKmCelula.objects.create(linha=ln, veiculo=veiculo, custo=custo)

    rnds = list(cotacao.rounds.order_by('ordem', 'id'))
    if not rnds:
        vids_now = list(cotacao.veiculos_inclusos.order_by('ordem', 'id').values_list('veiculo_id', flat=True))
        r = CotacaoFaixaKmRound.objects.create(cotacao=cotacao, ordem=1, nome='Frete KM round 1')
        for vid in vids_now:
            CotacaoFaixaKmRoundMarkupVeiculo.objects.create(round=r, veiculo_id=vid, percentual_markup=0)
    else:
        for rnd in rnds:
            CotacaoFaixaKmRoundMarkupVeiculo.objects.get_or_create(
                round=rnd,
                veiculo=veiculo,
                defaults={'percentual_markup': 0},
            )


def append_linha_a_cotacao(cotacao, *, uf_origem, uf_destino, faixa_id, faixa_label, km_representativo, ordem=None, celulas=None):
    """Nova linha (rota + faixa) com custos por veículo (tarifa cadastro ou `celulas` informadas)."""
    from django.db.models import Max

    from novacotacao.models import Veiculo

    from .models import CotacaoFaixaKmCelula, CotacaoFaixaKmLinha

    vids_ordered = list(cotacao.veiculos_inclusos.order_by('ordem', 'id').values_list('veiculo_id', flat=True))
    if not vids_ordered:
        raise ValueError('Inclua ao menos um veículo na cotação antes de adicionar linhas.')

    if ordem is None:
        max_lo = cotacao.linhas.aggregate(m=Max('ordem')).get('m')
        ordem = int(max_lo) + 1 if max_lo is not None else 0

    ln = CotacaoFaixaKmLinha.objects.create(
        cotacao=cotacao,
        ordem=int(ordem),
        uf_origem=str(uf_origem).upper().strip()[:2],
        uf_destino=str(uf_destino).upper().strip()[:2],
        faixa_id=str(faixa_id)[:80],
        faixa_label=str(faixa_label)[:160],
        km_representativo=km_representativo,
    )

    custo_map = {}
    if celulas:
        for c in celulas:
            custo_map[int(c['veiculo_id'])] = _d(c['custo'])

    veiculos_map = {v.pk: v for v in Veiculo.objects.filter(pk__in=vids_ordered)}
    for vid in vids_ordered:
        v = veiculos_map.get(vid)
        if not v:
            continue
        custo = custo_map.get(vid, custo_tarifa_cadastro_veiculo(v, km_representativo))
        CotacaoFaixaKmCelula.objects.create(linha=ln, veiculo_id=vid, custo=custo)
