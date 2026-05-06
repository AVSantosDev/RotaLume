/**
 * Replica a lógica da aba **Bases** / SPOT (% “base” 57–59) e dos divisores **U** (frete peso = CTRB / U).
 *
 * K11 / L11: percentuais “humanos” (ex.: 12 = 12%, 9,73 = 9,73%). Funil igual ao Excel BR (ordem das SE).
 */

const almostEq = (a, b, eps = 0.015) => Math.abs(Number(a) - Number(b)) <= eps;

/**
 * DIVERSOS (planilha fornecida) — primeiro blocos E(K;L); depois só L.
 * = SE(E(K=20,L=20);59,19; SE(E(K=18,L=18);57,42; ... SE(L=5);57,55;0)))))
 */
export function markupBasePctDiversos(kPct, lPct) {
  const k = Number(kPct);
  const l = Number(lPct);

  if (almostEq(k, 20) && almostEq(l, 20)) return 59.19;
  if (almostEq(k, 18) && almostEq(l, 18)) return 57.42;
  if (almostEq(k, 3) && almostEq(l, 3)) return 57.55;
  if (almostEq(k, 7) && almostEq(l, 7)) return 57.53;
  if (almostEq(k, 12) && almostEq(l, 12)) return 57.48;

  if (almostEq(l, 17)) return 57.43;
  if (almostEq(l, 12)) return 59.23;
  if (almostEq(l, 7)) return 58.5;
  if (almostEq(l, 0)) return 57.59;
  if (almostEq(l, 5)) return 57.55;

  return 0;
}

/**
 * RENAULT — ordem idêntica aos SE antigos (sem o par 20/20).
 */
export function markupBasePctRenault(kPct, lPct) {
  const k = Number(kPct);
  const l = Number(lPct);

  if (almostEq(k, 18) && almostEq(l, 18)) return 57.42;
  if (almostEq(k, 3) && almostEq(l, 3)) return 57.55;
  if (almostEq(k, 7) && almostEq(l, 7)) return 57.53;
  if (almostEq(k, 12) && almostEq(l, 12)) return 57.48;
  if (almostEq(l, 17)) return 57.43;
  if (almostEq(l, 12)) return 59.23;
  if (almostEq(l, 7)) return 58.5;
  if (almostEq(l, 0)) return 57.59;
  if (almostEq(l, 5)) return 57.55;

  return 0;
}

/**
 * @param {string} nomeCliente — ex.: Contratação (tabela)
 * @param {number} kPct — % K11 (referência Excel)
 * @param {number} lPct — % L11 — alíquota ICMS da rota (bruta)
 */
export function markupBasePctPorCliente(nomeCliente, kPct, lPct) {
  const n = (nomeCliente || '').toUpperCase().trim();

  /** Outros perfis futuros podem ser adicionados aqui. Renault mantém malha própria. */
  if (n === 'RENAULT' || n.includes('RENAULT')) return markupBasePctRenault(kPct, lPct);

  /** DIVERSOS e demais: malha SPOT - DIVERSOS fornecida. */
  return markupBasePctDiversos(kPct, lPct);
}

/**
 * Converte o % “base funil” (57–62) em fator próximo ao da planilha.
 * Calibrado em 59,23 → W ≈ 1,20096 (constante herdada das primeiras cópias).
 */
export function fatorWDesdeMarkupBasePct(markupBasePct) {
  const m = Number(markupBasePct);
  if (!Number.isFinite(m) || m <= 0) return 0;
  if (m > 1.5 && m < 5) return m;

  const K = 59.23 * 0.20096;
  return 1 + K / m;
}

/**
 * Divisores padrão C26→U (fallback se Configurações não trouxer U explícito em percentual_base).
 * Espelho do tierMap histórico (20→1,201 …).
 */
export const DIVERSOS_LAIR_DIVISORES_PADRAO = {
  20: 1.201,
  18: 1.2195,
  15: 1.1765,
  12: 1.1364,
  10: 1.1111,
};

/**
 * Escolhe o divisor **U** do frete peso (CTRB/U), na ordem Excel / operação:
 *
 * 1. `percentual_base` cadastrado entre ~1 e 5 → **uso direto** (células Bases U5..U9 copiadas para Config).
 * 2. `percentual_base` entre ~45 e 62 → interpretado como % do funil (59,23…) → `fatorWDesdeMarkupBasePct`.
 * 3. Resultado do **funil** K/L → mesmo fator W.
 * 4. Fallback: mapa LAIR **C26** (20 / 18 / 15 / 12 / 10) → divisor padrão.
 */
export function resolverDivisorFreteCtrb(params) {
  const {
    lairPct,
    funnelPct,
    percentualBaseDb,
    tierFallback = DIVERSOS_LAIR_DIVISORES_PADRAO,
  } = params ?? {};

  const baseRaw = Number(percentualBaseDb);

  if (Number.isFinite(baseRaw) && baseRaw > 1.001 && baseRaw < 5.0)
    return baseRaw;

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
  const tier =
    Number.isFinite(L) &&
    keys.find((k) => almostEq(k, L, 0.02));

  const d = tier != null ? Number(tierFallback[tier]) : NaN;

  return Number.isFinite(d) && d > 1.0001
    ? d
    : DIVERSOS_LAIR_DIVISORES_PADRAO[20] ?? 1.201;
}
