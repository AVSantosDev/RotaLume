const almostEq = (a, b, eps = 0.015) => Math.abs(Number(a) - Number(b)) <= eps;

/** Chave única para bater nome da tabela (form) com nome_cliente no Postgres (acentos, caixa). */
export function normalizeNomeClienteMarkup(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Malhas SPOT — conforme fórmulas SE do Excel.
 * - DIVERSOS varia por LAIR e inclui o par (20,20).
 * - Renault+ (e MAHLE/NIDEC/ROD...) varia por LAIR e não tem o par (20,20).
 */
const DIVERSOS_POR_LAIR = {
  20: {
    pairs: [
      [20, 20, 59.19],
      [18, 18, 57.42],
      [3, 3, 57.55],
      [7, 7, 57.53],
      [12, 12, 57.48],
    ],
    lOnly: [
      [17, 57.43],
      [12, 59.23],
      [7, 58.5],
      [0, 57.59],
      [5, 57.55],
    ],
  },
  18: {
    pairs: [
      [20, 20, 61.14],
      [18, 18, 59.37],
      [3, 3, 59.49],
      [7, 7, 59.48],
      [12, 12, 59.43],
    ],
    lOnly: [
      [17, 59.38],
      [12, 61.24],
      [7, 60.45],
      [0, 59.54],
      [5, 59.5],
    ],
  },
  15: {
    pairs: [
      [20, 20, 64.0],
      [18, 18, 62.31],
      [3, 3, 62.46],
      [7, 7, 62.43],
      [12, 12, 62.37],
    ],
    lOnly: [
      [17, 62.32],
      [12, 64.27],
      [7, 63.4],
      [0, 62.49],
      [5, 62.45],
    ],
  },
  12: {
    pairs: [
      [20, 20, 67.04],
      [18, 18, 65.26],
      [3, 3, 65.42],
      [7, 7, 65.38],
      [12, 12, 65.33],
    ],
    lOnly: [
      [17, 65.27],
      [12, 67.31],
      [7, 66.48],
      [0, 65.45],
      [5, 65.4],
    ],
  },
  10: {
    pairs: [
      [20, 20, 69.02],
      [18, 18, 67.23],
      [3, 3, 67.38],
      [7, 7, 67.36],
      [12, 12, 67.31],
    ],
    lOnly: [
      [17, 67.24],
      [12, 69.35],
      [7, 68.47],
      [0, 67.43],
      [5, 67.38],
    ],
  },
};

const RENAULT_POR_LAIR = {
  20: {
    pairs: [
      [18, 18, 57.42],
      [3, 3, 57.55],
      [7, 7, 57.53],
      [12, 12, 57.48],
    ],
    lOnly: [
      [17, 57.43],
      [12, 59.23],
      [7, 58.5],
      [0, 57.59],
      [5, 57.55],
    ],
  },
  18: {
    pairs: [
      [18, 18, 59.37],
      [3, 3, 59.49],
      [7, 7, 59.48],
      [12, 12, 59.43],
    ],
    lOnly: [
      [17, 59.38],
      [12, 61.24],
      [7, 60.45],
      [0, 59.54],
      [5, 59.5],
    ],
  },
  15: {
    pairs: [
      [18, 18, 62.31],
      [3, 3, 62.46],
      [7, 7, 62.43],
      [12, 12, 62.37],
    ],
    lOnly: [
      [17, 62.32],
      [12, 64.27],
      [7, 63.4],
      [0, 62.49],
      [5, 62.45],
    ],
  },
  12: {
    pairs: [
      [18, 18, 65.26],
      [3, 3, 65.42],
      [7, 7, 65.38],
      [12, 12, 65.33],
    ],
    lOnly: [
      [17, 65.27],
      [12, 67.31],
      [7, 66.48],
      [0, 65.45],
      [5, 65.4],
    ],
  },
  10: {
    pairs: [
      [18, 18, 67.23],
      [3, 3, 67.38],
      [7, 7, 67.36],
      [12, 12, 67.31],
    ],
    lOnly: [
      [17, 67.24],
      [12, 69.35],
      [7, 68.47],
      [0, 67.43],
      [5, 67.38],
    ],
  },
};

function tierFromLair(lairPct) {
  const Lair = Number(lairPct);
  if (!Number.isFinite(Lair)) return 20;
  const tiers = [20, 18, 15, 12, 10];
  const t = tiers.find((x) => almostEq(Lair, x, 0.02));
  return t ?? 20;
}

function baseFromMap(map, lairPct, kPct, lPct) {
  const tier = tierFromLair(lairPct);
  const row = map[tier];
  if (!row) return 0;
  const k = Number(kPct);
  const l = Number(lPct);

  for (const [kk, ll, val] of row.pairs) {
    if (almostEq(k, kk) && almostEq(l, ll)) return val;
  }
  for (const [ll, val] of row.lOnly) {
    if (almostEq(l, ll)) return val;
  }
  return 0;
}

/** Malha SPOT — DIVERSOS (planilha): depende de LAIR e inclui K=L=20%. */
export function markupBasePctDiversos(kPct, lPct, lairPct) {
  return baseFromMap(DIVERSOS_POR_LAIR, lairPct, kPct, lPct);
}

/**
 * Malha SPOT — Renault e clientes com a mesma árvore SE (sem o par K=L=20%).
 * BOTICARIO tem malha própria por LAIR — não entra aqui.
 */
export function markupBasePctRenault(kPct, lPct, lairPct) {
  return baseFromMap(RENAULT_POR_LAIR, lairPct, kPct, lPct);
}

/**
 * Resolve a malha por tipo configurável (preferencial).
 * @param {'DIVERSOS'|'RENAULT'|'BOTICARIO'|'CUSTOM'|string} malhaTipo
 */
export function markupBasePctPorMalha(malhaTipo, kPct, lPct, lairPct) {
  const t = normalizeNomeClienteMarkup(malhaTipo || '');
  if (t === 'BOTICARIO') return markupBasePctBoticario(lairPct ?? 0, kPct, lPct);
  if (t === 'RENAULT') return markupBasePctRenault(kPct, lPct, lairPct);
  if (t === 'CUSTOM') return 0;
  return markupBasePctDiversos(kPct, lPct, lairPct);
}

/**
 * BOTICARIO — percentual base (%) depende de LAIR desejada (C26) e K11/L11.
 * Valores conforme fórmulas SE da planilha SPOT BOTICARIO por faixa de LAIR.
 */
const BOTICARIO_POR_LAIR = {
  20: {
    pairs: [
      [18, 18, 57.42],
      [3, 3, 57.55],
      [7, 7, 57.53],
      [12, 12, 57.48],
    ],
    lOnly: [
      [17, 57.43],
      [12, 59.23],
      [7, 58.5],
      [0, 57.59],
      [5, 57.55],
    ],
  },
  18: {
    pairs: [
      [18, 18, 59.37],
      [3, 3, 59.49],
      [7, 7, 59.48],
      [12, 12, 59.43],
    ],
    lOnly: [
      [17, 59.38],
      [12, 61.24],
      [7, 60.45],
      [0, 59.54],
      [5, 59.5],
    ],
  },
  15: {
    pairs: [
      [18, 18, 62.31],
      [3, 3, 62.46],
      [7, 7, 62.43],
      [12, 12, 62.37],
    ],
    lOnly: [
      [17, 62.32],
      [12, 64.27],
      [7, 63.4],
      [0, 62.49],
      [5, 62.45],
    ],
  },
  12: {
    pairs: [
      [18, 18, 65.26],
      [3, 3, 65.42],
      [7, 7, 65.38],
      [12, 12, 65.33],
    ],
    lOnly: [
      [17, 65.27],
      [12, 67.31],
      [7, 66.48],
      [0, 65.45],
      [5, 65.4],
    ],
  },
  10: {
    pairs: [
      [18, 18, 67.23],
      [3, 3, 67.38],
      [7, 7, 67.36],
      [12, 12, 67.31],
    ],
    lOnly: [
      [17, 67.24],
      [12, 69.35],
      [7, 68.47],
      [0, 67.43],
      [5, 67.38],
    ],
  },
};

export function isClienteBoticario(nomeCliente) {
  const n = normalizeNomeClienteMarkup(nomeCliente);
  return n === 'BOTICARIO' || n.includes('BOTICARIO');
}

export function markupBasePctBoticario(lairPct, kPct, lPct) {
  const Lair = Number(lairPct);
  if (!Number.isFinite(Lair)) return 0;
  const tiers = [20, 18, 15, 12, 10];
  const tier = tiers.find((t) => almostEq(Lair, t, 0.02));
  if (tier == null) return 0;

  const row = BOTICARIO_POR_LAIR[tier];
  const k = Number(kPct);
  const l = Number(lPct);

  for (const [kk, ll, val] of row.pairs) {
    if (almostEq(k, kk) && almostEq(l, ll)) return val;
  }
  for (const [ll, val] of row.lOnly) {
    if (almostEq(l, ll)) return val;
  }
  return 0;
}

/** Nomes de cliente — mesma malha Renault; BOTICARIO tratado à parte. */
const MALHA_RENAULT_TAGS = ['RENAULT', 'MAHLE', 'ROD CNH', 'NIDEC', 'ROD IVECO'];

function usaMalhaRenault(nomeCliente) {
  const n = normalizeNomeClienteMarkup(nomeCliente);
  if (!n) return false;
  if (isClienteBoticario(n)) return false;
  if (n === 'RENAULT' || n.includes('RENAULT')) return true;
  return MALHA_RENAULT_TAGS.some((tag) => n === tag || n.includes(tag));
}

/**
 * @param {string} nomeCliente
 * @param {number} kPct — K11 reduzida
 * @param {number} lPct — L11 bruta
 * @param {number} [lairPct] — LAIR desejada (C26); obrigatória para BOTICARIO
 */
export function markupBasePctPorCliente(nomeCliente, kPct, lPct, lairPct) {
  if (isClienteBoticario(nomeCliente)) {
    const b = markupBasePctBoticario(lairPct ?? 0, kPct, lPct);
    if (b > 0) return b;
    return markupBasePctRenault(kPct, lPct, lairPct);
  }
  if (usaMalhaRenault(nomeCliente)) return markupBasePctRenault(kPct, lPct, lairPct);
  return markupBasePctDiversos(kPct, lPct, lairPct);
}

export function fatorWDesdeMarkupBasePct(markupBasePct) {
  const m = Number(markupBasePct);
  if (!Number.isFinite(m) || m <= 0) return 0;
  if (m > 1.5 && m < 5) return m;

  const K = 59.23 * 0.20096;
  return 1 + K / m;
}

export const DIVERSOS_LAIR_DIVISORES_PADRAO = {
  20: 1.201,
  18: 1.2195,
  15: 1.1765,
  12: 1.1364,
  10: 1.1111,
};

export function resolverDivisorFreteCtrb(params) {
  const {
    lairPct,
    funnelPct,
    percentualBaseDb,
    tierFallback = DIVERSOS_LAIR_DIVISORES_PADRAO,
  } = params ?? {};

  const baseRaw = Number(percentualBaseDb);

  if (Number.isFinite(baseRaw) && baseRaw > 1.001 && baseRaw < 5.0) return baseRaw;

  if (Number.isFinite(baseRaw) && baseRaw >= 45 && baseRaw <= 62) {
    const w = fatorWDesdeMarkupBasePct(baseRaw);
    if (w > 1.0001) return w;
  }

  const funnel = Number(funnelPct);
  if (Number.isFinite(funnel) && funnel > 0) {
    const w = fatorWDesdeMarkupBasePct(funnel);
    if (w > 1.0001) return w;
  }

  const L = Number(lairPct);
  const keys = Object.keys(tierFallback).map(Number).sort((a, b) => b - a);
  const tier = Number.isFinite(L) && keys.find((k) => almostEq(k, L, 0.02));

  const d = tier != null ? Number(tierFallback[tier]) : NaN;

  return Number.isFinite(d) && d > 1.0001 ? d : DIVERSOS_LAIR_DIVISORES_PADRAO[20] ?? 1.201;
}
