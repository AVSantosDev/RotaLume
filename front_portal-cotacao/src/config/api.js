/**
 * Base URL da API Django (sem barra final).
 * No Docker, use VITE_API_URL (ex.: definido no docker-compose).
 */
export function getApiBase() {
  const env = import.meta.env.VITE_API_URL;
  if (typeof env === 'string' && env.trim()) {
    return env.trim().replace(/\/$/, '');
  }
  return 'http://localhost:8000';
}

/** Lista direta ou paginação DRF `{ results: [...] }`. */
export function normalizeListPayload(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

/**
 * GET que deve retornar uma lista. Em erro ou JSON inválido, devolve [] e loga no console.
 * @param {string} pathAndQuery Ex.: `/impostos/` ou `/clientes/?search=x`
 */
export async function fetchJsonList(pathAndQuery) {
  const base = getApiBase();
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const url = `${base}${path}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      console.error(`[API] ${res.status} ${url}`, text.slice(0, 280));
      return [];
    }
    if (!text) return [];
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`[API] resposta não é JSON: ${url}`);
      return [];
    }
    return normalizeListPayload(data);
  } catch (e) {
    console.error(`[API] falha de rede: ${url}`, e);
    return [];
  }
}
