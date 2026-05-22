import { calcTotalCustoFaixaAntt } from './anttFaixaKmCalc';
import {
  calcTotalFreteFaixaFromCusto,
  computeTotaisFreteFaixaPorRound,
  ccPorVeiculoId,
} from './faixaKmHelpers';
import { frequenciaDaCelula, kmTotalDaCelula } from './faixaKmFrequencia';
import { aliquotasIcmsPorRota, calcularDreSpotLair, calcularLairPctCelulaFaixaKm } from './dreSpotCalc';

function freteItemDoRound(fretesPorRound, roundOrdem) {
  const fr = fretesPorRound || [];
  if (!fr.length) return {};
  if (roundOrdem === 'last' || roundOrdem == null || roundOrdem === '') {
    return fr[fr.length - 1] || {};
  }
  const o = Number(roundOrdem);
  const hit = fr.find((x) => Number(x.ordem) === o);
  return hit || fr[fr.length - 1] || {};
}

/**
 * Soma a DRE célula a célula (cada par rota × veículo × faixa) e devolve totais consolidados.
 */
export function agregarDreFaixaKm({
  rows = [],
  veiculos = [],
  dreCtx,
  filtros = {},
  editFrequencia = {},
  frequenciaByRowKey = {},
  editKmTotal = {},
  kmTotalByCellKey = {},
  anttTabela = 'A',
  markupR1ByVeiculoId = {},
}) {
  const ccMap = ccPorVeiculoId(veiculos, anttTabela);
  const faixaId = filtros.faixaId ?? '__all__';
  const veiculoId = filtros.veiculoId ?? '__all__';
  const roundOrdem = filtros.roundOrdem ?? 'last';

  let rowsF = rows;
  if (faixaId && faixaId !== '__all__') {
    rowsF = rowsF.filter((r) => String(r.faixaId) === String(faixaId));
  }

  const veiculosF =
    veiculoId && veiculoId !== '__all__'
      ? veiculos.filter((v) => String(v.id) === String(veiculoId))
      : veiculos;

  const acc = {
    rob: 0,
    icmsIss: 0,
    impFed: 0,
    credito: 0,
    rol: 0,
    cv: 0,
    cf: 0,
    csp: 0,
    lo: 0,
    despFin: 0,
    despComercial: 0,
    lairValor: 0,
    creditoPct: null,
    despFinPct: null,
    despComercialPct: null,
  };

  let celulas = 0;
  let totalCtrb = 0;
  let totalFrete = 0;
  let somaLairPctRol = 0;
  let somaRolPeso = 0;

  for (const r of rowsF) {
    const km = Number(r.kmRepresentativo) || 0;
    if (!(km > 0)) continue;
    for (const v of veiculosF) {
      const freq = frequenciaDaCelula(r, v.id, editFrequencia, frequenciaByRowKey);
      const cell = r.byVeiculoId?.[String(v.id)] || {};
      const custoKm = Number(cell.custo) || 0;
      const cc = ccMap[String(v.id)] ?? 0;
      const kmTotal = kmTotalDaCelula(r, v.id, editKmTotal, kmTotalByCellKey, km, freq);
      const totalCustoFaixa = calcTotalCustoFaixaAntt({
        kmRepresentativo: km,
        ccd: custoKm,
        cc,
        frequencia: freq,
        kmTotal,
      });
      const mkR1 = markupR1ByVeiculoId[String(v.id)];
      const totaisPorRound = computeTotaisFreteFaixaPorRound(
        totalCustoFaixa,
        cell.fretesPorRound,
        mkR1,
      );
      const sortedFr = [...(cell.fretesPorRound || [])].sort(
        (a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0),
      );
      const ro =
        roundOrdem === 'last' || roundOrdem == null || roundOrdem === ''
          ? Number(sortedFr[sortedFr.length - 1]?.ordem) || 1
          : Number(roundOrdem);
      const totalFreteFaixa = totaisPorRound[ro] ?? totaisPorRound[String(ro)];
      if (!(totalCustoFaixa > 0 && Number.isFinite(totalFreteFaixa) && totalFreteFaixa > 0)) continue;

      const ctrb = totalCustoFaixa;
      const frete = totalFreteFaixa;
      totalCtrb += ctrb;
      totalFrete += frete;

      const origemUf = String(r.origem || '')
        .toUpperCase()
        .slice(0, 2);
      const { bruta, reduzida } = aliquotasIcmsPorRota(
        r.origem,
        r.destino,
        dreCtx?.icmsByOrigem?.[origemUf],
      );

      const { dre } = calcularDreSpotLair({
        listaImpostos: dreCtx?.listaImpostos,
        listaDespesas: dreCtx?.listaDespesas,
        listaRepresentantes: dreCtx?.listaRepresentantes,
        representanteId: dreCtx?.representanteId,
        prazoPagamento: dreCtx?.prazoPagamento,
        ufOrigem: origemUf,
        aliquotaIcmsBruta: bruta,
        aliquotaIcmsReduzida: reduzida,
        ctrb,
        sIcms: { fretePeso: frete },
      });

      if (!dre) continue;

      const pctCel = calcularLairPctCelulaFaixaKm({
        ctrb: totalCustoFaixa,
        fretePesoSIcms: totalFreteFaixa,
        origem: r.origem,
        destino: r.destino,
        icmsByOrigem: dreCtx?.icmsByOrigem,
        listaImpostos: dreCtx?.listaImpostos,
        listaDespesas: dreCtx?.listaDespesas,
        listaRepresentantes: dreCtx?.listaRepresentantes,
        representanteId: dreCtx?.representanteId,
        prazoPagamento: dreCtx?.prazoPagamento,
      });
      if (pctCel != null && dre.rol > 0) {
        somaLairPctRol += pctCel * dre.rol;
        somaRolPeso += dre.rol;
      }

      acc.rob += dre.rob;
      acc.icmsIss += dre.icmsIss;
      acc.impFed += dre.impFed;
      acc.credito += dre.credito;
      acc.rol += dre.rol;
      acc.cv += dre.cv;
      acc.cf += dre.cf;
      acc.csp += dre.csp;
      acc.lo += dre.lo;
      acc.despFin += dre.despFin;
      acc.despComercial += dre.despComercial;
      acc.lairValor += dre.lairValor;
      if (acc.creditoPct == null && dre.creditoPct != null) acc.creditoPct = dre.creditoPct;
      if (acc.despFinPct == null && dre.despFinPct != null) acc.despFinPct = dre.despFinPct;
      if (acc.despComercialPct == null && dre.despComercialPct != null) {
        acc.despComercialPct = dre.despComercialPct;
      }
      celulas += 1;
    }
  }

  const lairPctConsolidado = acc.rol !== 0 ? (acc.lairValor / acc.rol) * 100 : 0;
  const lairPctGrade =
    somaRolPeso > 0 ? somaLairPctRol / somaRolPeso : lairPctConsolidado;
  const lairPct = celulas > 0 ? lairPctGrade : 0;

  return {
    dre: celulas > 0 ? { ...acc, lairPct, lairPctConsolidado } : null,
    meta: {
      celulas,
      linhas: rowsF.length,
      veiculos: veiculosF.length,
      totalCtrb,
      totalFrete,
      roundOrdem,
      lairPctConsolidado: celulas > 1 ? lairPctConsolidado : null,
    },
  };
}
