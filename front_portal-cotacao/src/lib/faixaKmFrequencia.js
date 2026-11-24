import { calcKmTotal } from './anttFaixaKmCalc';
import { faixaKmRowKey } from './faixaKmHelpers';

/** Chave plana (DRE / mapas legados). */
export function cellFrequenciaStorageKey(r, veiculoId) {
  const lid = r?.id;
  const vid = String(veiculoId);
  if (lid != null) return `id:${lid}|v:${vid}`;
  return `${faixaKmRowKey(r?.origem, r?.destino, r?.faixaId)}|v:${vid}`;
}

export function parseFrequenciaValor(raw) {
  if (raw === '' || raw == null) return null;
  const s = String(raw).trim().replace(/\s/g, '');
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Frequência da célula (linha × veículo). Ordem: edição → célula API → linha → 1.
 * @param {object} r linha
 * @param {number|string} veiculoId
 * @param {Record<string, Record<string, string>>} [editByLineVid] `editFrequencia[lineId][vid]`
 * @param {Record<string, string>} [legacyRowMap] mapa antigo por linha (prévia/import)
 */
export function frequenciaDaCelula(r, veiculoId, editByLineVid = {}, legacyRowMap = {}) {
  const vid = String(veiculoId);
  const lid = r?.id;

  if (lid != null && editByLineVid[lid]?.[vid] !== undefined) {
    const n = parseFrequenciaValor(editByLineVid[lid][vid]);
    return n != null ? n : 1;
  }

  const legacyKey =
    lid != null ? `id:${lid}` : faixaKmRowKey(r?.origem, r?.destino, r?.faixaId);
  if (legacyRowMap[legacyKey] !== undefined && legacyRowMap[legacyKey] !== '') {
    const n = parseFrequenciaValor(legacyRowMap[legacyKey]);
    return n != null ? n : 1;
  }

  const cell = r?.byVeiculoId?.[vid];
  if (cell?.frequencia != null && Number.isFinite(Number(cell.frequencia))) {
    const n = Number(cell.frequencia);
    return n > 0 ? n : 1;
  }

  if (r?.frequencia != null && Number.isFinite(Number(r.frequencia))) {
    const n = Number(r.frequencia);
    return n > 0 ? n : 1;
  }

  return 1;
}

export function parseKmTotalValor(raw) {
  if (raw === '' || raw == null) return null;
  const s = String(raw).trim().replace(/\s/g, '');
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * KM total da célula. Ordem: edição → célula API → km rep. × frequência.
 */
export function kmTotalDaCelula(
  r,
  veiculoId,
  editByLineVid = {},
  legacyCellMap = {},
  kmRepresentativo = null,
  frequencia = 1,
) {
  const vid = String(veiculoId);
  const lid = r?.id;
  const kmRep = Number(kmRepresentativo ?? r?.kmRepresentativo) || 0;

  if (lid != null && editByLineVid[lid]?.[vid] !== undefined && editByLineVid[lid][vid] !== '') {
    const n = parseKmTotalValor(editByLineVid[lid][vid]);
    if (n != null) return n;
  }

  const legacyKey = cellFrequenciaStorageKey(r, veiculoId);
  if (legacyCellMap[legacyKey] !== undefined && legacyCellMap[legacyKey] !== '') {
    const n = parseKmTotalValor(legacyCellMap[legacyKey]);
    if (n != null) return n;
  }

  const cell = r?.byVeiculoId?.[vid];
  if (cell?.km_total != null && Number.isFinite(Number(cell.km_total))) {
    const n = Number(cell.km_total);
    if (n > 0) return n;
  }

  const freq =
    frequencia != null && Number(frequencia) > 0 ? Number(frequencia) : 1;
  return calcKmTotal(kmRep, freq);
}

export function buildFrequenciaMapFlat(rows, veiculos, editByLineVid = {}, legacyRowMap = {}) {
  const out = {};
  for (const r of rows || []) {
    for (const v of veiculos || []) {
      out[cellFrequenciaStorageKey(r, v.id)] = String(
        frequenciaDaCelula(r, v.id, editByLineVid, legacyRowMap),
      );
    }
  }
  return out;
}
