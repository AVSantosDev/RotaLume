


const almostEq = (a, b, eps = 0.015) => Math.abs(Number(a) - Number(b)) <= eps;




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
