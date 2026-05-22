import { ccDoVeiculo } from './anttFaixaKmCalc';
import { normalizeNomeClienteMarkup } from './markupSpotLookup';
import { tarifaFaixaPorKm } from './veiculoTarifaAntt';

/**
 * Faixas padrão alinhadas ao cadastro de veículo (tarifas por distância).
 * repKm = km representativo para escolher a tarifa do cadastro.
 */
export const FAIXAS_KM_OPCOES = [
  { id: '1-50', label: 'De 1 Km a 50 Km', repKm: 25 },
  { id: '51-100', label: 'De 51 Km a 100 Km', repKm: 75 },
  { id: '101-150', label: 'De 101 Km a 150 Km', repKm: 125 },
  { id: '151-200', label: 'De 151 Km a 200 Km', repKm: 175 },
  { id: '201-300', label: 'De 201 Km a 300 Km', repKm: 250 },
  { id: '301-400', label: 'De 301 Km a 400 Km', repKm: 350 },
  { id: '401-500', label: 'De 401 Km a 500 Km', repKm: 450 },
  { id: '500+', label: 'Acima de 500 Km', repKm: 550 },
];

/**
 * Rotas UF × UF (malha inicial). O usuário pode editar, adicionar ou importar planilha.
 */
export const ROTAS_UF_PADRAO = [
  ['PR', 'SC'],
  ['PR', 'RJ'],
  ['PR', 'SP'],
  ['PR', 'MG'],
  ['SC', 'PR'],
  ['SC', 'SP'],
  ['SP', 'PR'],
  ['SP', 'RJ'],
  ['SP', 'MG'],
  ['RJ', 'SP'],
  ['MG', 'SP'],
  ['RS', 'SC'],
  ['SC', 'RS'],
];

function flexNorm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** Correspondência flexível do texto da planilha com um preset (rótulo ou id). */
export function findPresetFaixaByText(text) {
  const flex = flexNorm(text);
  if (!flex) return null;
  for (const p of FAIXAS_KM_OPCOES) {
    const pf = flexNorm(p.label);
    const pid = flexNorm(p.id);
    if (flex === pf || flex === pid) return { ...p };
  }
  if (flex.includes('acima') && flex.includes('500')) {
    const p = FAIXAS_KM_OPCOES.find((x) => x.id === '500+');
    if (p) return { ...p };
  }
  return null;
}

/**
 * Faixa customizada a partir de km mínimo e máximo (ou só mínimo = "acima de min").
 * @param {number} minKm
 * @param {number|null|undefined} maxKm
 */
export function faixaKmFromMinMax(minKm, maxKm) {
  const min = Math.max(1, Math.round(Number(minKm)));
  let max =
    maxKm == null || maxKm === '' || (typeof maxKm === 'number' && !Number.isFinite(maxKm))
      ? null
      : Math.round(Number(maxKm));
  if (max != null && max < min) {
    return faixaKmFromMinMax(max, min);
  }
  const id = max == null ? `acima-${min}` : `de-${min}-a-${max}`;
  const label = max == null ? `Acima de ${min} Km` : `De ${min} Km a ${max} Km`;
  let repKm;
  if (max == null) {
    repKm = Math.min(Math.max(min + 100, min + 1), 900);
  } else {
    repKm = Math.round((min + max) / 2);
  }
  repKm = Math.max(1, repKm);
  return { id, label, repKm, minKm: min, maxKm: max };
}

export { tarifaFaixaPorKm } from './veiculoTarifaAntt';

function parseDec(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function resolverPctOperMarkup(markupRows, nomeClienteEmpresa) {
  const nome = normalizeNomeClienteMarkup(nomeClienteEmpresa);
  if (!nome || !Array.isArray(markupRows)) return 0;
  const manual = markupRows.filter((m) => {
    if (normalizeNomeClienteMarkup(m?.nome_cliente) !== nome) return false;
    const b = m?.aliquota_bruta;
    const r = m?.aliquota_reduzida;
    const empty = (x) => x == null || x === '' || Number(x) === 0;
    return empty(b) && empty(r);
  });
  if (!manual.length) return 0;
  const targetLair = 20;
  let best = manual[0];
  let bestDiff = Infinity;
  for (const row of manual) {
    const lair = parseDec(row?.percentual_markup);
    const d = Math.abs(lair - targetLair);
    if (d < bestDiff) {
      bestDiff = d;
      best = row;
    }
  }
  const base = parseDec(best?.percentual_base);
  if (!(base > 0)) return 0;
  if (base > 1 && base <= 100) return base / 100;
  if (base > 0 && base <= 1) return base;
  return 0;
}

/** Alinhado ao backend: 1 casa decimal, meia para cima. */
export function roundMoney1dp(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10) / 10;
}

/**
 * Frete após markup: (custo × % markup) + custo = custo × (1 + %/100).
 * Descontos em % aplicados em sequência sobre o valor já com markup.
 */
export function markupEfetivoVeiculoRota(markupVeiculoPct, regrasRota, ufO, ufD, veiculoId) {
  let m = Number(markupVeiculoPct);
  if (!Number.isFinite(m)) m = 0;
  let best = null;
  let bestScore = -1;
  for (const r of regrasRota || []) {
    const o = String(r.uf_origem || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    const d = String(r.uf_destino || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    const uo = String(ufO || '')
      .toUpperCase()
      .slice(0, 2);
    const ud = String(ufD || '')
      .toUpperCase()
      .slice(0, 2);
    if (o !== uo || d !== ud) continue;
    const vid = r.veiculo_id;
    const score =
      vid != null && Number(vid) === Number(veiculoId) ? 2 : vid == null || vid === '' ? 1 : 0;
    if (score === 0) continue;
    if (score > bestScore) {
      bestScore = score;
      best = Number(r.percentual_markup) || 0;
    }
  }
  if (best != null && bestScore > 0) return best;
  return m;
}

export function descontoFaixaRegistroAplicaVeiculo(d, veiculoId) {
  const raw = d?.veiculo_ids;
  if (raw == null) return true;
  if (!Array.isArray(raw)) return true;
  if (raw.length === 0) return false;
  return raw.map(Number).includes(Number(veiculoId));
}

/** veiculo_ids ausente = regra geral (todos os veículos). */
export function descontoFaixaRegraGeral(d) {
  return d?.veiculo_ids == null;
}

export function escolherDescontoFaixaParaVeiculo(descontosFaixa, faixaId, veiculoId) {
  const mesma = (descontosFaixa || []).filter((d) => String(d.faixa_id || '') === String(faixaId || ''));
  if (!mesma.length) return null;
  const explicit = mesma.filter(
    (d) => !descontoFaixaRegraGeral(d) && descontoFaixaRegistroAplicaVeiculo(d, veiculoId),
  );
  if (explicit.length) {
    explicit.sort((a, b) => (a.veiculo_ids?.length || 0) - (b.veiculo_ids?.length || 0));
    return explicit[0];
  }
  const geral = mesma.filter((d) => descontoFaixaRegraGeral(d));
  return geral[0] || null;
}

export function calcFreteUmRound(
  baseValor,
  markupPct,
  regrasRota,
  ufO,
  ufD,
  veiculoId,
  descontosFaixa,
  faixaId,
  descontosColuna,
  applyDiscounts = true,
) {
  const mEff = markupEfetivoVeiculoRota(markupPct, regrasRota, ufO, ufD, veiculoId);
  const b = Number(baseValor);
  let v = Number.isFinite(b) ? b * (1 + mEff / 100) : 0;
  let dFaixa = null;
  let dCol = null;
  if (applyDiscounts) {
    let usouFaixa = false;
    const dEsc = escolherDescontoFaixaParaVeiculo(descontosFaixa, faixaId, veiculoId);
    if (dEsc != null) {
      const p = Number(dEsc.percentual_desconto) || 0;
      if (p !== 0) {
        dFaixa = p;
        v *= 1 - p / 100;
        usouFaixa = true;
      }
    }
    if (!usouFaixa) {
      for (const d of descontosColuna || []) {
        if (Number(d.veiculo_id) !== Number(veiculoId)) continue;
        const p = Number(d.percentual_desconto) || 0;
        dCol = p;
        v *= 1 - p / 100;
      }
    }
  }
  const valor = roundMoney1dp(v);
  return {
    valor,
    markup_efetivo_pct: mEff,
    desconto_faixa_pct: dFaixa,
    desconto_coluna_pct: dCol,
    descontos_aplicados: Boolean(applyDiscounts),
  };
}

/** Total frete faixa — 2 casas decimais (exibição R$). */
function roundMoney2dpFaixa(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return NaN;
  return Math.round(x * 100) / 100;
}

/**
 * Total frete faixa de um round.
 * R1: total custo × (1 + markup%). R2+: total frete do round anterior × (1 − desconto%).
 */
export function calcTotalFreteFaixaFromCusto(
  totalCustoFaixa,
  frItem = {},
  opts = {},
) {
  const tc = Number(totalCustoFaixa);
  if (!(tc > 0)) return NaN;
  const ord = Number(frItem?.ordem ?? opts.roundOrdem) || 1;
  const markupR1 = opts.markupR1HeaderPct;

  if (ord <= 1) {
    let m = Number(markupR1);
    if (!Number.isFinite(m)) m = Number(frItem?.markup_efetivo_pct);
    if (!Number.isFinite(m)) m = 0;
    return roundMoney2dpFaixa(tc * (1 + m / 100));
  }

  let base = Number(opts.totalFreteRoundAnterior);
  if (!(base > 0)) return NaN;
  let v = base;
  if (frItem.descontos_aplicados) {
    const df = Number(frItem.desconto_faixa_pct);
    if (Number.isFinite(df) && df !== 0) v *= 1 - df / 100;
    const dc = Number(frItem.desconto_coluna_pct);
    if (Number.isFinite(dc) && dc !== 0) v *= 1 - dc / 100;
  }
  return roundMoney2dpFaixa(v);
}

/** Totais frete faixa por ordem de round (cadeia R1 → R2 → …). */
export function computeTotaisFreteFaixaPorRound(totalCustoFaixa, fretesPorRound, markupR1HeaderPct) {
  const sorted = [...(fretesPorRound || [])].sort(
    (a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0),
  );
  const out = {};
  let prev = null;
  for (const frItem of sorted) {
    const ord = Number(frItem.ordem) || 1;
    const val = calcTotalFreteFaixaFromCusto(totalCustoFaixa, frItem, {
      roundOrdem: ord,
      markupR1HeaderPct,
      totalFreteRoundAnterior: prev,
    });
    out[ord] = val;
    out[String(ord)] = val;
    if (Number.isFinite(val)) prev = val;
  }
  return out;
}

/**
 * M% / D% exibido no total frete faixa — alinhado ao cadastro do round, não ao ratio implícito custo×frete.
 * R1: markup_efetivo_pct ou % do cabeçalho R1 M%. R2+: desconto da faixa/coluna quando houver.
 */
export function badgeMarkupTotalFreteFaixa(frItem, roundOrdem, markupR1HeaderPct) {
  const ord = Number(roundOrdem) || 1;
  if (ord <= 1) {
    const mh = Number(markupR1HeaderPct);
    if (Number.isFinite(mh)) return { tipo: 'M', pct: mh };
    const m = Number(frItem?.markup_efetivo_pct);
    if (Number.isFinite(m)) return { tipo: 'M', pct: m };
    return null;
  }
  if (frItem?.descontos_aplicados) {
    const df = Number(frItem.desconto_faixa_pct);
    if (Number.isFinite(df) && df !== 0) return { tipo: 'D', pct: df };
    const dc = Number(frItem.desconto_coluna_pct);
    if (Number.isFinite(dc) && dc !== 0) return { tipo: 'D', pct: dc };
  }
  return null;
}

/**
 * @param {number[]} vidsOrdered
 * @param {Record<number, number>} custosPorVid
 * @param {{ origem: string, destino: string, faixaId: string }} linhaMeta
 * @param {object[]} roundsDef ordenados por `ordem`; cada round: markup_veiculos, markup_rotas, descontos_faixa, descontos_coluna
 * @returns {{ ordem: number, porVeiculo: Record<number, number> }[]}
 */
export function computeLinhaFretesPorRound(vidsOrdered, custosPorVid, linhaMeta, roundsDef) {
  const { origem, destino, faixaId } = linhaMeta;
  let prev = {};
  for (const vid of vidsOrdered) {
    prev[vid] = Number(custosPorVid[vid]) || 0;
  }
  const out = [];
  const sorted = [...(roundsDef || [])].sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));

  for (const rnd of sorted) {
    const roundOrdem = Number(rnd.ordem) || out.length + 1;
    const applyDisc = roundOrdem >= 2;
    const mk = {};
    for (const x of rnd.markup_veiculos || []) {
      mk[Number(x.veiculo_id)] = Number(x.percentual_markup) || 0;
    }
    const rotas = rnd.markup_rotas || [];
    const dfx = rnd.descontos_faixa || [];
    const dcol = rnd.descontos_coluna || [];
    const porVid = {};
    const porMeta = {};
    for (const vid of vidsOrdered) {
      const base = prev[vid];
      const m = roundOrdem >= 2 ? 0 : mk[Number(vid)] ?? 0;
      const rts = roundOrdem >= 2 ? [] : rotas;
      const det = calcFreteUmRound(base, m, rts, origem, destino, vid, dfx, faixaId, dcol, applyDisc);
      porVid[vid] = det.valor;
      porMeta[vid] = {
        markup_efetivo_pct: det.markup_efetivo_pct,
        desconto_faixa_pct: det.desconto_faixa_pct,
        desconto_coluna_pct: det.desconto_coluna_pct,
        descontos_aplicados: det.descontos_aplicados,
      };
    }
    out.push({ ordem: roundOrdem, porVeiculo: porVid, porVeiculoMeta: porMeta });
    prev = porVid;
  }
  return out;
}

export function headerStylePorTipoVeiculo(tipo) {
  const t = String(tipo || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (t.includes('FIORINO')) return 'bg-amber-300 text-amber-950';
  if (t.includes('VAN')) return 'bg-slate-400 text-slate-900';
  if (t.includes('3/4') || t.includes('3-4')) return 'bg-emerald-400 text-emerald-950';
  if (t.includes('TOCO')) return 'bg-sky-300 text-sky-950';
  /** BITRUCK contém a substring "TRUCK" — precisa vir antes. */
  if (t.includes('BITRUCK')) return 'bg-violet-600 text-white';
  if (t.includes('TRUCK')) return 'bg-blue-500 text-white';
  if (t.includes('CARRETA')) return 'bg-slate-700 text-white';
  return 'bg-slate-500 text-white';
}

export function faixaKmRowKey(origem, destino, faixaId) {
  return `${String(origem || '').toUpperCase()}|${String(destino || '').toUpperCase()}|${faixaId}`;
}

function oneRow(origem, destino, fx, veiculos, roundsDef, frequencia = null, anttTabela = 'A') {
  const rotaLabel = `${origem}-${destino}-${fx.label}`;
  const vidsOrdered = veiculos.map((v) => v.id);
  const byVeiculoId = {};
  const custosPorVid = {};
  for (const v of veiculos) {
    const custo = tarifaFaixaPorKm(fx.repKm, v, anttTabela);
    const c = custo != null ? Number(custo) : 0;
    const val = Number.isFinite(c) ? c : 0;
    custosPorVid[v.id] = val;
    const freqVal =
      frequencia != null && Number.isFinite(Number(frequencia)) ? Number(frequencia) : null;
    byVeiculoId[String(v.id)] = { custo: val, frequencia: freqVal };
  }
  const fretesMeta = computeLinhaFretesPorRound(vidsOrdered, custosPorVid, { origem, destino, faixaId: fx.id }, roundsDef);
  for (const vid of vidsOrdered) {
    byVeiculoId[String(vid)].fretesPorRound = fretesMeta.map((fr) => ({
      ordem: fr.ordem,
      valor: fr.porVeiculo[vid],
      markup_efetivo_pct: fr.porVeiculoMeta?.[vid]?.markup_efetivo_pct,
      desconto_faixa_pct: fr.porVeiculoMeta?.[vid]?.desconto_faixa_pct,
      desconto_coluna_pct: fr.porVeiculoMeta?.[vid]?.desconto_coluna_pct,
      descontos_aplicados: fr.porVeiculoMeta?.[vid]?.descontos_aplicados,
    }));
  }
  return {
    rotaLabel,
    origem,
    destino,
    faixaLabel: fx.label,
    faixaId: fx.id,
    kmRepresentativo: Number(fx.repKm),
    frequencia: frequencia != null && Number.isFinite(Number(frequencia)) ? Number(frequencia) : null,
    byVeiculoId,
  };
}

/** Payload `rounds` para POST/PATCH (um round com todas as faixas de desconto informadas). */
export function buildRoundsPayloadCreate(veiculos, opts = {}) {
  const ids = veiculos.map((v) => v.id);
  const {
    markupByVid = {},
    markupRotas = [],
    descontoFaixaByFid = {},
    descontoColByVid = {},
  } = opts;
  const dfa = Object.entries(descontoFaixaByFid)
    .filter(([, p]) => p != null && String(p).trim() !== '' && Number(p) !== 0)
    .map(([faixa_id, p]) => ({ faixa_id, percentual_desconto: Number(p) || 0 }));
  const dcol = ids
    .map((id) => ({
      veiculo_id: id,
      percentual_desconto: Number(descontoColByVid[String(id)]) || 0,
    }))
    .filter((x) => x.percentual_desconto !== 0);
  return [
    {
      ordem: 1,
      nome: 'Frete KM round 1',
      markup_veiculos: ids.map((id) => ({
        veiculo_id: id,
        percentual_markup: Number(markupByVid[String(id)]) || 0,
      })),
      markup_rotas: markupRotas || [],
      descontos_faixa: dfa,
      descontos_coluna: dcol,
    },
  ];
}

/** Um conjunto de rounds para calcular uma linha da prévia (só desconto da faixa da linha). */
export function buildRoundsDefFromMarkupDescontos(veiculos, markupByVid, markupRotas, descontoFaixaByFid, descontoColByVid, fx) {
  const slice = {};
  const pFaixa = descontoFaixaByFid && descontoFaixaByFid[fx.id];
  if (pFaixa != null && Number(pFaixa) !== 0) slice[fx.id] = pFaixa;
  return buildRoundsPayloadCreate(veiculos, {
    markupByVid,
    markupRotas,
    descontoFaixaByFid: slice,
    descontoColByVid,
  });
}

export function buildSnapshotRows({
  rotasUf,
  kmFaixas,
  veiculos,
  markupByVid,
  markupRotas,
  descontoFaixaByFid,
  descontoColByVid,
  anttTabela = 'A',
}) {
  const rows = [];
  for (const [origem, destino] of rotasUf) {
    for (const fx of kmFaixas) {
      const roundsDef = buildRoundsDefFromMarkupDescontos(
        veiculos,
        markupByVid,
        markupRotas,
        descontoFaixaByFid,
        descontoColByVid,
        fx,
      );
      rows.push(oneRow(origem, destino, fx, veiculos, roundsDef, null, anttTabela));
    }
  }
  return rows;
}

/** Uma linha por tripla (origem, destino, faixa), sem produto cartesiano. */
export function buildSnapshotRowsExplicit(
  triples,
  veiculos,
  markupByVid,
  markupRotas,
  descontoFaixaByFid,
  descontoColByVid,
  anttTabela = 'A',
) {
  const seen = new Set();
  const rows = [];
  for (const t of triples) {
    const origem = String(t.origem || '')
      .toUpperCase()
      .slice(0, 2);
    const destino = String(t.destino || '')
      .toUpperCase()
      .slice(0, 2);
    const fx = t.faixa;
    if (!origem || !destino || !fx?.repKm) continue;
    const key = `${origem}|${destino}|${fx.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const roundsDef = buildRoundsDefFromMarkupDescontos(
      veiculos,
      markupByVid,
      markupRotas,
      descontoFaixaByFid,
      descontoColByVid,
      fx,
    );
    const freq =
      t.frequencia != null && Number.isFinite(Number(t.frequencia)) ? Number(t.frequencia) : null;
    rows.push(oneRow(origem, destino, fx, veiculos, roundsDef, freq, anttTabela));
  }
  return rows;
}

/** Mapa veiculo_id → CC (R$) para a tabela ANTT da cotação. */
export function ccPorVeiculoId(veiculos, anttTabela = 'A') {
  const out = {};
  for (const v of veiculos || []) {
    out[String(v.id)] = ccDoVeiculo(v, anttTabela);
  }
  return out;
}

/** Menor `ordem` entre rounds (round 1 pode não ser literalmente ordem === 1). */
export function menorOrdemRound(rounds) {
  let min = Infinity;
  for (const r of rounds || []) {
    const o = Number(r.ordem);
    if (Number.isFinite(o) && o < min) min = o;
  }
  return Number.isFinite(min) ? min : 1;
}

export function isPrimeiroRoundFrete(ordem, rounds) {
  return Number(ordem) === menorOrdemRound(rounds);
}

/**
 * Monta linhas para exibição a partir do snapshot da API + rascunho de custos e definição de rounds.
 */
export function mergeRowsWithDraft(rows, vidsOrdered, custoDraft, roundsDraft) {
  const rounds =
    roundsDraft?.length > 0
      ? roundsDraft
      : [
          {
            ordem: 1,
            nome: 'Frete KM round 1',
            markup_veiculos: vidsOrdered.map((id) => ({ veiculo_id: id, percentual_markup: 0 })),
            markup_rotas: [],
            descontos_faixa: [],
            descontos_coluna: [],
          },
        ];
  return rows.map((r) => {
    const rowKey =
      r.id != null ? String(r.id) : faixaKmRowKey(r.origem, r.destino, r.faixaId);
    const custosPorVid = {};
    for (const vid of vidsOrdered) {
      const key = String(vid);
      const draftRow = custoDraft[r.id] ?? custoDraft[rowKey];
      const d = draftRow?.[key];
      const orig = r.byVeiculoId?.[key]?.custo;
      custosPorVid[vid] = d !== undefined && d !== '' ? Number(d) : Number(orig) || 0;
    }
    const fretesMeta = computeLinhaFretesPorRound(
      vidsOrdered,
      custosPorVid,
      { origem: r.origem, destino: r.destino, faixaId: r.faixaId },
      rounds,
    );
    const byVeiculoId = {};
    for (const vid of vidsOrdered) {
      byVeiculoId[String(vid)] = {
        custo: custosPorVid[vid],
        fretesPorRound: fretesMeta.map((fr) => ({
          ordem: fr.ordem,
          valor: fr.porVeiculo[vid],
          markup_efetivo_pct: fr.porVeiculoMeta?.[vid]?.markup_efetivo_pct,
          desconto_faixa_pct: fr.porVeiculoMeta?.[vid]?.desconto_faixa_pct,
          desconto_coluna_pct: fr.porVeiculoMeta?.[vid]?.desconto_coluna_pct,
          descontos_aplicados: fr.porVeiculoMeta?.[vid]?.descontos_aplicados,
        })),
      };
    }
    return { ...r, byVeiculoId };
  });
}
