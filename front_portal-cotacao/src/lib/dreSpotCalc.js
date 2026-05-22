/**
 * DRE — Base Lucro (espelho da planilha SPOT / Nova Cotação).
 * Usado na Nova Cotação (composição completa) e na cotação por faixa de KM (só frete peso).
 */

export function normalizarNumero(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'string') {
    const n = parseFloat(v.toString().replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

export function buildImpostosMap(listaImpostos) {
  return new Map(
    (listaImpostos || [])
      .filter((i) => i?.nome)
      .map((i) => [i.nome.toUpperCase().trim(), normalizarNumero(i.aliquota)]),
  );
}

const UFS_ORIGEM_REDUZ_80 = new Set(['SP', 'PR', 'MG', 'SC', 'BA']);

/** Alíquotas ICMS bruta e reduzida (mesma regra da Nova Cotação). */
export function aliquotasIcmsPorRota(origem, destino, icmsRowsForOrigem) {
  const origemUf = String(origem || '')
    .toUpperCase()
    .trim()
    .slice(0, 2);
  const destUf = String(destino || '')
    .toUpperCase()
    .trim()
    .slice(0, 2);
  const rows = Array.isArray(icmsRowsForOrigem) ? icmsRowsForOrigem : [];
  const achou = rows.find((r) => String(r.destino || '').toUpperCase().trim() === destUf);
  const bruta = achou ? normalizarNumero(achou.aliquota) : 12;
  const reduzida = UFS_ORIGEM_REDUZ_80.has(origemUf) ? Math.round(bruta * 0.8 * 100) / 100 : bruta;
  return { bruta, reduzida, origemUf, destUf };
}

function grossUpIcms(valorSIcms, L11) {
  if (valorSIcms === 0) return 0;
  if (L11 <= 0) return valorSIcms;
  return valorSIcms / (1 - L11);
}

/**
 * Calcula DRE e % LAIR (= LAIR / ROL).
 *
 * @param {object} params
 * @param {Array} params.listaImpostos
 * @param {Array} params.listaDespesas
 * @param {Array} [params.listaRepresentantes]
 * @param {string|number} [params.representanteId]
 * @param {number} params.prazoPagamento — dias
 * @param {string} params.ufOrigem — UF origem da rota (2 letras)
 * @param {number} params.aliquotaIcmsBruta — %
 * @param {number} params.aliquotaIcmsReduzida — %
 * @param {number} params.ctrb — CTRB orçado (custo)
 * @param {object} [params.sIcms] — composição S/ICMS; default só fretePeso
 * @returns {{ dre: object|null, lairPct: number, lairPctStr: string }}
 */
export function calcularDreSpotLair(params) {
  const {
    listaImpostos = [],
    listaDespesas = [],
    listaRepresentantes = [],
    representanteId = '',
    prazoPagamento = 30,
    ufOrigem = '',
    aliquotaIcmsBruta = 0,
    aliquotaIcmsReduzida = 0,
    ctrb = 0,
    sIcms: sIcmsIn,
  } = params;

  const brutaPct = normalizarNumero(aliquotaIcmsBruta);
  const L11 = brutaPct / 100;
  const reduzidaDrePct = normalizarNumero(aliquotaIcmsReduzida);

  const sIcms = {
    fretePeso: normalizarNumero(sIcmsIn?.fretePeso),
    seguro: normalizarNumero(sIcmsIn?.seguro),
    gris: normalizarNumero(sIcmsIn?.gris),
    pedagio: normalizarNumero(sIcmsIn?.pedagio),
    carga: normalizarNumero(sIcmsIn?.carga),
    adicional: normalizarNumero(sIcmsIn?.adicional),
  };
  sIcms.total =
    sIcms.fretePeso + sIcms.seguro + sIcms.gris + sIcms.pedagio + sIcms.carga + sIcms.adicional;

  const cIcms = {
    fretePeso: grossUpIcms(sIcms.fretePeso, L11),
    seguro: grossUpIcms(sIcms.seguro, L11),
    gris: grossUpIcms(sIcms.gris, L11),
    pedagio: sIcms.pedagio,
    carga: grossUpIcms(sIcms.carga, L11),
    adicional: grossUpIcms(sIcms.adicional, L11),
    total: 0,
  };
  cIcms.total =
    cIcms.fretePeso + cIcms.seguro + cIcms.gris + cIcms.pedagio + cIcms.carga + cIcms.adicional;

  const impostosMap = buildImpostosMap(listaImpostos);
  const rob = cIcms.fretePeso + cIcms.seguro + cIcms.gris;

  const pis = impostosMap.get('PIS') || 0;
  const cofins = impostosMap.get('COFINS') || 0;
  const pisCofinsPct = pis > 0 || cofins > 0 ? pis + cofins : impostosMap.get('PIS/COFINS') || 0;
  const cprbPct = impostosMap.get('CPRB') || 0;

  const despPctByNome = (nomeExato) => {
    const alvo = String(nomeExato || '').toUpperCase().trim();
    for (const d of listaDespesas || []) {
      if ((d?.unidade || '').toUpperCase() !== 'PERCENTUAL') continue;
      const nm = String(d?.nome || '').toUpperCase().trim();
      if (nm === alvo) return normalizarNumero(d.valor);
    }
    return 0;
  };
  const cgoPct = despPctByNome('CGO');
  const despAdmPct = despPctByNome('DESP.ADM');
  const financeiroPct = despPctByNome('FINANCEIRO');

  const origemUfDre = String(ufOrigem || '')
    .toUpperCase()
    .trim()
    .slice(0, 2);
  const baseIcmsAllIn =
    origemUfDre === 'PR'
      ? Math.max(0, (Number(cIcms.total) || 0) - (Number(cIcms.pedagio) || 0))
      : Math.max(0, Number(sIcms.total) || 0);
  const aliqBrutaPct = brutaPct > 0 ? brutaPct : 0;
  const icmsAllInValor = aliqBrutaPct > 0 ? baseIcmsAllIn * (aliqBrutaPct / 100) : 0;

  const icmsIss = -(rob * (reduzidaDrePct / 100));
  const impFed = -((rob - icmsAllInValor) * (pisCofinsPct / 100) + rob * (cprbPct / 100));
  const creditoPct = pisCofinsPct * 0.75;
  const credito = normalizarNumero(ctrb) * (creditoPct / 100);

  const rol = rob + icmsIss + impFed + credito;
  const cv = -normalizarNumero(ctrb);
  const cf = -(rol * (cgoPct / 100));
  const csp = cv + cf;
  const lo = rol + csp;

  const prazoDias = Math.max(0, normalizarNumero(prazoPagamento));
  const despFinPctCombinado = (prazoDias / 30) * financeiroPct + despAdmPct;
  const despFinPct = -(despFinPctCombinado / 100);
  const despFin = rol * despFinPct;

  const repSel = (listaRepresentantes || []).find(
    (r) => representanteId && String(r.id) === String(representanteId),
  );
  const despComercialPctPos = repSel ? normalizarNumero(repSel.percentual_comissao) : 0;
  const despComercialPct = despComercialPctPos > 0 ? -despComercialPctPos / 100 : 0;
  const despComercial = despComercialPctPos > 0 ? rol * despComercialPct : 0;

  const lairValor = lo + despFin + despComercial;
  const lairPct = rol !== 0 ? (lairValor / rol) * 100 : 0;

  const ctrbN = normalizarNumero(ctrb);
  if (!(rob > 0 && ctrbN > 0)) {
    return { dre: null, lairPct: 0, lairPctStr: '0,00' };
  }

  const lairPctStr = Number.isFinite(lairPct)
    ? lairPct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00';

  return {
    dre: {
      rob,
      icmsIss,
      impFed,
      credito,
      rol,
      cv,
      cf,
      csp,
      lo,
      despFin,
      despComercial,
      lairValor,
      lairPct,
      creditoPct,
      despFinPct: despFinPct * 100,
      despComercialPct: despComercialPct * 100,
      reduzidaDrePct,
    },
    lairPct,
    lairPctStr,
  };
}

/**
 * LAIR % (sobre ROL) a partir de CTRB e frete peso S/ICMS — valores podem ser R$/km ou totais da faixa.
 */
export function calcularLairPctCelulaFaixaKm({
  custoKm,
  freteKmUltimoRound,
  ctrb,
  fretePesoSIcms,
  origem,
  destino,
  icmsByOrigem = {},
  listaImpostos,
  listaDespesas,
  listaRepresentantes,
  representanteId,
  prazoPagamento,
}) {
  const ctrbVal = ctrb !== undefined && ctrb !== '' ? normalizarNumero(ctrb) : normalizarNumero(custoKm);
  const freteVal =
    fretePesoSIcms !== undefined && fretePesoSIcms !== ''
      ? normalizarNumero(fretePesoSIcms)
      : normalizarNumero(freteKmUltimoRound);
  if (!(ctrbVal > 0 && freteVal > 0)) return null;

  const origemUf = String(origem || '')
    .toUpperCase()
    .slice(0, 2);
  const { bruta, reduzida } = aliquotasIcmsPorRota(origem, destino, icmsByOrigem[origemUf]);

  const { lairPct } = calcularDreSpotLair({
    listaImpostos,
    listaDespesas,
    listaRepresentantes,
    representanteId,
    prazoPagamento,
    ufOrigem: origemUf,
    aliquotaIcmsBruta: bruta,
    aliquotaIcmsReduzida: reduzida,
    ctrb: ctrbVal,
    sIcms: { fretePeso: freteVal },
  });

  return Number.isFinite(lairPct) ? lairPct : null;
}
