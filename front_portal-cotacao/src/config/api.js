/**
 * Base URL da API Django (sem barra final).
 * Em dev com Docker: use VITE_USE_DEV_PROXY=1 no Vite — o browser só fala com a origem do Vite; rotas /__api são proxy para o Django.
 */
export function getApiBase() {
  if (import.meta.env.DEV && String(import.meta.env.VITE_USE_DEV_PROXY) === '1') {
    return '/__api';
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:8000`.replace(/\/$/, '');
    }
  }
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
/**
 * GET lista JSON; falha de rede ou HTTP não-2xx lança Error (mensagem para o usuário).
 */
export async function fetchJsonListStrict(pathAndQuery) {
  const base = getApiBase();
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const url = `${base}${path}`;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    const msg = e?.message || String(e);
    const hint =
      import.meta.env.DEV && String(import.meta.env.VITE_USE_DEV_PROXY) !== '1'
        ? ' Se o front roda no Docker, defina VITE_USE_DEV_PROXY=1 no ambiente do Vite (proxy /__api → backend).'
        : '';
    throw new Error(`Não foi possível conectar à API (${url}): ${msg}.${hint}`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path}: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ''}`);
  }
  if (!text) return [];
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${path}: resposta não é JSON`);
  }
  return normalizeListPayload(data);
}

export async function fetchJsonList(pathAndQuery) {
  try {
    return await fetchJsonListStrict(pathAndQuery);
  } catch (e) {
    console.error('[API]', e);
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

/**
 * PUT JSON (corpo completo); em erro HTTP lança Error com mensagem amigável.
 * @param {string} pathAndQuery
 * @param {object} body
 */
export async function fetchJsonPut(pathAndQuery, body) {
  const base = getApiBase();
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: 'PUT',
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

/**
 * GET um único objeto JSON; em erro lança Error.
 * @param {string} pathAndQuery
 */
export async function fetchJsonGet(pathAndQuery) {
  const base = getApiBase();
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const url = `${base}${path}`;
  const res = await fetch(url);
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Resposta não é JSON: ${url}`);
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
