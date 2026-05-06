/** Cache em memória da lista oficial de municípios (IBGE). */
let municipiosIbgeCache = null;

export function removerAcentos(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function carregarMunicipiosIbge() {
  if (municipiosIbgeCache) return municipiosIbgeCache;
  const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
  if (!res.ok) throw new Error(`IBGE ${res.status}`);
  municipiosIbgeCache = await res.json();
  return municipiosIbgeCache;
}

/**
 * Mesmo critério da Nova Cotação: filtra pelo nome do município (≥ 3 caracteres).
 * Retorna `{ cidade, uf, label }` com nome oficial do IBGE para padronizar cadastro.
 */
export async function buscarMunicipiosPorTermo(termo, limite = 8) {
  const t = String(termo || '').trim();
  if (t.length < 3) return [];
  const data = await carregarMunicipiosIbge();
  const q = removerAcentos(t.toLowerCase());
  const filtrados = data
    .filter((m) => removerAcentos(m.nome.toLowerCase()).includes(q))
    .slice(0, limite)
    .map((m) => ({
      cidade: m.nome,
      uf: m.microrregiao?.mesorregiao?.UF?.sigla || '',
      label: `${m.nome.toUpperCase()} - ${m.microrregiao?.mesorregiao?.UF?.sigla || ''}`,
    }));
  return filtrados;
}
