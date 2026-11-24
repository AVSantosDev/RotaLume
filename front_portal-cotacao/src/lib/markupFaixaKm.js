import {
  isClienteBoticario,
  markupBasePctPorCliente,
  markupBasePctPorMalha,
  normalizeNomeClienteMarkup,
} from './markupSpotLookup';
import { aliquotasIcmsPorRota, normalizarNumero } from './dreSpotCalc';

function almostEq(a, b, eps = 0.02) {
  return Math.abs(normalizarNumero(a) - normalizarNumero(b)) <= eps;
}

/** Frete km = custo × (1 + M%/100) ⇔ M% = (1 / pctOperacional − 1) × 100 */
export function markupPctFromPctOperacional(pctOperFrac) {
  let f = normalizarNumero(pctOperFrac);
  if (f > 1 && f <= 100) f /= 100;
  if (!(f > 0 && f < 1)) return 0;
  const m = (1 / f - 1) * 100;
  return Math.round(m * 100) / 100;
}

/**
 * Percentual operacional (U da planilha) e markup % equivalente — mesma regra da Nova Cotação.
 */
export function resolverPctOperacionalSpot({
  listaMarkupConfig = [],
  malhaSpotTipo = '',
  nomeTabela = '',
  lairDesejada = 20,
  aliquotaBruta = 0,
  aliquotaReduzida = 0,
}) {
  const nome = normalizeNomeClienteMarkup(nomeTabela);
  const brutaPct = normalizarNumero(aliquotaBruta);
  const reduzidaPctAtual = normalizarNumero(aliquotaReduzida);
  const lair = normalizarNumero(lairDesejada);

  const markupRows = (listaMarkupConfig || []).filter(
    (m) => normalizeNomeClienteMarkup(m?.nome_cliente) === nome && nome !== '',
  );

  const faixaMatch = markupRows.find((m) => {
    const lairOk = almostEq(m?.percentual_markup, lair);
    const brutaOk = almostEq(m?.aliquota_bruta, brutaPct);
    const redOk = almostEq(m?.aliquota_reduzida, reduzidaPctAtual);
    return lairOk && brutaOk && redOk;
  });

  const malhaTipo = malhaSpotTipo || '';
  const basePctJs =
    malhaTipo && nome
      ? markupBasePctPorMalha(malhaTipo, reduzidaPctAtual, brutaPct, lair)
      : markupBasePctPorCliente(nome, reduzidaPctAtual, brutaPct, lair);

  const baseDb = normalizarNumero(faixaMatch?.percentual_base);
  let pctOperFrac =
    Number.isFinite(baseDb) && baseDb > 1 && baseDb <= 100
      ? baseDb / 100
      : Number.isFinite(baseDb) && baseDb > 0 && baseDb <= 1
        ? baseDb
        : 0;

  if (
    (malhaTipo ? normalizeNomeClienteMarkup(malhaTipo) === 'BOTICARIO' : isClienteBoticario(nome)) &&
    basePctJs > 0
  ) {
    pctOperFrac = basePctJs > 1 ? basePctJs / 100 : basePctJs;
  } else if (!(pctOperFrac > 0)) {
    pctOperFrac = basePctJs > 1 ? basePctJs / 100 : basePctJs > 0 ? basePctJs : 0;
  }

  const markupPct = markupPctFromPctOperacional(pctOperFrac);
  return { pctOperFrac, markupPct, basePctJs, faixaMatch };
}

/**
 * Gera `markup_rotas` do round 1: um % por par UF (e veículo), conforme tabela + LAIR + ICMS da rota.
 */
export function buildMarkupRotasSpot(rotasUf, veiculos, ctx) {
  const {
    listaMarkupConfig,
    malhaSpotTipo,
    nomeTabela,
    lairDesejada,
    icmsByOrigem = {},
  } = ctx;
  if (!nomeTabela || !normalizeNomeClienteMarkup(nomeTabela)) return [];

  const seen = new Set();
  const out = [];
  for (const par of rotasUf || []) {
    const origem = String(par[0] || '')
      .toUpperCase()
      .slice(0, 2);
    const destino = String(par[1] || '')
      .toUpperCase()
      .slice(0, 2);
    if (!origem || !destino) continue;
    const key = `${origem}|${destino}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const { bruta, reduzida } = aliquotasIcmsPorRota(origem, destino, icmsByOrigem[origem]);
    const { markupPct } = resolverPctOperacionalSpot({
      listaMarkupConfig,
      malhaSpotTipo,
      nomeTabela,
      lairDesejada,
      aliquotaBruta: bruta,
      aliquotaReduzida: reduzida,
    });

    for (const v of veiculos || []) {
      out.push({
        uf_origem: origem,
        uf_destino: destino,
        veiculo_id: v.id,
        percentual_markup: markupPct,
      });
    }
  }
  return out;
}

/** Markup % médio entre rotas (para exibir no painel por veículo). */
export function markupPctMedioRotas(markupRotas) {
  const vals = (markupRotas || [])
    .map((r) => Number(r.percentual_markup))
    .filter((n) => Number.isFinite(n));
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}
