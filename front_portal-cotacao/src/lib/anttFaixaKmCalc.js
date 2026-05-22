/** Tabelas de frete mínimo ANTT (A, B, C, D). */
export const ANTT_TABELAS_OPCOES = [
  { value: 'A', label: 'Tabela A' },
  { value: 'B', label: 'Tabela B' },
  { value: 'C', label: 'Tabela C' },
  { value: 'D', label: 'Tabela D' },
];

const CC_FIELDS = {
  A: 'cc_tabela_a',
  B: 'cc_tabela_b',
  C: 'cc_tabela_c',
  D: 'cc_tabela_d',
};

function parseDec(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Campo do veículo com CC (R$) para a tabela ANTT informada. */
export function ccFieldForTabela(tabela) {
  const t = String(tabela || 'A')
    .toUpperCase()
    .trim();
  return CC_FIELDS[t] || CC_FIELDS.A;
}

/**
 * CC (coeficiente de custo fixo) do cadastro do veículo para a tabela ANTT.
 * Usa `cc_tabela_*`; se vazio, legado `taxa_correcao`.
 */
export function ccDoVeiculo(veiculo, tabelaAntt = 'A') {
  if (!veiculo) return 0;
  const field = ccFieldForTabela(tabelaAntt);
  const v = veiculo[field];
  if (v !== undefined && v !== null && v !== '') return parseDec(v);
  return parseDec(veiculo.taxa_correcao);
}

/** KM total no período = km representativo × frequência (mín. 1 na frequência). */
export function calcKmTotal(kmRepresentativo, frequencia) {
  const km = Number(kmRepresentativo) || 0;
  const f = Math.max(1, Number(frequencia) || 1);
  if (!(km > 0)) return 0;
  return km * f;
}

/** Distância por viagem (km) = KM total ÷ frequência. */
export function distanciaAnttPorViagem(kmRepresentativo, frequencia, kmTotalOverride = null) {
  const f = Math.max(1, Number(frequencia) || 1);
  const kmT =
    kmTotalOverride != null && Number(kmTotalOverride) > 0
      ? Number(kmTotalOverride)
      : calcKmTotal(kmRepresentativo, f);
  if (!(kmT > 0)) return Number(kmRepresentativo) || 0;
  return kmT / f;
}

/**
 * Total de custo da faixa conforme ANTT: (Distância × CCD) + CC.
 * Distância = KM total / frequência (KM total editável ou km rep. × freq.).
 */
export function calcTotalCustoFaixaAntt({ kmRepresentativo, ccd, cc, frequencia, kmTotal }) {
  const dist = distanciaAnttPorViagem(kmRepresentativo, frequencia, kmTotal);
  const ccdN = parseDec(ccd);
  const ccN = parseDec(cc);
  if (!(dist > 0)) return ccN > 0 ? ccN : 0;
  return dist * ccdN + ccN;
}

/** Valor do frete por viagem na faixa (= total custo ANTT por viagem). */
export function calcFretePorViagemFaixaAntt(opts) {
  return calcTotalCustoFaixaAntt(opts);
}
