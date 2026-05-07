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

/**
 * POST JSON; em erro HTTP lança Error com mensagem amigável.
 * @param {string} pathAndQuery
 * @param {object} body
 */
export async function fetchJsonPost(pathAndQuery, body) {
  const base = getApiBase();
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 400) };
    }
  }
  if (!res.ok) {
    const serializerMsg =
      data && typeof data === 'object' && !Array.isArray(data)
        ? Object.entries(data)
            .map(([k, v]) => {
              if (typeof v === 'string') return `${k}: ${v}`;
              if (Array.isArray(v)) return `${k}: ${v.join(' ')}`;
              return `${k}: ${JSON.stringify(v)}`;
            })
            .join('\n')
        : '';
    const msg =
      data.error ||
      (Array.isArray(data.detail) ? data.detail.map((d) => d.msg || d).join(' ') : data.detail) ||
      serializerMsg ||
      `HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}
