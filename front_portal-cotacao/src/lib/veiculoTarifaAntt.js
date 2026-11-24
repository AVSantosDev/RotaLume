/** Tabelas ANTT e CCD por faixa — cadastro de veículo. */

export const ANTT_TABELAS_VEICULO = ['A', 'B', 'C', 'D'];

export const VEICULO_FRETE_KEYS = [
  'frete_minimo_ate_50km',
  'tarifa_0_50',
  'tarifa_51_100',
  'tarifa_101_150',
  'tarifa_151_200',
  'tarifa_201_300',
  'tarifa_301_400',
  'tarifa_401_500',
  'tarifa_acima_500',
];

export function emptyTarifasAnttForm() {
  const row = () =>
    VEICULO_FRETE_KEYS.reduce((acc, key) => {
      acc[key] = '';
      return acc;
    }, {});
  return Object.fromEntries(ANTT_TABELAS_VEICULO.map((t) => [t, row()]));
}

/** CCD (R$/km) conforme km e tabela ANTT no objeto veículo da API. */
export function tarifaFaixaPorKm(km, veiculo, tabelaAntt = 'A') {
  if (!veiculo || km == null) return null;
  const t = String(tabelaAntt || 'A')
    .toUpperCase()
    .trim();
  const src =
    veiculo.tarifas_antt?.[t] ||
    (t === 'A' ? veiculo : null) ||
    {};
  const pick = (field) => {
    const x = src[field];
    if (x === undefined || x === null || x === '') return 0;
    const n = typeof x === 'number' ? x : parseFloat(String(x).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const k = Number(km);
  if (k <= 50) return pick('tarifa_0_50');
  if (k <= 100) return pick('tarifa_51_100');
  if (k <= 150) return pick('tarifa_101_150');
  if (k <= 200) return pick('tarifa_151_200');
  if (k <= 300) return pick('tarifa_201_300');
  if (k <= 400) return pick('tarifa_301_400');
  if (k <= 500) return pick('tarifa_401_500');
  return pick('tarifa_acima_500');
}

export function tarifasAnttFromVeiculoItem(item) {
  const out = emptyTarifasAnttForm();
  if (!item) return out;
  for (const t of ANTT_TABELAS_VEICULO) {
    const chunk = item.tarifas_antt?.[t] || (t === 'A' ? item : {});
    for (const key of VEICULO_FRETE_KEYS) {
      const v = chunk[key];
      out[t][key] = v != null && v !== '' ? Number(v) : '';
    }
  }
  return out;
}
