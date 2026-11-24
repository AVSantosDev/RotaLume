/** Colunas fixas à esquerda da grade (antes de Desc. faixa / veículos). */
export const FAIXA_KM_BASE_COL_KEYS = ['rota', 'origem', 'destino', 'faixa', 'frequencia'];

export const FAIXA_KM_BASE_COL_LABELS = {
  rota: 'Rota',
  origem: 'Origem',
  destino: 'Destino',
  faixa: 'Faixa de KM',
  frequencia: 'Frequência',
};

/** Uma letra quando a coluna está bem estreita. */
export const FAIXA_KM_BASE_COL_LETTER = {
  rota: 'R',
  origem: 'O',
  destino: 'D',
  faixa: 'F',
  frequencia: 'F',
};

/** Abreviação curta (coluna média). */
export const FAIXA_KM_BASE_COL_ABBREV = {
  rota: 'Rot',
  origem: 'Ori',
  destino: 'Des',
  faixa: 'Fx KM',
  frequencia: 'Freq',
};

/** Largura (px) ≤ este valor → só a primeira letra no cabeçalho/filtro. */
export const FAIXA_KM_BASE_COL_ONE_LETTER_MAX_PX = 56;

/** Largura (px) ≤ este valor → abreviação curta; acima disso → rótulo completo. */
export const FAIXA_KM_BASE_COL_ABBREV_MAX_PX = 88;

/**
 * Rótulo do cabeçalho/filtro conforme largura da coluna (redimensionamento).
 * @param {string} key
 * @param {number} [widthPx]
 */
export function labelBaseColHeader(key, widthPx) {
  const full = FAIXA_KM_BASE_COL_LABELS[key] || '';
  const w = Number(widthPx);
  const width = Number.isFinite(w) && w > 0 ? w : DEFAULT_FAIXA_KM_BASE_COL_WIDTHS[key] || 100;

  if (width <= FAIXA_KM_BASE_COL_ONE_LETTER_MAX_PX) {
    return FAIXA_KM_BASE_COL_LETTER[key] || full.charAt(0).toUpperCase() || '';
  }
  if (width <= FAIXA_KM_BASE_COL_ABBREV_MAX_PX) {
    return FAIXA_KM_BASE_COL_ABBREV[key] || full;
  }
  return full;
}

export const DEFAULT_FAIXA_KM_BASE_COL_WIDTHS = {
  rota: 148,
  origem: 52,
  destino: 52,
  faixa: 168,
  frequencia: 96,
};

const STORAGE_KEY = 'faixaKmTableBaseLayout_v1';

export function mergeBaseColOrder(saved) {
  const valid = new Set(FAIXA_KM_BASE_COL_KEYS);
  const out = [];
  for (const k of saved || []) {
    if (valid.has(k) && !out.includes(k)) out.push(k);
  }
  for (const k of FAIXA_KM_BASE_COL_KEYS) {
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

export function loadFaixaKmBaseLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        order: [...FAIXA_KM_BASE_COL_KEYS],
        widths: { ...DEFAULT_FAIXA_KM_BASE_COL_WIDTHS },
      };
    }
    const data = JSON.parse(raw);
    return {
      order: mergeBaseColOrder(data.order),
      widths: { ...DEFAULT_FAIXA_KM_BASE_COL_WIDTHS, ...(data.widths || {}) },
    };
  } catch {
    return {
      order: [...FAIXA_KM_BASE_COL_KEYS],
      widths: { ...DEFAULT_FAIXA_KM_BASE_COL_WIDTHS },
    };
  }
}

export function saveFaixaKmBaseLayout(order, widths) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ order: mergeBaseColOrder(order), widths }),
    );
  } catch {
    /* ignore quota */
  }
}

export function resetFaixaKmBaseLayoutStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
