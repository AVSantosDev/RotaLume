import { faixaKmFromMinMax, findPresetFaixaByText } from './faixaKmHelpers';

function stripBom(s) {
  return String(s || '').replace(/^\uFEFF/, '');
}

function normalizeKey(s) {
  return stripBom(s)
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function pickCol(row, candidates) {
  const keys = Object.keys(row || {});
  const map = new Map(keys.map((k) => [normalizeKey(k), k]));
  for (const c of candidates) {
    const nk = normalizeKey(c);
    if (map.has(nk)) return map.get(nk);
  }
  for (const c of candidates) {
    const nk = normalizeKey(c);
    for (const k of keys) {
      if (normalizeKey(k).includes(nk) || nk.includes(normalizeKey(k))) {
        return k;
      }
    }
  }
  return null;
}

function parseNumPtBr(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  let s = String(v).trim().replace(/\s/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function uf2(v) {
  const s = String(v ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (s.length >= 2) return s.slice(0, 2);
  return '';
}

export function resolveFaixaFromCell(text, kmMinRaw, kmMaxRaw) {
  const nMin = parseNumPtBr(kmMinRaw);
  const nMax = parseNumPtBr(kmMaxRaw);
  if (nMin != null && nMax != null && nMin > 0 && nMax >= nMin) {
    return faixaKmFromMinMax(nMin, nMax);
  }
  if (nMin != null && nMin > 0 && (kmMaxRaw == null || String(kmMaxRaw).trim() === '')) {
    return faixaKmFromMinMax(nMin, null);
  }

  const raw = String(text ?? '').trim();
  const preset = findPresetFaixaByText(raw);
  if (preset) return { ...preset };

  const acima = raw.match(/acima\s+de\s+(\d+)/i);
  if (acima) {
    const m = parseInt(acima[1], 10);
    if (!Number.isFinite(m) || m <= 0) return null;
    if (m === 500) {
      const p500 = findPresetFaixaByText('Acima de 500 Km');
      if (p500) return { ...p500 };
    }
    return faixaKmFromMinMax(m, null);
  }

  const compact = raw.replace(/\s+/g, ' ').trim();
  const range = compact.match(/(\d+)\s*[-–aA]\s*(\d+)/);
  if (range) {
    const a = parseInt(range[1], 10);
    const b = parseInt(range[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
      return faixaKmFromMinMax(Math.min(a, b), Math.max(a, b));
    }
  }

  const only = compact.match(/^(\d+)$/);
  if (only) {
    const k = parseInt(only[1], 10);
    if (k > 0) return faixaKmFromMinMax(1, k);
  }

  return null;
}

function rowToTriplet(row) {
  const kOrig = pickCol(row, ['origem', 'uf_origem', 'uforigem', 'o', 'origem_uf', 'de', 'from']);
  const kDest = pickCol(row, ['destino', 'uf_destino', 'ufdestino', 'd', 'destino_uf', 'para', 'to']);
  const kFaixa = pickCol(row, ['faixa', 'faixa_km', 'faixakm', 'distancia', 'km', 'intervalo']);
  const kMin = pickCol(row, ['km_min', 'kmin', 'min_km', 'inicio', 'de_km']);
  const kMax = pickCol(row, ['km_max', 'kmax', 'max_km', 'fim', 'ate_km']);

  const origem = uf2(kOrig ? row[kOrig] : '');
  const destino = uf2(kDest ? row[kDest] : '');
  const faixa = resolveFaixaFromCell(
    kFaixa ? row[kFaixa] : '',
    kMin ? row[kMin] : '',
    kMax ? row[kMax] : '',
  );

  return { origem, destino, faixa };
}

export function sheetRowsToTriplets(rows) {
  const errors = [];
  const triplets = [];
  let line = 1;
  for (const row of rows) {
    line += 1;
    if (!row || typeof row !== 'object') continue;
    const vals = Object.values(row).filter((v) => v != null && String(v).trim() !== '');
    if (vals.length === 0) continue;

    const { origem, destino, faixa } = rowToTriplet(row);
    if (!origem || !destino) {
      errors.push(`Linha ${line}: origem ou destino inválido/ausente.`);
      continue;
    }
    if (!faixa) {
      errors.push(`Linha ${line}: faixa de KM não reconhecida (${origem}-${destino}).`);
      continue;
    }
    triplets.push({ origem, destino, faixa });
  }
  return { triplets, errors };
}

function detectDelimiter(line) {
  const sc = (line.match(/;/g) || []).length;
  const cc = (line.match(/,/g) || []).length;
  return sc >= cc ? ';' : ',';
}

function parseCsv(text) {
  const lines = stripBom(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (!lines.length) return [];
  const delim = detectDelimiter(lines[0]);
  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        q = !q;
      } else if (ch === delim && !q) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out.map((c) => c.replace(/^"|"$/g, ''));
  };

  const headers = splitLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitLine(lines[i]);
    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = cells[j] ?? '';
    });
    rows.push(obj);
  }
  return rows;
}

export async function parseRotasFaixaFile(file) {
  const name = (file?.name || '').toLowerCase();
  let table = [];

  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text();
    table = parseCsv(text);
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    let XLSX;
    try {
      // Evita falha de análise estática em alguns setups; ainda exige o pacote em node_modules em runtime.
      const mod = await import(/* @vite-ignore */ 'xlsx');
      XLSX = mod.default ?? mod;
    } catch {
      throw new Error(
        'Pacote "xlsx" não encontrado. Na pasta front_portal-cotacao rode: npm install. No Docker, o compose já executa npm install ao subir o frontend.',
      );
    }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    table = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  } else {
    throw new Error('Use arquivo .csv, .txt ou .xlsx/.xls');
  }

  return sheetRowsToTriplets(table);
}
