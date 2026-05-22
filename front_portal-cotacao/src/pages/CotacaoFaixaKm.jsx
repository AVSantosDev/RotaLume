import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Loader2,
  Table2,
  User,
  Ruler,
  Truck,
  MapPin,
  Upload,
  X,
  FileDown,
  Trash2,
  GripVertical,
  Settings2,
  LineChart,
} from 'lucide-react';
import { fetchJsonList, fetchJsonListStrict, fetchJsonPost, fetchJsonGet, fetchJsonPut, getApiBase } from '../config/api';
import DreBaseLucroPanel from '../components/DreBaseLucroPanel';
import { calcularLairPctCelulaFaixaKm } from '../lib/dreSpotCalc';
import {
  ANTT_TABELAS_OPCOES,
  calcTotalCustoFaixaAntt,
  ccDoVeiculo,
} from '../lib/anttFaixaKmCalc';
import { agregarDreFaixaKm } from '../lib/faixaKmDreAggregate';
import {
  buildFrequenciaMapFlat,
  cellFrequenciaStorageKey,
  frequenciaDaCelula,
  kmTotalDaCelula,
  parseFrequenciaValor,
  parseKmTotalValor,
} from '../lib/faixaKmFrequencia';
import {
  buildMarkupRotasSpot,
  markupPctMedioRotas,
} from '../lib/markupFaixaKm';
import { normalizeNomeClienteMarkup } from '../lib/markupSpotLookup';
import {
  FAIXAS_KM_OPCOES,
  ROTAS_UF_PADRAO,
  buildSnapshotRows,
  buildSnapshotRowsExplicit,
  faixaKmRowKey,
  buildRoundsPayloadCreate,
  headerStylePorTipoVeiculo,
  mergeRowsWithDraft,
  faixaKmFromMinMax,
  menorOrdemRound,
  isPrimeiroRoundFrete,
  calcTotalFreteFaixaFromCusto,
  computeTotaisFreteFaixaPorRound,
  badgeMarkupTotalFreteFaixa,
} from '../lib/faixaKmHelpers';
import { parseRotasFaixaFile } from '../lib/faixaKmPlanilhaParse';
import {
  FAIXA_KM_BASE_COL_KEYS,
  FAIXA_KM_BASE_COL_LABELS,
  labelBaseColHeader,
  DEFAULT_FAIXA_KM_BASE_COL_WIDTHS,
  loadFaixaKmBaseLayout,
  saveFaixaKmBaseLayout,
  resetFaixaKmBaseLayoutStorage,
} from '../lib/faixaKmTableLayout';

const fmtTarifa = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Percentual para exibição (ex.: 3,00%). */
const fmtPctBr = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};

/**
 * Converte texto digitado (pt-BR ou ponto decimal) em número.
 * Se houver vírgula, assume formato BR (pontos = milhar, vírgula = decimal).
 * Se só houver ponto: 1–2 casas após o ponto = decimal (ex.: 23.5); exatamente 3 = milhar (1.234).
 */
function parseBRDec(raw) {
  if (raw == null || raw === '') return 0;
  let s = String(raw)
    .trim()
    .replace(/%/g, '')
    .replace(/R\$\s?/gi, '')
    .replace(/\s/g, '');
  if (!s) return 0;

  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    const parts = s.split('.');
    if (parts.length === 1) {
      s = parts[0];
    } else if (parts.length === 2) {
      const [, frac] = parts;
      if (frac.length <= 2) {
        s = `${parts[0]}.${frac}`;
      } else if (frac.length === 3) {
        s = parts[0] + frac;
      } else {
        s = `${parts[0]}.${frac}`;
      }
    } else {
      const last = parts[parts.length - 1];
      if (last.length <= 2) {
        s = parts.slice(0, -1).join('') + '.' + last;
      } else {
        s = parts.join('');
      }
    }
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function fmtDec2Input(n) {
  if (!Number.isFinite(Number(n))) return '';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct2Input(n) {
  if (!Number.isFinite(Number(n))) return '';
  return `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function fmtMoney2Input(n) {
  if (!Number.isFinite(Number(n))) return '';
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Conta toggles de visibilidade (folhas) para “selecionar todos”. */
function countFaixaKmColVisState(m, template) {
  let tot = 0;
  let act = 0;
  const hit = (on) => {
    tot += 1;
    if (on) act += 1;
  };
  for (const k of ['rota', 'origem', 'destino', 'faixa', 'frequencia']) hit(m[k] !== false);
  for (const k of Object.keys(template.descFaixa)) hit(m.descFaixa?.[k] !== false);
  for (const vid of Object.keys(template.veiculos)) {
    const tv = template.veiculos[vid];
    const mv = m.veiculos?.[vid] || {};
    hit(mv.freqCol !== false);
    hit(mv.custoCol !== false);
    hit(mv.totalCustoFaixa !== false);
    for (const fk of Object.keys(tv.frete)) {
      hit(mv.frete?.[fk] !== false);
      hit(mv.totalFreteFaixa?.[fk] !== false);
    }
  }
  return { allOn: tot > 0 && act === tot, anyOn: act > 0, tot, act };
}

function makeFaixaKmColVisAllOff(template) {
  return {
    rota: false,
    origem: false,
    destino: false,
    faixa: false,
    frequencia: false,
    descFaixa: Object.fromEntries(Object.keys(template.descFaixa).map((k) => [k, false])),
    veiculos: Object.fromEntries(
      Object.keys(template.veiculos).map((vid) => {
        const tv = template.veiculos[vid];
        return [
          vid,
          {
            freqCol: false,
            custoCol: false,
            totalCustoFaixa: false,
            frete: Object.fromEntries(Object.keys(tv.frete).map((fk) => [fk, false])),
            totalFreteFaixa: Object.fromEntries(Object.keys(tv.totalFreteFaixa).map((fk) => [fk, false])),
          },
        ];
      }),
    ),
  };
}

/** Quantos veículos têm uma coluna lógica ligada (para “todos” por coluna). */
function countVehicleColumnVisibility(merged, template, isOn) {
  const vids = Object.keys(template.veiculos);
  let act = 0;
  for (const vid of vids) {
    const mv = merged.veiculos?.[vid] || template.veiculos[vid];
    if (isOn(mv)) act += 1;
  }
  const tot = vids.length;
  return {
    allOn: tot > 0 && act === tot,
    indeterminate: act > 0 && act < tot,
  };
}

function applyVehicleColumnVisibilityAll(merged, template, spec, on) {
  const nextVeh = { ...merged.veiculos };
  for (const vid of Object.keys(template.veiculos)) {
    const t0 = template.veiculos[vid];
    const cur = nextVeh[vid] || t0;
    if (spec.kind === 'freq') {
      nextVeh[vid] = { ...cur, freqCol: on };
    } else if (spec.kind === 'custo') {
      nextVeh[vid] = { ...cur, custoCol: on };
    } else if (spec.kind === 'totalCustoFaixa') {
      nextVeh[vid] = { ...cur, totalCustoFaixa: on };
    } else if (spec.kind === 'frete') {
      nextVeh[vid] = { ...cur, frete: { ...t0.frete, ...cur.frete, [spec.fk]: on } };
    } else if (spec.kind === 'totalFreteFaixa') {
      nextVeh[vid] = {
        ...cur,
        totalFreteFaixa: { ...t0.totalFreteFaixa, ...cur.totalFreteFaixa, [spec.fk]: on },
      };
    }
  }
  return { ...merged, veiculos: nextVeh };
}

const PCT_MAX_MICRO = 999_999_999_999;

/** Percentual com entrada estilo caixa (igual moeda): dígitos empilham da direita, 2 casas decimais. */
function PctInput({ value, onCommit, className, disabled, id, placeholder = '0,00%' }) {
  const inputRef = React.useRef(null);
  const editingRef = React.useRef(false);
  const microRef = React.useRef(0);
  const [focused, setFocused] = React.useState(false);
  const [micro, setMicro] = React.useState(0);

  const blurText = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return '';
    return fmtPct2Input(n);
  };

  const focusedText = micro === 0 ? '' : fmtPct2Input(micro / 100);
  const display = focused ? focusedText : blurText();

  const bumpCursorEnd = () => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  };

  return (
    <input
      id={id}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      disabled={disabled}
      autoComplete="off"
      value={display}
      placeholder={placeholder}
      onFocus={() => {
        const n = Number(value);
        const init = Number.isFinite(n) ? Math.min(Math.max(0, Math.round(n * 100)), PCT_MAX_MICRO) : 0;
        microRef.current = init;
        setMicro(init);
        editingRef.current = true;
        setFocused(true);
        bumpCursorEnd();
      }}
      onKeyDown={(e) => {
        if (disabled || !editingRef.current) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Tab' || e.key === 'Enter') return;
        const el = inputRef.current;
        const start = el?.selectionStart ?? 0;
        const end = el?.selectionEnd ?? 0;

        if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          bumpCursorEnd();
          return;
        }

        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          const d = Number(e.key);
          setMicro((m) => {
            const curText = m === 0 ? '' : fmtPct2Input(m / 100);
            const len = curText.length;
            const fullSel = len > 0 && start === 0 && end === len;
            const next = fullSel ? Math.min(d, PCT_MAX_MICRO) : Math.min(m * 10 + d, PCT_MAX_MICRO);
            microRef.current = next;
            return next;
          });
          bumpCursorEnd();
          return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          setMicro((m) => {
            const curText = m === 0 ? '' : fmtPct2Input(m / 100);
            const len = curText.length;
            const fullSel = len > 0 && start === 0 && end === len;
            const next = fullSel ? 0 : Math.floor(m / 10);
            microRef.current = next;
            return next;
          });
          bumpCursorEnd();
        }
        if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
          e.preventDefault();
        }
      }}
      onPaste={(e) => {
        if (disabled || !editingRef.current) return;
        e.preventDefault();
        const raw = e.clipboardData.getData('text');
        const n = parseBRDec(raw);
        if (!Number.isFinite(n)) return;
        const next = Math.min(Math.max(0, Math.round(n * 100)), PCT_MAX_MICRO);
        microRef.current = next;
        setMicro(next);
        bumpCursorEnd();
      }}
      onBlur={() => {
        editingRef.current = false;
        setFocused(false);
        onCommit(microRef.current / 100);
        microRef.current = 0;
        setMicro(0);
      }}
      className={className}
    />
  );
}

const MONEY_MAX_CENTS = 999_999_999_999;

/**
 * Campo de moeda estilo caixa: cada dígito entra à direita (centavos primeiro),
 * empurrando os anteriores para a parte inteira (cents = cents * 10 + dígito).
 */
function MoneyInput({ value, onCommit, className, disabled, placeholder = 'R$ 0,00' }) {
  const inputRef = React.useRef(null);
  const editingRef = React.useRef(false);
  const centsRef = React.useRef(0);
  const [focused, setFocused] = React.useState(false);
  const [cents, setCents] = React.useState(0);

  const blurText = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return '';
    return fmtMoney2Input(n);
  };

  const focusedText = cents === 0 ? '' : fmtMoney2Input(cents / 100);
  const display = focused ? focusedText : blurText();

  const bumpCursorEnd = () => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      disabled={disabled}
      autoComplete="off"
      value={display}
      placeholder={placeholder}
      onFocus={() => {
        const n = Number(value);
        const init = Number.isFinite(n) ? Math.min(Math.max(0, Math.round(n * 100)), MONEY_MAX_CENTS) : 0;
        centsRef.current = init;
        setCents(init);
        editingRef.current = true;
        setFocused(true);
        bumpCursorEnd();
      }}
      onKeyDown={(e) => {
        if (disabled || !editingRef.current) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Tab' || e.key === 'Enter') return;
        const el = inputRef.current;
        const start = el?.selectionStart ?? 0;
        const end = el?.selectionEnd ?? 0;

        if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          bumpCursorEnd();
          return;
        }

        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          const d = Number(e.key);
          setCents((c) => {
            const curText = c === 0 ? '' : fmtMoney2Input(c / 100);
            const len = curText.length;
            const fullSel = len > 0 && start === 0 && end === len;
            const next = fullSel ? Math.min(d, MONEY_MAX_CENTS) : Math.min(c * 10 + d, MONEY_MAX_CENTS);
            centsRef.current = next;
            return next;
          });
          bumpCursorEnd();
          return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          setCents((c) => {
            const curText = c === 0 ? '' : fmtMoney2Input(c / 100);
            const len = curText.length;
            const fullSel = len > 0 && start === 0 && end === len;
            const next = fullSel ? 0 : Math.floor(c / 10);
            centsRef.current = next;
            return next;
          });
          bumpCursorEnd();
        }
        if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
          e.preventDefault();
        }
      }}
      onPaste={(e) => {
        if (disabled || !editingRef.current) return;
        e.preventDefault();
        const raw = e.clipboardData.getData('text');
        const n = parseBRDec(raw);
        if (!Number.isFinite(n)) return;
        const next = Math.min(Math.max(0, Math.round(n * 100)), MONEY_MAX_CENTS);
        centsRef.current = next;
        setCents(next);
        bumpCursorEnd();
      }}
      onBlur={() => {
        editingRef.current = false;
        setFocused(false);
        onCommit(centsRef.current / 100);
        centsRef.current = 0;
        setCents(0);
      }}
      className={className}
    />
  );
}

/** Visibilidade de colunas na tabela do detalhe (todas true por padrão). */
function buildDefaultFaixaKmColVis(roundLabels, veiculos) {
  const descFaixa = {};
  for (const lb of roundLabels || []) {
    if (Number(lb.ordem) >= 2) descFaixa[String(lb.ordem)] = true;
  }
  const veh = {};
  for (const v of veiculos || []) {
    const frete = {};
    const totalFreteFaixa = {};
    for (const lb of roundLabels || []) {
      const o = String(lb.ordem);
      frete[o] = true;
      totalFreteFaixa[o] = true;
    }
    veh[String(v.id)] = {
      freqCol: true,
      custoCol: true,
      totalCustoFaixa: true,
      frete,
      totalFreteFaixa,
    };
  }
  return {
    rota: true,
    origem: true,
    destino: true,
    faixa: true,
    frequencia: false,
    descFaixa,
    veiculos: veh,
  };
}

function mergeFaixaKmColVis(template, prev) {
  if (!prev) return template;
  const out = {
    rota: prev.rota === false ? false : template.rota,
    origem: prev.origem === false ? false : template.origem,
    destino: prev.destino === false ? false : template.destino,
    faixa: prev.faixa === false ? false : template.faixa,
    frequencia: prev.frequencia === false ? false : template.frequencia,
    descFaixa: { ...template.descFaixa },
    veiculos: {},
  };
  for (const k of Object.keys(template.descFaixa)) {
    out.descFaixa[k] = prev.descFaixa?.[k] === false ? false : template.descFaixa[k];
  }
  for (const vid of Object.keys(template.veiculos)) {
    const tp = template.veiculos[vid];
    const pp = prev.veiculos?.[vid] || {};
    const frete = {};
    const totalFreteFaixa = {};
    const legacyCustoOff = pp.custo === false;
    const legacyFxkmOff = pp.freteXkm === false;
    const legacyFreteXkmGlobal = prev.freteXkm === false;
    const fkList = Object.keys(tp.frete);
    const allLegacyCustoRoundsHidden =
      fkList.length > 0 &&
      fkList.every((fk) => pp.custoRound?.[fk] === false || legacyCustoOff);
    let custoCol = tp.custoCol;
    if (pp.custoCol === false || legacyCustoOff) custoCol = false;
    else if (pp.custoCol == null && pp.custoRound && typeof pp.custoRound === 'object' && allLegacyCustoRoundsHidden) {
      custoCol = false;
    }
    let totalCustoFaixa = tp.totalCustoFaixa;
    if (pp.totalCustoFaixa === false) totalCustoFaixa = false;
    else if (pp.totalCustoFaixa == null && pp.custoRound && typeof pp.custoRound === 'object' && allLegacyCustoRoundsHidden) {
      totalCustoFaixa = false;
    }
    for (const fk of fkList) {
      frete[fk] = pp.frete?.[fk] === false ? false : tp.frete[fk];
      const legacyTotFreteOff =
        pp.totalFreteFaixa?.[fk] === false ||
        pp.freteXkmRound?.[fk] === false ||
        legacyFxkmOff ||
        legacyFreteXkmGlobal;
      totalFreteFaixa[fk] = legacyTotFreteOff ? false : tp.totalFreteFaixa[fk];
    }
    let freqCol = tp.freqCol !== false;
    if (pp.freqCol === false) freqCol = false;
    out.veiculos[vid] = { freqCol, custoCol, totalCustoFaixa, frete, totalFreteFaixa };
  }
  return out;
}

const fmtData = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('pt-BR') : '—';
};

function ToggleChip({ active, onClick, children, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors
        ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {children}
    </button>
  );
}

function rotaKey(o, d) {
  return `${o}|${d}`;
}

/** Desconto da faixa aplica a este veículo nesta regra? (null em veiculo_ids = todos) */
function descontoFaixaMarcadoParaVeiculo(df, vid) {
  if (!df) return false;
  const raw = df.veiculo_ids;
  if (raw == null) return true;
  if (!Array.isArray(raw)) return true;
  if (raw.length === 0) return false;
  return raw.map(Number).includes(Number(vid));
}

function initRotasLista() {
  return ROTAS_UF_PADRAO.map(([origem, destino]) => ({
    key: rotaKey(origem, destino),
    origem,
    destino,
    active: true,
  }));
}

const CSV_MODELO = `origem;destino;faixa_km;frequencia
PR;SC;De 1 Km a 50 Km;12
PR;RJ;De 51 Km a 100 Km;8
SP;MG;201-300;4
MG;SP;Acima de 500 Km;2
`;

function parseFrequenciaInput(v) {
  if (v === '' || v == null) return null;
  const s = String(v).trim().replace(/\s/g, '');
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function rowFrequenciaStorageKey(r) {
  if (r?.id != null) return `id:${r.id}`;
  return faixaKmRowKey(r.origem, r.destino, r.faixaId);
}

/** kind: `custo` | `frete` | `total`; ordem = número do round. */
function cellLairKey(r, veiculoId, kind = 'custo', ordem = null) {
  const base = `${rowFrequenciaStorageKey(r)}|${veiculoId}`;
  if (kind === 'frete' && ordem != null) return `${base}|frete|${ordem}`;
  if (kind === 'total' && ordem != null) return `${base}|total|${ordem}`;
  return `${base}|custo`;
}

function lairPctParaParCustoFrete(ctrbVal, freteVal, row, dreCtx) {
  return calcularLairPctCelulaFaixaKm({
    ctrb: ctrbVal,
    fretePesoSIcms: freteVal,
    origem: row.origem,
    destino: row.destino,
    icmsByOrigem: dreCtx.icmsByOrigem,
    listaImpostos: dreCtx.listaImpostos,
    listaDespesas: dreCtx.listaDespesas,
    listaRepresentantes: dreCtx.listaRepresentantes,
    representanteId: dreCtx.representanteId,
    prazoPagamento: dreCtx.prazoPagamento,
  });
}

function buildLairPctByCellKey(
  rows,
  veiculos,
  dreCtx,
  editFrequencia = {},
  frequenciaByRowKey = {},
  editKmTotal = {},
  kmTotalByCellKey = {},
  anttTabela = 'A',
  markupR1ByVid = {},
) {
  const map = {};
  if (!dreCtx?.listaImpostos?.length || !rows?.length || !veiculos?.length) return map;
  const veicById = Object.fromEntries(veiculos.map((v) => [String(v.id), v]));
  for (const r of rows) {
    const kmRep = Number(r.kmRepresentativo) || 0;
    for (const v of veiculos) {
      const cell = r.byVeiculoId?.[String(v.id)] || {};
      const fr = cell.fretesPorRound || [];
      const c0 = Number(cell.custo);
      if (!Number.isFinite(c0) || c0 <= 0) continue;
      const freq = frequenciaDaCelula(r, v.id, editFrequencia, frequenciaByRowKey);
      const cc = ccDoVeiculo(veicById[String(v.id)], anttTabela);
      const kmTotal = kmTotalDaCelula(
        r,
        v.id,
        editKmTotal,
        kmTotalByCellKey,
        kmRep,
        freq,
      );

      const totalCustoFaixa = calcTotalCustoFaixaAntt({
        kmRepresentativo: kmRep,
        ccd: c0,
        cc,
        frequencia: freq,
        kmTotal,
      });
      if (!(totalCustoFaixa > 0)) continue;

      const totaisFrete = computeTotaisFreteFaixaPorRound(
        totalCustoFaixa,
        fr,
        markupR1ByVid[String(v.id)],
      );
      for (const frItem of fr) {
        const ord = Number(frItem.ordem);
        if (!Number.isFinite(ord)) continue;
        const freteKm = Number(frItem.valor);
        if (!Number.isFinite(freteKm) || freteKm <= 0) continue;
        const totalFreteFaixa = totaisFrete[ord] ?? totaisFrete[String(ord)];
        if (!Number.isFinite(totalFreteFaixa) || totalFreteFaixa <= 0) continue;
        const pctTotal = lairPctParaParCustoFrete(
          totalCustoFaixa,
          totalFreteFaixa,
          r,
          dreCtx,
        );
        if (pctTotal != null) map[cellLairKey(r, v.id, 'total', ord)] = pctTotal;
      }
    }
  }
  return map;
}

function LairPctBadge({ pct, lairDesejadaPct, title }) {
  if (!Number.isFinite(pct)) return null;
  const ok =
    Number.isFinite(Number(lairDesejadaPct)) && Number(lairDesejadaPct) > 0
      ? pct >= Number(lairDesejadaPct) - 0.02
      : true;
  return (
    <span
      title={title || 'LAIR % sobre ROL (DRE — mesma regra da Nova Cotação)'}
      className={`text-[8px] font-bold leading-tight ${ok ? 'text-violet-700' : 'text-red-600'}`}
    >
      L {fmtPctBr(pct)}
    </span>
  );
}

function apiDetailToDetalhe(full) {
  const t = full?.table || {};
  return {
    id: full.id,
    cliente_nome: full.cliente_nome,
    antt_tabela: full.antt_tabela || 'A',
    status_cotacao: full.status_cotacao || '',
    created_at: full.created_at,
    rounds: t.rounds || [],
    faixa_km_snapshot: {
      veiculos: t.veiculos || [],
      rows: t.rows || [],
    },
  };
}

export default function CotacaoFaixaKm() {
  const [view, setView] = useState('list');
  const [lista, setLista] = useState([]);
  const [loadingLista, setLoadingLista] = useState(false);
  const [veiculos, setVeiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [erro, setErro] = useState('');

  const [faixaIdsSel, setFaixaIdsSel] = useState(() => new Set(FAIXAS_KM_OPCOES.map((f) => f.id)));
  const [customFaixas, setCustomFaixas] = useState([]);
  const [customMin, setCustomMin] = useState('');
  const [customMax, setCustomMax] = useState('');

  const [rotasLista, setRotasLista] = useState(() => initRotasLista());
  const [novaOrigem, setNovaOrigem] = useState('');
  const [novaDestino, setNovaDestino] = useState('');

  const [planilhaMode, setPlanilhaMode] = useState(false);
  const [planilhaTriplets, setPlanilhaTriplets] = useState([]);
  const [planilhaInfo, setPlanilhaInfo] = useState('');
  const [parseandoPlanilha, setParseandoPlanilha] = useState(false);
  /** Frequência por linha (prévia/criação): chave `origem|destino|faixaId` ou `id:N`. */
  const [frequenciaByRowKey, setFrequenciaByRowKey] = useState({});
  /** Frequência por linha no detalhe: `linhaId` → string digitada. */
  const [editFrequencia, setEditFrequencia] = useState({});
  const [editKmTotal, setEditKmTotal] = useState({});
  const [kmTotalByCellKey, setKmTotalByCellKey] = useState({});
  const [arquivoImportadoNome, setArquivoImportadoNome] = useState('');

  const [veiculoIdsSel, setVeiculoIdsSel] = useState(() => new Set());
  const [clienteId, setClienteId] = useState('');
  const [anttTabela, setAnttTabela] = useState('A');
  const [salvando, setSalvando] = useState(false);

  const [detalhe, setDetalhe] = useState(null);
  const [editCustos, setEditCustos] = useState({});
  const [editRounds, setEditRounds] = useState([]);
  const [salvandoDetalhe, setSalvandoDetalhe] = useState(false);

  const [markupPreviewByVid, setMarkupPreviewByVid] = useState({});
  const [descontoColPreviewByVid, setDescontoColPreviewByVid] = useState({});
  const [descontoFaixaPreviewByFid, setDescontoFaixaPreviewByFid] = useState({});

  const [listaImpostos, setListaImpostos] = useState([]);
  const [listaDespesas, setListaDespesas] = useState([]);
  const [listaRepresentantes, setListaRepresentantes] = useState([]);
  const [listaClienteTaxas, setListaClienteTaxas] = useState([]);
  const [listaMarkupConfig, setListaMarkupConfig] = useState([]);
  const [icmsByOrigem, setIcmsByOrigem] = useState({});
  const [showTabelaClienteList, setShowTabelaClienteList] = useState(false);
  const [aplicarMarkupBusy, setAplicarMarkupBusy] = useState(false);
  const [markupAplicadoMsg, setMarkupAplicadoMsg] = useState('');
  const [parametrosDre, setParametrosDre] = useState({
    tabelaCliente: '',
    percentualLairDesejada: 20,
    prazoPagamento: 30,
    representanteId: '',
  });

  const [novoVeiculoId, setNovoVeiculoId] = useState('');
  const [addVeiculoBusy, setAddVeiculoBusy] = useState(false);
  const [addLinhaOrigem, setAddLinhaOrigem] = useState('PR');
  const [addLinhaDestino, setAddLinhaDestino] = useState('SC');
  const [addLinhaFaixaId, setAddLinhaFaixaId] = useState('1-50');
  const [addLinhaBusy, setAddLinhaBusy] = useState(false);
  const [ampliarModalOpen, setAmpliarModalOpen] = useState(false);
  const [dreModalOpen, setDreModalOpen] = useState(false);
  /** `{ ordem, nome }` quando o usuário pediu para excluir um round (confirmação). */
  const [confirmExcluirRound, setConfirmExcluirRound] = useState(null);
  /** Painel extra no detalhe: `rounds` | `colunas` (null = fechado). */
  const [detalhePainel, setDetalhePainel] = useState(null);
  const [dreFiltros, setDreFiltros] = useState({
    faixaId: '__all__',
    veiculoId: '__all__',
    roundOrdem: 'last',
    compararRounds: true,
  });
  const [faixaKmColVis, setFaixaKmColVis] = useState(null);
  const faixaKmDetIdRef = useRef(null);
  const faixaKmColVisSelectAllRef = useRef(null);
  const faixaKmVehColMasterRefs = useRef({});

  const resetFormulario = useCallback(() => {
    setFaixaIdsSel(new Set(FAIXAS_KM_OPCOES.map((f) => f.id)));
    setCustomFaixas([]);
    setCustomMin('');
    setCustomMax('');
    setRotasLista(initRotasLista());
    setNovaOrigem('');
    setNovaDestino('');
    setPlanilhaMode(false);
    setPlanilhaTriplets([]);
    setPlanilhaInfo('');
    setFrequenciaByRowKey({});
    setKmTotalByCellKey({});
    setArquivoImportadoNome('');
    setClienteId('');
    setAnttTabela('A');
    setErro('');
    setDescontoFaixaPreviewByFid({});
  }, []);

  const carregarDadosApi = useCallback(async (opts = {}) => {
    const { listaSomente } = opts;
    setLoadingLista(true);
    setErro('');
    try {
      if (listaSomente) {
        const list = await fetchJsonListStrict('/cotacao-faixa-km/');
        setLista(Array.isArray(list) ? list : []);
        return;
      }
      const [v, c, list, imp, des, rep, taxas, markup] = await Promise.all([
        fetchJsonListStrict('/veiculos/'),
        fetchJsonListStrict('/clientes/'),
        fetchJsonListStrict('/cotacao-faixa-km/'),
        fetchJsonListStrict('/impostos/'),
        fetchJsonListStrict('/despesas-operacionais/'),
        fetchJsonListStrict('/representantes/'),
        fetchJsonListStrict('/cliente-taxas-config/'),
        fetchJsonListStrict('/markup-config/'),
      ]);
      setVeiculos(Array.isArray(v) ? v : []);
      setClientes(Array.isArray(c) ? c : []);
      setLista(Array.isArray(list) ? list : []);
      setListaImpostos(Array.isArray(imp) ? imp : []);
      setListaDespesas(Array.isArray(des) ? des : []);
      setListaRepresentantes(Array.isArray(rep) ? rep.filter((r) => r.ativo !== false) : []);
      setListaClienteTaxas(Array.isArray(taxas) ? taxas : []);
      setListaMarkupConfig(Array.isArray(markup) ? markup : []);
      const base = getApiBase();
      if (!c.length || !v.length) {
        const parts = [];
        if (!c.length) {
          parts.push(
            `Nenhum cliente retornado pela API (${base}). Se a resposta foi OK mas a lista veio vazia, cadastre clientes em Configurações.`,
          );
        }
        if (!v.length) {
          parts.push(`Nenhum veículo retornado (${base}).`);
        }
        setErro(parts.join(' '));
      }
    } catch (e) {
      const msg = e.message || String(e);
      setErro(msg);
      if (!listaSomente) {
        setVeiculos([]);
        setClientes([]);
      }
      setLista([]);
    } finally {
      setLoadingLista(false);
    }
  }, []);

  useEffect(() => {
    carregarDadosApi();
  }, [carregarDadosApi]);

  useEffect(() => {
    if (veiculos.length && veiculoIdsSel.size === 0) {
      setVeiculoIdsSel(new Set(veiculos.map((x) => String(x.id))));
    }
  }, [veiculos, veiculoIdsSel.size]);

  const clienteSelecionado = useMemo(
    () => clientes.find((c) => String(c.id) === String(clienteId)),
    [clientes, clienteId],
  );

  const clienteTaxasCfg = useMemo(() => {
    const nome = normalizeNomeClienteMarkup(parametrosDre.tabelaCliente);
    if (!nome) return null;
    return (
      listaClienteTaxas.find((t) => normalizeNomeClienteMarkup(t.nome_cliente) === nome) || null
    );
  }, [listaClienteTaxas, parametrosDre.tabelaCliente]);

  useEffect(() => {
    if (!clienteSelecionado?.nome_empresa || !listaClienteTaxas.length) return;
    const cfg = listaClienteTaxas.find(
      (t) =>
        normalizeNomeClienteMarkup(t.nome_cliente) ===
        normalizeNomeClienteMarkup(clienteSelecionado.nome_empresa),
    );
    if (!cfg) return;
    setParametrosDre((p) =>
      p.tabelaCliente ? p : { ...p, tabelaCliente: cfg.nome_cliente },
    );
  }, [clienteId, clienteSelecionado, listaClienteTaxas]);

  const kmFaixasPreview = useMemo(() => {
    const presetSel = FAIXAS_KM_OPCOES.filter((f) => faixaIdsSel.has(f.id));
    const customSel = customFaixas.filter((f) => faixaIdsSel.has(f.id));
    return [...presetSel, ...customSel].sort((a, b) => (a.repKm || 0) - (b.repKm || 0));
  }, [faixaIdsSel, customFaixas]);

  const rotasAtivas = useMemo(
    () => rotasLista.filter((r) => r.active).map((r) => [r.origem, r.destino]),
    [rotasLista],
  );

  const veiculosPreview = useMemo(
    () => veiculos.filter((v) => veiculoIdsSel.has(String(v.id))),
    [veiculos, veiculoIdsSel],
  );

  useEffect(() => {
    setMarkupPreviewByVid((prev) => {
      const next = {};
      for (const v of veiculosPreview) {
        const k = String(v.id);
        next[k] = prev[k] !== undefined ? prev[k] : 0;
      }
      return next;
    });
    setDescontoColPreviewByVid((prev) => {
      const next = {};
      for (const v of veiculosPreview) {
        const k = String(v.id);
        next[k] = prev[k] !== undefined ? prev[k] : '';
      }
      return next;
    });
  }, [veiculosPreview]);

  const rotasForMarkup = useMemo(() => {
    if (planilhaMode && planilhaTriplets.length > 0) {
      const seen = new Set();
      const out = [];
      for (const t of planilhaTriplets) {
        const origem = String(t.origem || '')
          .toUpperCase()
          .slice(0, 2);
        const destino = String(t.destino || '')
          .toUpperCase()
          .slice(0, 2);
        if (!origem || !destino) continue;
        const key = `${origem}|${destino}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push([origem, destino]);
      }
      return out;
    }
    return rotasAtivas;
  }, [planilhaMode, planilhaTriplets, rotasAtivas]);

  const markupRotasPreview = useMemo(() => {
    if (!parametrosDre.tabelaCliente || !rotasForMarkup.length || !veiculosPreview.length) {
      return [];
    }
    return buildMarkupRotasSpot(rotasForMarkup, veiculosPreview, {
      listaMarkupConfig,
      malhaSpotTipo: clienteTaxasCfg?.malha_spot_tipo || '',
      nomeTabela: parametrosDre.tabelaCliente,
      lairDesejada: parametrosDre.percentualLairDesejada,
      icmsByOrigem,
    });
  }, [
    parametrosDre.tabelaCliente,
    parametrosDre.percentualLairDesejada,
    rotasForMarkup,
    veiculosPreview,
    listaMarkupConfig,
    clienteTaxasCfg,
    icmsByOrigem,
  ]);

  useEffect(() => {
    if (!markupRotasPreview.length || !veiculosPreview.length) return;
    const med = markupPctMedioRotas(markupRotasPreview);
    setMarkupPreviewByVid((prev) => {
      const next = { ...prev };
      for (const v of veiculosPreview) {
        next[String(v.id)] = med;
      }
      return next;
    });
  }, [markupRotasPreview, veiculosPreview]);

  const previewRows = useMemo(() => {
    if (!veiculosPreview.length) return [];
    if (planilhaMode && planilhaTriplets.length > 0) {
      return buildSnapshotRowsExplicit(
        planilhaTriplets,
        veiculosPreview,
        markupPreviewByVid,
        markupRotasPreview,
        descontoFaixaPreviewByFid,
        descontoColPreviewByVid,
        anttTabela,
      );
    }
    if (!kmFaixasPreview.length || !rotasAtivas.length) return [];
    return buildSnapshotRows({
      rotasUf: rotasAtivas,
      kmFaixas: kmFaixasPreview,
      veiculos: veiculosPreview,
      markupByVid: markupPreviewByVid,
      markupRotas: markupRotasPreview,
      descontoFaixaByFid: descontoFaixaPreviewByFid,
      descontoColByVid: descontoColPreviewByVid,
      anttTabela,
    });
  }, [
    planilhaMode,
    planilhaTriplets,
    kmFaixasPreview,
    rotasAtivas,
    veiculosPreview,
    markupPreviewByVid,
    markupRotasPreview,
    descontoFaixaPreviewByFid,
    descontoColPreviewByVid,
    anttTabela,
  ]);

  useEffect(() => {
    if (!previewRows.length) return;
    setFrequenciaByRowKey((prev) => {
      const next = { ...prev };
      for (const r of previewRows) {
        const k = rowFrequenciaStorageKey(r);
        if (next[k] === undefined) {
          next[k] =
            r.frequencia != null && Number.isFinite(Number(r.frequencia)) ? String(r.frequencia) : '';
        }
      }
      return next;
    });
  }, [previewRows]);

  const previewRoundLabels = useMemo(() => {
    const vid = veiculosPreview[0]?.id;
    const fr = vid ? previewRows[0]?.byVeiculoId?.[String(vid)]?.fretesPorRound : null;
    if (!fr?.length) return [{ ordem: 1, nome: 'Frete KM round 1' }];
    return fr.map((x) => ({ ordem: x.ordem, nome: `Frete KM round ${x.ordem}` }));
  }, [previewRows, veiculosPreview]);

  const dreCtx = useMemo(
    () => ({
      listaImpostos,
      listaDespesas,
      listaRepresentantes,
      icmsByOrigem,
      representanteId: parametrosDre.representanteId,
      prazoPagamento: parametrosDre.prazoPagamento,
    }),
    [listaImpostos, listaDespesas, listaRepresentantes, icmsByOrigem, parametrosDre.representanteId, parametrosDre.prazoPagamento],
  );

  const toggleFaixa = (id) => {
    setFaixaIdsSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleVeiculo = (id) => {
    const sid = String(id);
    setVeiculoIdsSel((prev) => {
      const n = new Set(prev);
      if (n.has(sid)) n.delete(sid);
      else n.add(sid);
      return n;
    });
  };

  const adicionarFaixaCustom = () => {
    const min = parseInt(String(customMin).replace(/\D/g, ''), 10);
    const maxRaw = String(customMax).trim();
    const max = maxRaw === '' ? null : parseInt(maxRaw.replace(/\D/g, ''), 10);
    if (!Number.isFinite(min) || min < 1) {
      setErro('Informe km mínimo válido (≥ 1).');
      return;
    }
    if (max != null && (!Number.isFinite(max) || max < min)) {
      setErro('Km máximo inválido ou menor que o mínimo.');
      return;
    }
    const fx = faixaKmFromMinMax(min, max);
    setCustomFaixas((prev) => {
      if (prev.some((p) => p.id === fx.id)) return prev;
      return [...prev, fx];
    });
    setFaixaIdsSel((prev) => new Set(prev).add(fx.id));
    setCustomMin('');
    setCustomMax('');
    setErro('');
  };

  const removerFaixaCustom = (id) => {
    setCustomFaixas((prev) => prev.filter((f) => f.id !== id));
    setFaixaIdsSel((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const adicionarRotaUf = () => {
    const o = String(novaOrigem || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    const d = String(novaDestino || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    if (o.length !== 2 || d.length !== 2) {
      setErro('Informe UF de origem e destino com 2 letras.');
      return;
    }
    const key = rotaKey(o, d);
    setRotasLista((prev) => {
      if (prev.some((r) => r.key === key)) {
        return prev.map((r) => (r.key === key ? { ...r, active: true } : r));
      }
      return [...prev, { key, origem: o, destino: d, active: true }];
    });
    setNovaOrigem('');
    setNovaDestino('');
    setErro('');
  };

  const toggleRota = (key) => {
    setRotasLista((prev) => prev.map((r) => (r.key === key ? { ...r, active: !r.active } : r)));
  };

  const marcarTodasRotas = (ativo) => {
    setRotasLista((prev) => prev.map((r) => ({ ...r, active: ativo })));
  };

  const restaurarRotasPadrao = () => {
    setRotasLista(initRotasLista());
    setErro('');
  };

  const onArquivoPlanilha = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setParseandoPlanilha(true);
    setErro('');
    try {
      const { triplets, errors } = await parseRotasFaixaFile(file);
      if (!triplets.length) {
        setErro(errors.length ? errors.slice(0, 5).join(' ') : 'Nenhuma linha válida na planilha.');
        return;
      }
      setPlanilhaMode(true);
      setPlanilhaTriplets(triplets);
      const freqMap = {};
      for (const t of triplets) {
        if (!t.faixa?.id) continue;
        const k = faixaKmRowKey(t.origem, t.destino, t.faixa.id);
        if (t.frequencia != null && Number.isFinite(Number(t.frequencia))) {
          freqMap[k] = String(t.frequencia);
        }
      }
      setFrequenciaByRowKey(freqMap);
      setArquivoImportadoNome(file.name);
      setPlanilhaInfo(`${triplets.length} linha(s) importada(s) de ${file.name}. Modo planilha: combinações manuais e faixas por chip ficam em segundo plano.`);
      if (errors.length) {
        setErro(`Importado com avisos: ${errors.slice(0, 4).join(' ')}${errors.length > 4 ? '…' : ''}`);
      }
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setParseandoPlanilha(false);
    }
  };

  const limparPlanilha = () => {
    setPlanilhaMode(false);
    setPlanilhaTriplets([]);
    setPlanilhaInfo('');
    setFrequenciaByRowKey({});
    setArquivoImportadoNome('');
    setErro('');
  };

  const baixarModeloCsv = () => {
    const blob = new Blob([CSV_MODELO], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_rotas_faixa_km.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const abrirDetalhe = async (c) => {
    setErro('');
    try {
      const full = await fetchJsonGet(`/cotacao-faixa-km/${c.id}/`);
      setDetalhe(apiDetailToDetalhe(full));
      setView('detalhe');
    } catch (e) {
      setErro(e.message || String(e));
    }
  };

  const salvarNova = async () => {
    setErro('');
    if (!clienteId) {
      setErro('Selecione o cliente da cotação.');
      return;
    }
    if (!parametrosDre.tabelaCliente) {
      setErro('Selecione a Contratação (tabela) nos parâmetros de formação de custo.');
      return;
    }
    if (!veiculosPreview.length) {
      setErro('Selecione ao menos um veículo.');
      return;
    }

    const usePlanilha = planilhaMode && planilhaTriplets.length > 0;
    if (!usePlanilha) {
      if (!kmFaixasPreview.length) {
        setErro('Selecione ao menos uma faixa de KM.');
        return;
      }
      if (!rotasAtivas.length) {
        setErro('Selecione ao menos uma combinação origem/destino.');
        return;
      }
    }

    if (!previewRows.length) {
      setErro('Não há linhas para gravar.');
      return;
    }

    const layoutMode = usePlanilha ? 'planilha' : 'matrix';
    const veiculosPayload = veiculosPreview.map((v) => ({ id: v.id, tipo: v.tipo_veiculo }));
    const linhas = previewRows.map((r, idx) => ({
      ordem: idx,
      uf_origem: r.origem,
      uf_destino: r.destino,
      faixa_id: r.faixaId,
      faixa_label: r.faixaLabel,
      km_representativo: r.kmRepresentativo,
      frequencia: parseFrequenciaInput(frequenciaByRowKey[rowFrequenciaStorageKey(r)]),
      celulas: veiculosPreview.map((v) => {
        const cell = r.byVeiculoId[String(v.id)] || {};
        const fk = cellFrequenciaStorageKey(r, v.id);
        const rowFk = rowFrequenciaStorageKey(r);
        return {
          veiculo_id: v.id,
          custo: Number(cell.custo ?? 0),
          frequencia:
            parseFrequenciaValor(frequenciaByRowKey[fk] ?? frequenciaByRowKey[rowFk]) ??
            (r.frequencia != null ? Number(r.frequencia) : null),
          km_total: parseKmTotalValor(kmTotalByCellKey[fk] ?? kmTotalByCellKey[rowFk]),
        };
      }),
    }));

    const rounds = buildRoundsPayloadCreate(veiculosPreview, {
      markupByVid: markupPreviewByVid,
      markupRotas: markupRotasPreview,
      descontoFaixaByFid: descontoFaixaPreviewByFid,
      descontoColByVid: descontoColPreviewByVid,
    });

    const cli = clienteSelecionado;

    setSalvando(true);
    try {
      const created = await fetchJsonPost('/cotacao-faixa-km/', {
        cliente_id: cli.id,
        antt_tabela: anttTabela,
        layout_mode: layoutMode,
        pct_operacional_frac: null,
        arquivo_importado_nome: arquivoImportadoNome || '',
        veiculos: veiculosPayload,
        linhas,
        rounds,
      });
      await carregarDadosApi({ listaSomente: true });
      setDetalhe(apiDetailToDetalhe(created));
      setView('detalhe');
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setSalvando(false);
    }
  };

  const hydrateEditsFromDetalhe = useCallback((d) => {
    const snap = d.faixa_km_snapshot;
    const vlist = snap?.veiculos || [];
    const rInit =
      d.rounds?.length > 0
        ? JSON.parse(JSON.stringify(d.rounds))
        : buildRoundsPayloadCreate(
            vlist.map((x) => ({ id: x.id, tipo_veiculo: x.tipo })),
            {},
          );
    setEditRounds(rInit);
    const cm = {};
    for (const row of snap?.rows || []) {
      cm[row.id] = {};
      for (const [vid, cell] of Object.entries(row.byVeiculoId || {})) {
        cm[row.id][vid] = cell.custo;
      }
    }
    setEditCustos(cm);
    const fm = {};
    for (const row of snap?.rows || []) {
      if (row.id == null) continue;
      fm[row.id] = {};
      for (const [vid, cell] of Object.entries(row.byVeiculoId || {})) {
        const f = cell.frequencia ?? row.frequencia;
        fm[row.id][vid] =
          f != null && Number.isFinite(Number(f)) ? String(f) : '';
      }
    }
    setEditFrequencia(fm);
    const km = {};
    for (const row of snap?.rows || []) {
      if (row.id == null) continue;
      km[row.id] = {};
      for (const [vid, cell] of Object.entries(row.byVeiculoId || {})) {
        if (cell.km_total != null && Number.isFinite(Number(cell.km_total))) {
          km[row.id][vid] = String(cell.km_total);
        }
      }
    }
    setEditKmTotal(km);
  }, []);

  useEffect(() => {
    if (detalhe?.id) hydrateEditsFromDetalhe(detalhe);
  }, [detalhe?.id, hydrateEditsFromDetalhe]);

  useEffect(() => {
    if (!detalhe?.cliente_nome || !listaClienteTaxas.length) return;
    const cfg = listaClienteTaxas.find(
      (t) =>
        normalizeNomeClienteMarkup(t.nome_cliente) ===
        normalizeNomeClienteMarkup(detalhe.cliente_nome),
    );
    if (!cfg) return;
    setParametrosDre((p) =>
      p.tabelaCliente ? p : { ...p, tabelaCliente: cfg.nome_cliente },
    );
  }, [detalhe?.id, detalhe?.cliente_nome, listaClienteTaxas]);

  const snapshotAtivo = detalhe?.faixa_km_snapshot;
  const veiculosSnap = snapshotAtivo?.veiculos || [];
  const rowsSnap = snapshotAtivo?.rows || [];

  const anttTabelaAtiva = view === 'detalhe' ? detalhe?.antt_tabela || 'A' : anttTabela;

  const veiculosComCadastro = useMemo(() => {
    const byId = Object.fromEntries(veiculos.map((v) => [String(v.id), v]));
    const lista = view === 'detalhe' ? veiculosSnap : veiculosPreview;
    return (lista || []).map((v) => {
      const full = byId[String(v.id)] || {};
      return {
        ...full,
        ...v,
        id: v.id,
        tipo_veiculo: v.tipo_veiculo || v.tipo || full.tipo_veiculo,
      };
    });
  }, [veiculos, veiculosSnap, veiculosPreview, view]);

  const lairPctPreview = useMemo(
    () =>
      buildLairPctByCellKey(
        previewRows,
        veiculosPreview,
        dreCtx,
        {},
        frequenciaByRowKey,
        anttTabelaAtiva,
        {},
        kmTotalByCellKey,
      ),
    [previewRows, veiculosPreview, dreCtx, frequenciaByRowKey, kmTotalByCellKey, anttTabelaAtiva],
  );

  const vidsOrderedDet = useMemo(() => veiculosSnap.map((x) => x.id), [veiculosSnap]);
  const displayRowsDetalhe = useMemo(
    () =>
      rowsSnap.length && vidsOrderedDet.length
        ? mergeRowsWithDraft(rowsSnap, vidsOrderedDet, editCustos, editRounds)
        : [],
    [rowsSnap, vidsOrderedDet, editCustos, editRounds],
  );
  const roundLabelsDet = useMemo(
    () =>
      [...editRounds]
        .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0))
        .map((r) => ({ ordem: r.ordem, nome: r.nome || `Frete KM round ${r.ordem}` })),
    [editRounds],
  );

  const markupR1ByVid = useMemo(() => {
    const r1 = editRounds.find((r) => Number(r.ordem) === 1) || editRounds[0];
    return Object.fromEntries(
      (r1?.markup_veiculos || []).map((m) => [
        String(m.veiculo_id),
        Number(m.percentual_markup) || 0,
      ]),
    );
  }, [editRounds]);

  const lairPctDetalhe = useMemo(
    () =>
      buildLairPctByCellKey(
        displayRowsDetalhe,
        veiculosComCadastro,
        dreCtx,
        editFrequencia,
        {},
        anttTabelaAtiva,
        editKmTotal,
        {},
        markupR1ByVid,
      ),
    [
      displayRowsDetalhe,
      veiculosComCadastro,
      dreCtx,
      editFrequencia,
      editKmTotal,
      anttTabelaAtiva,
      markupR1ByVid,
    ],
  );

  const frequenciaMapDetalhe = useMemo(
    () => buildFrequenciaMapFlat(displayRowsDetalhe, veiculosSnap, editFrequencia, {}),
    [displayRowsDetalhe, veiculosSnap, editFrequencia],
  );

  const faixasDreOpts = useMemo(() => {
    const m = new Map();
    for (const r of displayRowsDetalhe) {
      if (r.faixaId != null && !m.has(String(r.faixaId))) {
        m.set(String(r.faixaId), r.faixaLabel || String(r.faixaId));
      }
    }
    return [...m.entries()].map(([id, label]) => ({ id, label }));
  }, [displayRowsDetalhe]);

  const dreAgregadoParams = useMemo(
    () => ({
      rows: displayRowsDetalhe,
      veiculos: veiculosComCadastro,
      dreCtx,
      editFrequencia,
      frequenciaByRowKey: frequenciaMapDetalhe,
      anttTabela: anttTabelaAtiva,
      editKmTotal,
      kmTotalByCellKey: {},
      markupR1ByVeiculoId: markupR1ByVid,
    }),
    [
      displayRowsDetalhe,
      veiculosComCadastro,
      dreCtx,
      editFrequencia,
      editKmTotal,
      frequenciaMapDetalhe,
      anttTabelaAtiva,
      markupR1ByVid,
    ],
  );

  const drePorRound = useMemo(
    () =>
      roundLabelsDet.map((lb) => {
        const ag = agregarDreFaixaKm({
          ...dreAgregadoParams,
          filtros: {
            faixaId: dreFiltros.faixaId,
            veiculoId: dreFiltros.veiculoId,
            roundOrdem: lb.ordem,
          },
        });
        return {
          ordem: lb.ordem,
          nome: lb.nome,
          dre: ag.dre,
          meta: ag.meta,
        };
      }),
    [dreAgregadoParams, dreFiltros.faixaId, dreFiltros.veiculoId, roundLabelsDet],
  );

  const dreRoundUnico = useMemo(() => {
    const ord = dreFiltros.roundOrdem;
    const hit = drePorRound.find((c) => String(c.ordem) === String(ord));
    if (hit) return hit;
    if (ord === 'last' && drePorRound.length) return drePorRound[drePorRound.length - 1];
    return drePorRound[0] ?? { dre: null, meta: null };
  }, [drePorRound, dreFiltros.roundOrdem]);

  useEffect(() => {
    const rows = view === 'detalhe' ? displayRowsDetalhe : previewRows;
    const origins = [
      ...new Set(
        rows
          .map((r) =>
            String(r.origem || '')
              .toUpperCase()
              .trim()
              .slice(0, 2),
          )
          .filter(Boolean),
      ),
    ];
    if (!origins.length) return undefined;
    let cancelled = false;
    (async () => {
      const updates = {};
      await Promise.all(
        origins.map(async (uf) => {
          const cached = icmsByOrigem[uf];
          if (Array.isArray(cached) && cached.length > 0) return;
          try {
            const data = await fetchJsonList(`/icms/?origem=${encodeURIComponent(uf)}`);
            updates[uf] = Array.isArray(data) ? data : [];
          } catch {
            updates[uf] = [];
          }
        }),
      );
      if (!cancelled && Object.keys(updates).length) {
        setIcmsByOrigem((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, previewRows, displayRowsDetalhe, dreModalOpen, icmsByOrigem]);

  useEffect(() => {
    setMarkupAplicadoMsg('');
  }, [parametrosDre.tabelaCliente, parametrosDre.percentualLairDesejada]);

  const aplicarMarkupTabelaDetalhe = useCallback(async () => {
    if (!parametrosDre.tabelaCliente) {
      setErro('Selecione a Contratação (tabela) antes de aplicar o markup.');
      setMarkupAplicadoMsg('');
      return;
    }
    if (!rowsSnap.length || !veiculosSnap.length) {
      setErro('A cotação precisa ter linhas e veículos para aplicar o markup.');
      setMarkupAplicadoMsg('');
      return;
    }
    if (!editRounds.length) {
      setErro('Nenhum round de frete encontrado nesta cotação.');
      setMarkupAplicadoMsg('');
      return;
    }

    setAplicarMarkupBusy(true);
    setErro('');
    setMarkupAplicadoMsg('');
    try {
      const seen = new Set();
      const rotasUf = [];
      for (const r of rowsSnap) {
        const origem = String(r.origem || '')
          .toUpperCase()
          .slice(0, 2);
        const destino = String(r.destino || '')
          .toUpperCase()
          .slice(0, 2);
        if (!origem || !destino) continue;
        const key = `${origem}|${destino}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rotasUf.push([origem, destino]);
      }
      if (!rotasUf.length) {
        setErro('Nenhuma rota UF válida nas linhas da cotação.');
        return;
      }

      const icmsMerged = { ...icmsByOrigem };
      await Promise.all(
        rotasUf.map(async ([origem]) => {
          if (Object.prototype.hasOwnProperty.call(icmsMerged, origem)) return;
          try {
            const data = await fetchJsonList(`/icms/?origem=${encodeURIComponent(origem)}`);
            icmsMerged[origem] = Array.isArray(data) ? data : [];
          } catch {
            icmsMerged[origem] = [];
          }
        }),
      );
      setIcmsByOrigem((prev) => ({ ...prev, ...icmsMerged }));

      const markupRotas = buildMarkupRotasSpot(rotasUf, veiculosSnap, {
        listaMarkupConfig,
        malhaSpotTipo: clienteTaxasCfg?.malha_spot_tipo || '',
        nomeTabela: parametrosDre.tabelaCliente,
        lairDesejada: parametrosDre.percentualLairDesejada,
        icmsByOrigem: icmsMerged,
      });

      if (!markupRotas.length) {
        setErro('Markup zerado: confira a tabela, % LAIR e o cadastro de markup em Configurações.');
        return;
      }

      const med = markupPctMedioRotas(markupRotas);
      const vids = veiculosSnap.map((v) => Number(v.id)).filter((id) => Number.isFinite(id));
      const minOrd = menorOrdemRound(editRounds);
      if (!editRounds.some((r) => Number(r.ordem) === minOrd)) {
        setErro('Round de frete inválido — recarregue a cotação.');
        return;
      }

      setEditRounds((prev) => {
        const cp = JSON.parse(JSON.stringify(prev));
        const ixR1 = cp.findIndex((r) => Number(r.ordem) === minOrd);
        if (ixR1 < 0) return prev;
        cp[ixR1] = {
          ...cp[ixR1],
          markup_rotas: markupRotas,
          markup_veiculos: vids.map((vid) => ({
            veiculo_id: vid,
            percentual_markup: med,
          })),
        };
        return cp;
      });

      const malha = clienteTaxasCfg?.malha_spot_tipo || parametrosDre.tabelaCliente;
      setMarkupAplicadoMsg(
        `Markup aplicado (${parametrosDre.tabelaCliente}${malha ? ` · ${malha}` : ''}): ${markupRotas.length} regras, média ${med.toFixed(2)}%. Clique em Salvar alterações para gravar.`,
      );
    } catch (e) {
      setErro(e?.message || String(e));
      setMarkupAplicadoMsg('');
    } finally {
      setAplicarMarkupBusy(false);
    }
  }, [
    parametrosDre.tabelaCliente,
    parametrosDre.percentualLairDesejada,
    rowsSnap,
    veiculosSnap,
    editRounds,
    listaMarkupConfig,
    clienteTaxasCfg,
    icmsByOrigem,
  ]);

  useEffect(() => {
    if (view !== 'detalhe' || !detalhe?.id) return;
    const tpl = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
    if (faixaKmDetIdRef.current !== detalhe.id) {
      faixaKmDetIdRef.current = detalhe.id;
      setFaixaKmColVis(tpl);
    } else {
      setFaixaKmColVis((prev) => mergeFaixaKmColVis(tpl, prev));
    }
  }, [view, detalhe?.id, roundLabelsDet, veiculosSnap]);

  const mergedFaixaKmColVis = useMemo(
    () => mergeFaixaKmColVis(buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap), faixaKmColVis),
    [roundLabelsDet, veiculosSnap, faixaKmColVis],
  );

  const faixaKmColVisLeafStats = useMemo(() => {
    const tpl = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
    return countFaixaKmColVisState(mergedFaixaKmColVis, tpl);
  }, [mergedFaixaKmColVis, roundLabelsDet, veiculosSnap]);

  useEffect(() => {
    const el = faixaKmColVisSelectAllRef.current;
    if (!el) return;
    const { allOn, anyOn } = faixaKmColVisLeafStats;
    el.indeterminate = Boolean(anyOn && !allOn);
  }, [faixaKmColVisLeafStats]);

  const vehColSpecs = useMemo(() => {
    const rows = [
      {
        id: 'freq',
        kind: 'freq',
        short: 'Freq',
        title: 'Ligar/desligar coluna Frequência em todos os veículos',
      },
      {
        id: 'custo',
        kind: 'custo',
        short: 'Custo',
        title: 'Ligar/desligar coluna Custo em todos os veículos',
      },
      {
        id: 'totalCustoFaixa',
        kind: 'totalCustoFaixa',
        short: 'Tot.custo',
        title: 'Ligar/desligar Total custo faixa em todos os veículos',
      },
    ];
    for (const lb of roundLabelsDet) {
      const fk = String(lb.ordem);
      const nm = lb.nome || `Frete KM round ${fk}`;
      rows.push({
        id: `frete-${fk}`,
        kind: 'frete',
        fk,
        short: `R${fk} Frt`,
        title: `Ligar/desligar ${nm} em todos os veículos`,
      });
      rows.push({
        id: `totalFrete-${fk}`,
        kind: 'totalFreteFaixa',
        fk,
        short: `R${fk} Tot`,
        title: `Ligar/desligar Total frete faixa R${fk} em todos os veículos`,
      });
    }
    return rows;
  }, [roundLabelsDet]);

  const vehColMasterStats = useMemo(() => {
    const tpl = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
    const m = mergedFaixaKmColVis;
    const out = {};
    for (const s of vehColSpecs) {
      if (s.kind === 'freq') out[s.id] = countVehicleColumnVisibility(m, tpl, (mv) => mv.freqCol !== false);
      else if (s.kind === 'custo') out[s.id] = countVehicleColumnVisibility(m, tpl, (mv) => mv.custoCol !== false);
      else if (s.kind === 'totalCustoFaixa') {
        out[s.id] = countVehicleColumnVisibility(m, tpl, (mv) => mv.totalCustoFaixa !== false);
      } else if (s.kind === 'frete') {
        const fk = s.fk;
        out[s.id] = countVehicleColumnVisibility(m, tpl, (mv) => mv.frete?.[fk] !== false);
      } else if (s.kind === 'totalFreteFaixa') {
        const fk = s.fk;
        out[s.id] = countVehicleColumnVisibility(m, tpl, (mv) => mv.totalFreteFaixa?.[fk] !== false);
      }
    }
    return out;
  }, [mergedFaixaKmColVis, roundLabelsDet, veiculosSnap, vehColSpecs]);

  useEffect(() => {
    for (const s of vehColSpecs) {
      const el = faixaKmVehColMasterRefs.current[s.id];
      if (!el) continue;
      const st = vehColMasterStats[s.id];
      el.indeterminate = Boolean(st?.indeterminate);
    }
  }, [vehColSpecs, vehColMasterStats]);

  const markupVeiculoPctByVidByOrd = useMemo(() => {
    const out = {};
    for (const r of editRounds) {
      const o = Number(r.ordem) || 1;
      out[o] = Object.fromEntries(
        (r.markup_veiculos || []).map((m) => [String(m.veiculo_id), Number(m.percentual_markup) || 0]),
      );
    }
    return out;
  }, [editRounds]);

  const descontoColPctByVidByOrd = useMemo(() => {
    const out = {};
    for (const r of editRounds) {
      const o = Number(r.ordem) || 1;
      if (o < 2) continue;
      out[o] = Object.fromEntries(
        (r.descontos_coluna || []).map((d) => [String(d.veiculo_id), Number(d.percentual_desconto) || 0]),
      );
    }
    return out;
  }, [editRounds]);

  const descontoFaixaRulesByOrdFaixa = useMemo(() => {
    const m = {};
    for (const r of editRounds) {
      const o = Number(r.ordem) || 1;
      if (o < 2) continue;
      for (const df of r.descontos_faixa || []) {
        const k = `${o}|${df.faixa_id}`;
        if (!m[k]) m[k] = [];
        m[k].push(df);
      }
    }
    return m;
  }, [editRounds]);

  const veiculosForaDaCotacao = useMemo(() => {
    const ids = new Set((veiculosSnap || []).map((x) => String(x.id)));
    return veiculos.filter((v) => !ids.has(String(v.id)));
  }, [veiculos, veiculosSnap]);

  const ampliarPreviewLinha = useMemo(() => {
    const fx = FAIXAS_KM_OPCOES.find((f) => f.id === addLinhaFaixaId) || FAIXAS_KM_OPCOES[0];
    const o = String(addLinhaOrigem || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    const d = String(addLinhaDestino || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    const rotaOk = o.length === 2 && d.length === 2;
    return rotaOk ? `${o} → ${d} · ${fx.label}` : '— (informe duas UFs)';
  }, [addLinhaFaixaId, addLinhaOrigem, addLinhaDestino]);

  const ampliarPreviewVeiculoNome = useMemo(() => {
    if (!novoVeiculoId) return '';
    return veiculos.find((v) => String(v.id) === String(novoVeiculoId))?.tipo_veiculo || '';
  }, [novoVeiculoId, veiculos]);

  const adicionarVeiculoNaCotacaoExistente = useCallback(async () => {
    if (!detalhe?.id || !novoVeiculoId) {
      setErro('Selecione um veículo que ainda não esteja nesta cotação.');
      return;
    }
    setErro('');
    setAddVeiculoBusy(true);
    try {
      const data = await fetchJsonPost(`/cotacao-faixa-km/${detalhe.id}/adicionar-veiculo/`, {
        veiculo_id: Number(novoVeiculoId),
      });
      const d = apiDetailToDetalhe(data);
      setDetalhe(d);
      hydrateEditsFromDetalhe(d);
      setNovoVeiculoId('');
      setAmpliarModalOpen(false);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setAddVeiculoBusy(false);
    }
  }, [detalhe?.id, novoVeiculoId, hydrateEditsFromDetalhe]);

  const adicionarLinhaNaCotacaoExistente = useCallback(async () => {
    if (!detalhe?.id) return;
    const fx = FAIXAS_KM_OPCOES.find((f) => f.id === addLinhaFaixaId) || FAIXAS_KM_OPCOES[0];
    const o = String(addLinhaOrigem || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    const dd = String(addLinhaDestino || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    if (o.length !== 2 || dd.length !== 2) {
      setErro('Informe UF de origem e destino com 2 letras.');
      return;
    }
    setErro('');
    setAddLinhaBusy(true);
    try {
      const data = await fetchJsonPost(`/cotacao-faixa-km/${detalhe.id}/adicionar-linha/`, {
        uf_origem: o,
        uf_destino: dd,
        faixa_id: fx.id,
        faixa_label: fx.label,
        km_representativo: fx.repKm,
      });
      const d = apiDetailToDetalhe(data);
      setDetalhe(d);
      hydrateEditsFromDetalhe(d);
      setAmpliarModalOpen(false);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setAddLinhaBusy(false);
    }
  }, [detalhe?.id, addLinhaFaixaId, addLinhaOrigem, addLinhaDestino, hydrateEditsFromDetalhe]);

  const updateMarkupVeiculoDetalhe = useCallback((veiculoId, roundOrdem, pct) => {
    if (Number(roundOrdem) !== 1) return;
    const n = typeof pct === 'number' ? pct : Number(pct) || 0;
    const ro = Number(roundOrdem);
    setEditRounds((prev) => {
      const cp = JSON.parse(JSON.stringify(prev));
      const ix = cp.findIndex((r) => Number(r.ordem) === ro);
      if (ix < 0) return prev;
      const r = cp[ix];
      if (!r?.markup_veiculos) return prev;
      const mv = r.markup_veiculos.find((m) => Number(m.veiculo_id) === Number(veiculoId));
      if (mv) mv.percentual_markup = n;
      return cp;
    });
  }, []);

  const updateDescontoColDetalhe = useCallback((veiculoId, roundOrdem, pct) => {
    if (Number(roundOrdem) < 2) return;
    const n = typeof pct === 'number' ? pct : Number(pct) || 0;
    const ro = Number(roundOrdem);
    setEditRounds((prev) => {
      const cp = JSON.parse(JSON.stringify(prev));
      const ix = cp.findIndex((r) => Number(r.ordem) === ro);
      if (ix < 0) return prev;
      const r = cp[ix];
      r.descontos_coluna = Array.isArray(r.descontos_coluna) ? r.descontos_coluna : [];
      r.descontos_coluna = r.descontos_coluna.filter((dc) => Number(dc.veiculo_id) !== Number(veiculoId));
      if (n !== 0) r.descontos_coluna.push({ veiculo_id: veiculoId, percentual_desconto: n });
      return cp;
    });
  }, []);

  const updateDescontoFaixaRulePct = useCallback((faixaId, roundOrdem, ruleIndex, pct) => {
    if (Number(roundOrdem) < 2) return;
    const n = typeof pct === 'number' ? pct : Number(pct) || 0;
    const ro = Number(roundOrdem);
    setEditRounds((prev) => {
      const cp = JSON.parse(JSON.stringify(prev));
      const ix = cp.findIndex((r) => Number(r.ordem) === ro);
      if (ix < 0) return prev;
      const r = cp[ix];
      r.descontos_faixa = Array.isArray(r.descontos_faixa) ? [...r.descontos_faixa] : [];
      const others = r.descontos_faixa.filter((df) => String(df.faixa_id) !== String(faixaId));
      let list = r.descontos_faixa.filter((df) => String(df.faixa_id) === String(faixaId));

      if (list.length === 0 && n !== 0) {
        list = [{ faixa_id: faixaId, percentual_desconto: n, veiculo_ids: null }];
        r.descontos_faixa = [...others, ...list];
        return cp;
      }
      if (list.length === 0) return prev;

      if (n === 0) {
        if (ruleIndex >= 0 && ruleIndex < list.length) list.splice(ruleIndex, 1);
      } else if (ruleIndex >= 0 && ruleIndex < list.length) {
        list[ruleIndex] = { ...list[ruleIndex], percentual_desconto: n };
      }
      r.descontos_faixa = [...others, ...list];
      return cp;
    });
  }, []);

  const toggleDescontoFaixaRuleVeiculoDetalhe = useCallback((faixaId, roundOrdem, ruleIndex, veiculoId) => {
    if (Number(roundOrdem) < 2) return;
    const ro = Number(roundOrdem);
    setEditRounds((prev) => {
      const cp = JSON.parse(JSON.stringify(prev));
      const ix = cp.findIndex((r) => Number(r.ordem) === ro);
      if (ix < 0) return prev;
      const r = cp[ix];
      r.descontos_faixa = Array.isArray(r.descontos_faixa) ? [...r.descontos_faixa] : [];
      const others = r.descontos_faixa.filter((df) => String(df.faixa_id) !== String(faixaId));
      let list = r.descontos_faixa.filter((df) => String(df.faixa_id) === String(faixaId));
      if (!list[ruleIndex]) return prev;
      const entry = list[ruleIndex];
      const allVids = veiculosSnap.map((x) => Number(x.id));
      let ids = entry.veiculo_ids;
      if (ids == null || !Array.isArray(ids)) {
        ids = [...allVids];
      } else {
        ids = [...ids.map(Number)];
      }
      const seto = new Set(ids);
      const vidn = Number(veiculoId);
      if (seto.has(vidn)) seto.delete(vidn);
      else seto.add(vidn);
      const next = Array.from(seto);
      if (next.length === 0) {
        entry.veiculo_ids = [];
      } else if (next.length >= allVids.length) {
        entry.veiculo_ids = null;
      } else {
        entry.veiculo_ids = next.sort((a, b) => a - b);
      }
      list[ruleIndex] = { ...entry };
      r.descontos_faixa = [...others, ...list];
      return cp;
    });
  }, [veiculosSnap]);

  const addDescontoFaixaRegraDetalhe = useCallback((faixaId, roundOrdem) => {
    if (Number(roundOrdem) < 2) return;
    const ro = Number(roundOrdem);
    setEditRounds((prev) => {
      const cp = JSON.parse(JSON.stringify(prev));
      const ix = cp.findIndex((r) => Number(r.ordem) === ro);
      if (ix < 0) return prev;
      const r = cp[ix];
      r.descontos_faixa = Array.isArray(r.descontos_faixa) ? [...r.descontos_faixa] : [];
      const vid0 = veiculosSnap[0]?.id;
      r.descontos_faixa.push({
        faixa_id: faixaId,
        percentual_desconto: 0,
        veiculo_ids: vid0 != null ? [Number(vid0)] : [],
      });
      return cp;
    });
  }, [veiculosSnap]);

  const removeDescontoFaixaRegraDetalhe = useCallback((faixaId, roundOrdem, ruleIndex) => {
    if (Number(roundOrdem) < 2) return;
    const ro = Number(roundOrdem);
    setEditRounds((prev) => {
      const cp = JSON.parse(JSON.stringify(prev));
      const ix = cp.findIndex((r) => Number(r.ordem) === ro);
      if (ix < 0) return prev;
      const r = cp[ix];
      r.descontos_faixa = Array.isArray(r.descontos_faixa) ? [...r.descontos_faixa] : [];
      const others = r.descontos_faixa.filter((df) => String(df.faixa_id) !== String(faixaId));
      let list = r.descontos_faixa.filter((df) => String(df.faixa_id) === String(faixaId));
      if (ruleIndex >= 0 && ruleIndex < list.length) list.splice(ruleIndex, 1);
      r.descontos_faixa = [...others, ...list];
      return cp;
    });
  }, []);

  const addRoundDetalhe = useCallback(() => {
    setEditRounds((prev) => {
      const nextOrd = prev.length ? Math.max(...prev.map((x) => Number(x.ordem) || 0)) + 1 : 1;
      const vids = veiculosSnap.map((x) => x.id);
      return [
        ...prev,
        {
          ordem: nextOrd,
          nome: `Frete KM round ${nextOrd}`,
          markup_veiculos: vids.map((id) => ({ veiculo_id: id, percentual_markup: 0 })),
          markup_rotas: [],
          descontos_faixa: [],
          descontos_coluna: [],
        },
      ];
    });
  }, [veiculosSnap]);

  const excluirRoundPorOrdem = useCallback((ordem) => {
    const ro = Number(ordem);
    if (!Number.isFinite(ro) || ro <= 1) {
      setConfirmExcluirRound(null);
      return;
    }
    setEditRounds((prev) => {
      const filtered = prev.filter((x) => Number(x.ordem) !== ro);
      if (filtered.length === 0) return prev;
      return filtered.map((r, i) => {
        const newOrd = i + 1;
        const nm = String(r.nome || '').trim();
        const isDefaultName = /^Frete\s+KM\s+round\s+\d+$/i.test(nm);
        return {
          ...r,
          ordem: newOrd,
          nome: isDefaultName || !nm ? `Frete KM round ${newOrd}` : r.nome,
        };
      });
    });
    setConfirmExcluirRound(null);
  }, []);

  const salvarDetalhe = async () => {
    if (!detalhe?.id) return;
    setErro('');
    setSalvandoDetalhe(true);
    try {
      const linhas = rowsSnap.map((r) => ({
        id: r.id,
        celulas: veiculosSnap.map((v) => {
          const vid = String(v.id);
          const cell = r.byVeiculoId[vid] || {};
          const rawFreq = editFrequencia[r.id]?.[vid];
          const freqParsed =
            rawFreq !== undefined && rawFreq !== ''
              ? parseFrequenciaValor(rawFreq)
              : cell.frequencia != null
                ? parseFrequenciaValor(String(cell.frequencia))
                : parseFrequenciaValor(
                    r.frequencia != null ? String(r.frequencia) : '',
                  );
          const rawKm = editKmTotal[r.id]?.[vid];
          const kmParsed =
            rawKm !== undefined && rawKm !== ''
              ? parseKmTotalValor(rawKm)
              : cell.km_total != null
                ? parseKmTotalValor(String(cell.km_total))
                : null;
          return {
            veiculo_id: v.id,
            custo: editCustos[r.id]?.[vid] ?? cell.custo ?? 0,
            frequencia: freqParsed,
            km_total: kmParsed,
          };
        }),
      }));
      const minOrd = menorOrdemRound(editRounds);
      const rounds = editRounds.map((r) => {
        const ord = Number(r.ordem) || 1;
        const isFirst = isPrimeiroRoundFrete(ord, editRounds);
        return {
          ordem: r.ordem,
          nome: r.nome || '',
          markup_veiculos: (r.markup_veiculos || []).map((mv) => ({
            veiculo_id: mv.veiculo_id,
            percentual_markup: isFirst ? Number(mv.percentual_markup) || 0 : 0,
          })),
          markup_rotas: isFirst
            ? (r.markup_rotas || []).map((mr) => ({
                uf_origem: String(mr.uf_origem || '')
                  .toUpperCase()
                  .slice(0, 2),
                uf_destino: String(mr.uf_destino || '')
                  .toUpperCase()
                  .slice(0, 2),
                veiculo_id: mr.veiculo_id != null ? Number(mr.veiculo_id) : null,
                percentual_markup: Number(mr.percentual_markup) || 0,
              }))
            : [],
          descontos_faixa: (r.descontos_faixa || []).map((df) => ({
            faixa_id: df.faixa_id,
            percentual_desconto: df.percentual_desconto,
            veiculo_ids: df.veiculo_ids,
          })),
          descontos_coluna: (r.descontos_coluna || []).map((dc) => ({
            veiculo_id: dc.veiculo_id,
            percentual_desconto: dc.percentual_desconto,
          })),
        };
      });
      const updated = await fetchJsonPut(`/cotacao-faixa-km/${detalhe.id}/`, { linhas, rounds });
      const d = apiDetailToDetalhe(updated);
      setDetalhe(d);
      hydrateEditsFromDetalhe(d);
      setMarkupAplicadoMsg('Alterações gravadas (custos, fretes e markup por rota).');
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setSalvandoDetalhe(false);
    }
  };

  const dreTelaAtiva = view === 'detalhe' && detalhe && dreModalOpen;

  return (
    <div className="space-y-4">
      {!dreTelaAtiva && (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Cotações por faixa de KM</h1>
        </div>
        {view === 'list' && (
          <button
            type="button"
            onClick={() => {
              resetFormulario();
              setView('form');
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nova cotação
          </button>
        )}
        {view !== 'list' && (
          <button
            type="button"
            onClick={() => {
              setView('list');
              setDetalhe(null);
              setEditCustos({});
              setEditRounds([]);
              setErro('');
              setConfirmExcluirRound(null);
              setAmpliarModalOpen(false);
              setDreModalOpen(false);
              setDetalhePainel(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        )}
      </div>
      )}

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>
      )}

      {view === 'list' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <Table2 className="h-4 w-4" />
              Histórico
            </div>
            <button
              type="button"
              onClick={() => carregarDadosApi({ listaSomente: true })}
              disabled={loadingLista}
              className="text-[11px] font-bold uppercase text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {loadingLista ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Layout</th>
                  <th className="px-4 py-3">Linhas</th>
                  <th className="px-4 py-3">Status cotação</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {loadingLista && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                    </td>
                  </tr>
                )}
                {!loadingLista && lista.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Nenhuma cotação por faixa de KM ainda. Clique em <strong>Nova cotação</strong>.
                    </td>
                  </tr>
                )}
                {!loadingLista &&
                  lista.map((c) => {
                    const layoutLabel = c.layout_mode === 'planilha' ? 'Planilha' : 'Matriz';
                    return (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{c.id}</td>
                        <td className="px-4 py-3 text-slate-600">{fmtData(c.created_at)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{c.cliente_nome || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{layoutLabel}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{c.linhas_count ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{c.status_cotacao ? String(c.status_cotacao) : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => abrirDetalhe(c)}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-800"
                          >
                            Abrir tabela
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'form' && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm">
              <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-violet-900">
                Configuração antes de gerar
              </p>
              <p className="mb-3 text-[10px] leading-snug text-violet-800/90">
                Ajuste LAIR, prazo e representante antes de montar a matriz. O <strong>L %</strong> aparece apenas no total frete faixa (custo + markup totais).
              </p>
              <CamposConfigDreFaixaKm
                parametrosDre={parametrosDre}
                setParametrosDre={setParametrosDre}
                listaRepresentantes={listaRepresentantes}
                embedded
              />
              <div className="mt-3">
                <label className="text-[10px] font-bold uppercase text-violet-900">Tabela ANTT</label>
                <select
                  value={anttTabela}
                  onChange={(e) => setAnttTabela(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-800 outline-none focus:border-violet-500"
                  title="Tabela de frete mínimo ANTT (CC e formação de custo)"
                >
                  {ANTT_TABELAS_OPCOES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] leading-snug text-violet-800/85">
                  Total custo faixa: <strong>(km rep. × CCD) + CC</strong> da tabela escolhida (cadastro em Veículos).
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <User className="h-4 w-4" />
                Cliente
              </div>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="">Selecione…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_empresa}
                  </option>
                ))}
              </select>
              {!clientes.length && (
                <p className="mt-2 text-[11px] font-semibold text-amber-900">
                  Nenhum cliente listado: ou não há cadastros em <span className="font-mono">/clientes/</span>, ou a chamada falhou (veja o alerta vermelho). Em
                  dev com Docker, as requisições passam por <span className="font-mono">{getApiBase()}</span> (proxy do Vite → API na porta 8000 do host).
                </p>
              )}
              {clienteSelecionado && (
                <p className="mt-2 text-[11px] text-slate-500">
                  O <strong>Frete KM round 1</strong> usa só o markup (M%) por veículo. Os descontos da coluna (D%) e da faixa (Desc. faixa %) entram a partir do{' '}
                  <strong>round 2</strong>, sobre o valor já calculado do round anterior. Cada célula de frete mostra o M% efetivo e os D% quando houver.
                </p>
              )}
            </div>

            {clienteId ? (
              <ContratacaoTabelaFaixaKm
                parametrosDre={parametrosDre}
                setParametrosDre={setParametrosDre}
                listaClienteTaxas={listaClienteTaxas}
                showTabelaClienteList={showTabelaClienteList}
                setShowTabelaClienteList={setShowTabelaClienteList}
                malhaSpotTipo={clienteTaxasCfg?.malha_spot_tipo}
                markupRotasCount={markupRotasPreview.length}
              />
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                  <Upload className="h-4 w-4" />
                  Planilha (origem, destino, faixa)
                </div>
                <button
                  type="button"
                  onClick={baixarModeloCsv}
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-blue-600 hover:text-blue-800"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Modelo CSV
                </button>
              </div>
              <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
                Colunas aceitas: <strong>origem</strong>, <strong>destino</strong>, <strong>faixa_km</strong> (ou faixa) e opcionalmente{' '}
                <strong>frequencia</strong>, ou{' '}
                <strong>km_min</strong> + <strong>km_max</strong>. UFs com 2 letras. Arquivos .csv, .txt, .xlsx.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase text-slate-700 hover:bg-slate-100">
                  <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={onArquivoPlanilha} disabled={parseandoPlanilha} />
                  {parseandoPlanilha ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Enviar planilha
                </label>
                {planilhaMode && (
                  <button
                    type="button"
                    onClick={limparPlanilha}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase text-red-800 hover:bg-red-100"
                  >
                    <X className="h-3.5 w-3.5" />
                    Limpar importação
                  </button>
                )}
              </div>
              {planilhaInfo && <p className="mt-2 text-[11px] font-semibold text-emerald-800">{planilhaInfo}</p>}
            </div>

            <div className={`rounded-xl border bg-white p-4 shadow-sm ${planilhaMode ? 'border-amber-200 opacity-80' : 'border-slate-200'}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                  <MapPin className="h-4 w-4" />
                  Origem / destino (UF)
                </div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => marcarTodasRotas(true)} className="text-[10px] font-bold uppercase text-blue-600">
                    Todas
                  </button>
                  <span className="text-slate-300">|</span>
                  <button type="button" onClick={() => marcarTodasRotas(false)} className="text-[10px] font-bold uppercase text-slate-500">
                    Nenhuma
                  </button>
                  <span className="text-slate-300">|</span>
                  <button type="button" onClick={restaurarRotasPadrao} className="text-[10px] font-bold uppercase text-slate-500">
                    Padrão
                  </button>
                </div>
              </div>
              {planilhaMode && (
                <p className="mb-2 text-[10px] font-semibold uppercase text-amber-800">Ignorado enquanto a planilha importada estiver ativa.</p>
              )}
              <div className="mb-3 max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-100 p-2">
                {rotasLista.map((r) => (
                  <label key={r.key} className="flex cursor-pointer items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={r.active}
                      onChange={() => toggleRota(r.key)}
                      disabled={planilhaMode}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                    />
                    <span className="font-mono font-semibold text-slate-800">
                      {r.origem} → {r.destino}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400">Origem UF</label>
                  <input
                    value={novaOrigem}
                    onChange={(e) => setNovaOrigem(e.target.value)}
                    maxLength={2}
                    disabled={planilhaMode}
                    className="mt-0.5 w-16 rounded border border-slate-200 px-2 py-1.5 font-mono text-[13px] uppercase outline-none focus:border-blue-500 disabled:bg-slate-100"
                    placeholder="PR"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400">Destino UF</label>
                  <input
                    value={novaDestino}
                    onChange={(e) => setNovaDestino(e.target.value)}
                    maxLength={2}
                    disabled={planilhaMode}
                    className="mt-0.5 w-16 rounded border border-slate-200 px-2 py-1.5 font-mono text-[13px] uppercase outline-none focus:border-blue-500 disabled:bg-slate-100"
                    placeholder="SC"
                  />
                </div>
                <button
                  type="button"
                  onClick={adicionarRotaUf}
                  disabled={planilhaMode}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-slate-900 disabled:opacity-40"
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className={`rounded-xl border bg-white p-4 shadow-sm ${planilhaMode ? 'border-amber-200 opacity-80' : 'border-slate-200'}`}>
              <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <Ruler className="h-4 w-4" />
                Faixas de KM
              </div>
              {planilhaMode && (
                <p className="mb-2 text-[10px] font-semibold uppercase text-amber-800">Cada linha da planilha traz a própria faixa; chips abaixo não se aplicam ao layout.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {FAIXAS_KM_OPCOES.map((f) => (
                  <ToggleChip
                    key={f.id}
                    active={faixaIdsSel.has(f.id)}
                    disabled={planilhaMode}
                    onClick={() => toggleFaixa(f.id)}
                  >
                    {f.label.replace(/ Km/g, ' km')}
                  </ToggleChip>
                ))}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-2 text-[10px] font-black uppercase text-slate-500">Faixa customizada</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-400">Km mín.</label>
                    <input
                      type="number"
                      min={1}
                      value={customMin}
                      onChange={(e) => setCustomMin(e.target.value)}
                      disabled={planilhaMode}
                      className="mt-0.5 w-24 rounded border border-slate-200 px-2 py-1.5 text-[13px] outline-none focus:border-blue-500 disabled:bg-slate-100"
                      placeholder="ex: 12"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-400">Km máx. (opcional)</label>
                    <input
                      type="number"
                      min={1}
                      value={customMax}
                      onChange={(e) => setCustomMax(e.target.value)}
                      disabled={planilhaMode}
                      className="mt-0.5 w-24 rounded border border-slate-200 px-2 py-1.5 text-[13px] outline-none focus:border-blue-500 disabled:bg-slate-100"
                      placeholder="vazio = acima"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={adicionarFaixaCustom}
                    disabled={planilhaMode}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase text-blue-800 hover:bg-blue-100 disabled:opacity-40"
                  >
                    Incluir faixa
                  </button>
                </div>
                {customFaixas.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[12px]">
                    {customFaixas.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-2 rounded border border-slate-100 px-2 py-1">
                        <span className="font-medium text-slate-700">{f.label}</span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[10px] text-slate-500">
                            <input
                              type="checkbox"
                              checked={faixaIdsSel.has(f.id)}
                              onChange={() => toggleFaixa(f.id)}
                              disabled={planilhaMode}
                            />
                            usar
                          </label>
                          <button type="button" onClick={() => removerFaixaCustom(f.id)} className="text-red-600 hover:underline text-[10px] uppercase font-bold">
                            remover
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {clienteId && veiculosPreview.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Markup e descontos ao gerar (Frete KM round 1)
                </div>
                <p className="mb-3 text-[11px] text-slate-500">
                  Com <strong>Contratação (tabela)</strong> e <strong>% LAIR</strong> preenchidos, o markup do round 1 é calculado pela malha SPOT (por rota UF e ICMS).
                  O campo <strong>Markup %</strong> abaixo mostra a média das rotas; o frete na tabela usa o % exato de cada par origem/destino.
                  Descontos entram do <strong>round 2</strong> em diante.
                </p>
                <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                  {veiculosPreview.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-100 px-2 py-1.5 text-[12px]">
                      <span className="min-w-[7rem] font-semibold text-slate-800">{v.tipo_veiculo}</span>
                      <label className="flex items-center gap-1 text-[10px] text-slate-600">
                        Markup %
                        <PctInput
                          value={markupPreviewByVid[String(v.id)] ?? 0}
                          onCommit={(n) => setMarkupPreviewByVid((prev) => ({ ...prev, [String(v.id)]: n }))}
                          className="w-[5.25rem] rounded border border-slate-200 px-1 py-0.5 text-right font-mono text-[12px]"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-slate-600">
                        Desc. col. %
                        <PctInput
                          value={descontoColPreviewByVid[String(v.id)] ?? 0}
                          onCommit={(n) => setDescontoColPreviewByVid((prev) => ({ ...prev, [String(v.id)]: n }))}
                          className="w-[5.25rem] rounded border border-slate-200 px-1 py-0.5 text-right font-mono text-[12px]"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600">
                <strong>Markup e descontos</strong> aparecem aqui depois que você <strong>selecionar o cliente</strong> e <strong>marcar ao menos um veículo</strong>{' '}
                — são aplicados somente ao clicar em <strong>Gerar e gravar</strong>.
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <Truck className="h-4 w-4" />
                Veículos
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {veiculos.map((v) => (
                  <label
                    key={v.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 px-2 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={veiculoIdsSel.has(String(v.id))}
                      onChange={() => toggleVeiculo(v.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-[13px] font-semibold text-slate-800">{v.tipo_veiculo}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={salvando}
              onClick={salvarNova}
              className="w-full rounded-xl bg-blue-600 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow hover:bg-blue-700 disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Gerar e gravar cotação'}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Pré-visualização</p>
              {clienteId && parametrosDre.tabelaCliente ? (
                <p className="text-[10px] font-semibold text-violet-800">
                  {parametrosDre.tabelaCliente} · LAIR {parametrosDre.percentualLairDesejada}% · prazo {parametrosDre.prazoPagamento ?? 30}d
                </p>
              ) : null}
            </div>
            {previewRows.length === 0 ? (
              <p className="text-sm text-slate-500">Ajuste rotas, faixas ou importe uma planilha para ver a matriz.</p>
            ) : (
              <div className="h-[calc(100dvh-13rem)] min-h-[220px] min-w-0 w-full max-w-full overflow-x-scroll overflow-y-auto rounded-lg border border-slate-200 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
                <FaixaKmTable
                  veiculos={veiculosPreview}
                  rows={previewRows}
                  roundLabels={previewRoundLabels}
                  anttTabela={anttTabelaAtiva}
                  frequenciaByRowKey={frequenciaByRowKey}
                  onFrequenciaChange={(key, val) =>
                    setFrequenciaByRowKey((prev) => ({ ...prev, [key]: val }))
                  }
                  kmTotalByCellKey={kmTotalByCellKey}
                  onKmTotalChangeKey={(key, val) =>
                    setKmTotalByCellKey((prev) => ({ ...prev, [key]: val }))
                  }
                  lairPctByCellKey={lairPctPreview}
                  lairDesejadaPct={parametrosDre.percentualLairDesejada}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {dreTelaAtiva && (
        <div className="-mx-2 flex min-h-[calc(100dvh-2rem)] w-full max-w-[100vw] flex-col overflow-x-hidden bg-slate-100 sm:-mx-4 sm:min-h-[calc(100dvh-3rem)]">
          <header className="shrink-0 border-b border-slate-200 bg-white shadow-sm">
            <div className="mx-auto flex w-full max-w-full flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">DRE — Base lucro</h2>
                <p className="mt-0.5 text-[12px] text-slate-600">
                  Cotação #{detalhe.id} · {detalhe.cliente_nome}
                  {parametrosDre.tabelaCliente ? (
                    <span className="text-slate-500">
                      {' '}
                      · {parametrosDre.tabelaCliente} · LAIR {parametrosDre.percentualLairDesejada}%
                    </span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDreModalOpen(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-black uppercase text-slate-800 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Voltar à cotação
              </button>
            </div>
          </header>
          <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col px-2 py-4 sm:px-4 sm:py-6">
            <DreBaseLucroPanel
              fullscreen
              dre={dreRoundUnico.dre}
              meta={dreRoundUnico.meta}
              roundsDre={drePorRound}
              filtros={dreFiltros}
              onFiltrosChange={setDreFiltros}
              faixas={faixasDreOpts}
              veiculos={veiculosSnap}
              rounds={roundLabelsDet}
            />
          </div>
        </div>
      )}

      {view === 'detalhe' && detalhe && !dreTelaAtiva && (
        <div className="min-w-0">
          <div className="flex max-h-[calc(100dvh-5.25rem)] min-h-[280px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/40 shadow-sm">
            <div className="shrink-0 space-y-3 border-b border-slate-200/80 bg-slate-50/50 px-2 pb-3 pt-2 sm:px-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <div>
                    <span className="font-black text-slate-900">Cotação #{detalhe.id}</span>
                    <span className="mx-2 text-slate-300">|</span>
                    {detalhe.cliente_nome}
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-900" title="Tabela ANTT usada na formação de custo">
                      ANTT {detalhe.antt_tabela || 'A'}
                    </span>
                    <span className="mx-2 text-slate-300">|</span>
                    {fmtData(detalhe.created_at)}
                    {detalhe.status_cotacao ? (
                      <>
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                          {detalhe.status_cotacao}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-end justify-end gap-2">
                    <button
                      type="button"
                      onClick={addRoundDetalhe}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase text-slate-800 hover:bg-slate-100"
                    >
                      + Frete KM round
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetalhePainel((p) => (p === 'config' ? null : 'config'))}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black uppercase ${
                        detalhePainel === 'config'
                          ? 'border-violet-600 bg-violet-50 text-violet-900 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <Settings2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                      Configurações
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetalhePainel((p) => (p === 'rounds' ? null : 'rounds'))}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black uppercase ${
                        detalhePainel === 'rounds'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <Ruler className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                      Rounds
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetalhePainel((p) => (p === 'colunas' ? null : 'colunas'))}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black uppercase ${
                        detalhePainel === 'colunas'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <Table2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                      Colunas
                    </button>
                    <button
                      type="button"
                      onClick={() => setDreModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase text-slate-800 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-900"
                    >
                      <LineChart className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                      DRE
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmpliarModalOpen(true)}
                      className="rounded-lg border border-emerald-700 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-900 hover:bg-emerald-100"
                    >
                      Ampliar cotação…
                    </button>
                    <button
                      type="button"
                      disabled={salvandoDetalhe || !rowsSnap.length}
                      onClick={salvarDetalhe}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-[10px] font-black uppercase text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {salvandoDetalhe ? 'Salvando…' : 'Salvar alterações'}
                    </button>
                  </div>
                </div>

          {detalhePainel === 'config' && (
            <div className="rounded-xl border border-violet-200 bg-white text-[12px] shadow-sm">
              <div className="flex items-center justify-between border-b border-violet-100 bg-violet-50/60 px-3 py-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-violet-900">
                  Configurações (LAIR / markup)
                </span>
                <button
                  type="button"
                  onClick={() => setDetalhePainel(null)}
                  className="rounded p-1 text-violet-600 hover:bg-violet-100 hover:text-violet-900"
                  aria-label="Fechar configurações"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-4">
                <ContratacaoTabelaFaixaKm
                  parametrosDre={parametrosDre}
                  setParametrosDre={setParametrosDre}
                  listaClienteTaxas={listaClienteTaxas}
                  showTabelaClienteList={showTabelaClienteList}
                  setShowTabelaClienteList={setShowTabelaClienteList}
                  malhaSpotTipo={clienteTaxasCfg?.malha_spot_tipo}
                  compact
                />
                <CamposConfigDreFaixaKm
                  parametrosDre={parametrosDre}
                  setParametrosDre={setParametrosDre}
                  listaRepresentantes={listaRepresentantes}
                />
                <div className="space-y-2 border-t border-violet-100 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => aplicarMarkupTabelaDetalhe()}
                      disabled={!parametrosDre.tabelaCliente || aplicarMarkupBusy}
                      className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-[10px] font-black uppercase text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                    >
                      {aplicarMarkupBusy ? 'Aplicando…' : 'Aplicar markup no round 1'}
                    </button>
                    <p className="text-[10px] leading-snug text-slate-500">
                      Atualiza o % por rota e recalcula os fretes na tabela. O <strong>L %</strong> no total frete usa LAIR, prazo e representante abaixo.
                    </p>
                  </div>
                  {markupAplicadoMsg ? (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-900">
                      {markupAplicadoMsg}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {detalhePainel === 'rounds' && (
            <div className="rounded-xl border border-slate-200 bg-white text-[12px] shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">Rounds (Frete KM)</span>
                <button
                  type="button"
                  onClick={() => setDetalhePainel(null)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Fechar painel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2 px-3 py-3 text-[11px] text-slate-700">
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {[...editRounds]
                    .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0))
                    .map((r) => {
                      const ord = Number(r.ordem) || 1;
                      const label = r.nome || `Frete KM round ${ord}`;
                      return (
                        <li
                          key={ord}
                          className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 px-3 py-2.5 text-[12px] first:rounded-t-lg last:rounded-b-lg"
                        >
                          <span className="text-slate-800">
                            <span className="font-black text-slate-600">R{ord}</span>
                            <span className="mx-2 text-slate-300">·</span>
                            <span className="font-medium">{label}</span>
                          </span>
                          {ord > 1 ? (
                            <button
                              type="button"
                              onClick={() => setConfirmExcluirRound({ ordem: ord, nome: label })}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-red-700 shadow-sm hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              Excluir
                            </button>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Obrigatório</span>
                          )}
                        </li>
                      );
                    })}
                </ul>
                <p className="text-[10px] leading-snug text-slate-500">
                  O <strong>round 1</strong> não pode ser excluído. Ao excluir um round 2+, os demais são <strong>renumerados</strong>. Clique em{' '}
                  <strong>Salvar alterações</strong> para gravar no servidor.
                </p>
              </div>
            </div>
          )}
            </div>

          {confirmExcluirRound && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="excluir-round-titulo"
              onClick={(e) => {
                if (e.target === e.currentTarget) setConfirmExcluirRound(null);
              }}
            >
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                <h2 id="excluir-round-titulo" className="text-sm font-black uppercase tracking-wide text-slate-900">
                  Confirmar exclusão do round
                </h2>
                <p className="mt-3 text-[13px] leading-relaxed text-slate-700">
                  Excluir <strong className="text-slate-900">{confirmExcluirRound.nome}</strong> (ordem{' '}
                  <strong>{confirmExcluirRound.ordem}</strong>)? Os rounds com ordem maior serão renumerados. Esta alteração só será persistida após{' '}
                  <strong>Salvar alterações</strong>.
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmExcluirRound(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-[11px] font-bold uppercase text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => excluirRoundPorOrdem(confirmExcluirRound.ordem)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-[11px] font-black uppercase text-white shadow hover:bg-red-700"
                  >
                    Excluir round
                  </button>
                </div>
              </div>
            </div>
          )}

          {ampliarModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ampliar-cotacao-titulo"
              onClick={(e) => {
                if (e.target === e.currentTarget) setAmpliarModalOpen(false);
              }}
            >
              <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h2 id="ampliar-cotacao-titulo" className="text-[12px] font-black uppercase tracking-widest text-slate-800">
                    Ampliar cotação
                  </h2>
                  <button
                    type="button"
                    onClick={() => setAmpliarModalOpen(false)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4 p-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">Pré-visualização</p>
                    <ul className="space-y-1.5 text-[12px] text-slate-800">
                      <li>
                        <span className="font-bold text-slate-600">Nova linha:</span> {ampliarPreviewLinha}
                      </li>
                      <li>
                        <span className="font-bold text-slate-600">Veículo a incluir:</span>{' '}
                        {ampliarPreviewVeiculoNome || '— (nenhum selecionado)'}
                      </li>
                    </ul>
                  </div>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <p className="mb-2 text-[11px] font-semibold text-slate-700">
                        Incluir veículo que ainda não está na tabela (custos sugeridos pelo cadastro em todas as linhas).
                      </p>
                      <div className="flex flex-wrap items-end gap-2">
                        <select
                          value={novoVeiculoId}
                          onChange={(e) => setNovoVeiculoId(e.target.value)}
                          className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[12px] font-semibold text-slate-800"
                        >
                          <option value="">Escolha o veículo…</option>
                          {veiculosForaDaCotacao.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.tipo_veiculo}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={addVeiculoBusy || !novoVeiculoId || !veiculosForaDaCotacao.length}
                          onClick={adicionarVeiculoNaCotacaoExistente}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {addVeiculoBusy ? '…' : 'Incluir veículo'}
                        </button>
                      </div>
                      {!veiculosForaDaCotacao.length && (
                        <p className="mt-2 text-[10px] text-slate-500">Todos os veículos cadastrados já estão nesta cotação.</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-semibold text-slate-700">
                        Nova linha: rota UF + faixa padrão de KM (custos por cadastro de veículo).
                      </p>
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-slate-500">Origem</label>
                          <input
                            value={addLinhaOrigem}
                            onChange={(e) => setAddLinhaOrigem(e.target.value.toUpperCase().slice(0, 2))}
                            maxLength={2}
                            className="mt-0.5 w-14 rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-[13px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-slate-500">Destino</label>
                          <input
                            value={addLinhaDestino}
                            onChange={(e) => setAddLinhaDestino(e.target.value.toUpperCase().slice(0, 2))}
                            maxLength={2}
                            className="mt-0.5 w-14 rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-[13px]"
                          />
                        </div>
                        <div className="min-w-[10rem] flex-1">
                          <label className="block text-[9px] font-bold uppercase text-slate-500">Faixa</label>
                          <select
                            value={addLinhaFaixaId}
                            onChange={(e) => setAddLinhaFaixaId(e.target.value)}
                            className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]"
                          >
                            {FAIXAS_KM_OPCOES.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          disabled={addLinhaBusy}
                          onClick={adicionarLinhaNaCotacaoExistente}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {addLinhaBusy ? '…' : 'Incluir linha'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setAmpliarModalOpen(false)}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-[11px] font-bold uppercase text-slate-700 hover:bg-slate-50"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {rowsSnap.length === 0 ? (
            <div className="shrink-0 px-2 py-2 sm:px-3">
              <p className="text-sm text-amber-800">Esta cotação não possui tabela (registro incompleto).</p>
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden px-2 pb-2 pt-1 sm:px-3">
              {detalhePainel === 'colunas' && (
                <div className="shrink-0 rounded-xl border border-slate-200 bg-white text-[12px] shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-600">
                      <Table2 className="h-4 w-4 shrink-0 text-slate-500" />
                      Colunas visíveis
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetalhePainel(null)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-label="Fechar painel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-3 px-3 py-3 text-[11px] text-slate-700">
                  <p className="border-b border-slate-100 pb-2 text-[10px] leading-snug text-slate-500">
                    Marque quais colunas aparecem na grade. Em <span className="font-bold text-slate-700">Por veículo</span>, a primeira linha da tabela
                    liga ou desliga a <strong>mesma coluna em todos os veículos</strong> (ex.: todos os &quot;Custo&quot;). À direita,{' '}
                    <span className="font-bold text-slate-700">Selecionar todos</span> alterna todas as colunas de uma vez.
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                      <input
                        type="checkbox"
                        checked={mergedFaixaKmColVis.rota}
                        onChange={() =>
                          setFaixaKmColVis((prev) => {
                            const t = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                            const m = mergeFaixaKmColVis(t, prev);
                            return { ...m, rota: !m.rota };
                          })
                        }
                      />
                      Rota
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                      <input
                        type="checkbox"
                        checked={mergedFaixaKmColVis.origem}
                        onChange={() =>
                          setFaixaKmColVis((prev) => {
                            const t = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                            const m = mergeFaixaKmColVis(t, prev);
                            return { ...m, origem: !m.origem };
                          })
                        }
                      />
                      Origem
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                      <input
                        type="checkbox"
                        checked={mergedFaixaKmColVis.destino}
                        onChange={() =>
                          setFaixaKmColVis((prev) => {
                            const t = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                            const m = mergeFaixaKmColVis(t, prev);
                            return { ...m, destino: !m.destino };
                          })
                        }
                      />
                      Destino
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                      <input
                        type="checkbox"
                        checked={mergedFaixaKmColVis.faixa}
                        onChange={() =>
                          setFaixaKmColVis((prev) => {
                            const t = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                            const m = mergeFaixaKmColVis(t, prev);
                            return { ...m, faixa: !m.faixa };
                          })
                        }
                      />
                      Faixa de KM
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                      <input
                        type="checkbox"
                        checked={mergedFaixaKmColVis.frequencia}
                        onChange={() =>
                          setFaixaKmColVis((prev) => {
                            const t = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                            const m = mergeFaixaKmColVis(t, prev);
                            return { ...m, frequencia: !m.frequencia };
                          })
                        }
                      />
                      Frequência
                    </label>
                  </div>
                  {roundLabelsDet.filter((lb) => Number(lb.ordem) >= 2).length > 0 && (
                    <div>
                      <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Desc. faixa %</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {roundLabelsDet
                          .filter((lb) => Number(lb.ordem) >= 2)
                          .map((lb) => {
                            const k = String(lb.ordem);
                            return (
                              <label key={k} className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                                <input
                                  type="checkbox"
                                  checked={mergedFaixaKmColVis.descFaixa[k] !== false}
                                  onChange={() =>
                                    setFaixaKmColVis((prev) => {
                                      const t = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                                      const m = mergeFaixaKmColVis(t, prev);
                                      const on = m.descFaixa[k] !== false;
                                      return { ...m, descFaixa: { ...m.descFaixa, [k]: !on } };
                                    })
                                  }
                                />
                                Round {lb.ordem}
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Por veículo</span>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold text-slate-800 shadow-sm hover:bg-slate-100">
                        <input
                          ref={faixaKmColVisSelectAllRef}
                          type="checkbox"
                          checked={faixaKmColVisLeafStats.allOn}
                          onChange={() => {
                            const tpl = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                            const m = mergeFaixaKmColVis(tpl, faixaKmColVis);
                            const stats = countFaixaKmColVisState(m, tpl);
                            if (stats.allOn) setFaixaKmColVis(makeFaixaKmColVisAllOff(tpl));
                            else setFaixaKmColVis(tpl);
                          }}
                        />
                        Selecionar todos
                      </label>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/40 p-2">
                      <div
                        className="grid gap-x-0.5 gap-y-1"
                        style={{
                          gridTemplateColumns: `minmax(6.25rem,8.5rem) repeat(${vehColSpecs.length}, minmax(2.65rem, 1fr))`,
                        }}
                      >
                        <div className="flex items-end pb-1 text-[8px] font-black uppercase leading-tight text-slate-500">
                          Veículo
                        </div>
                        {vehColSpecs.map((spec, idx) => (
                          <div
                            key={`hdr-${spec.id}`}
                            className={`flex flex-col items-center gap-1 border-b border-slate-200 pb-1.5 ${
                              idx >= 2 && (idx - 2) % 2 === 0 ? 'border-l border-slate-200 pl-0.5' : ''
                            }`}
                          >
                            <input
                              ref={(el) => {
                                faixaKmVehColMasterRefs.current[spec.id] = el;
                              }}
                              type="checkbox"
                              checked={Boolean(vehColMasterStats[spec.id]?.allOn)}
                              onChange={() =>
                                setFaixaKmColVis((prev) => {
                                  const t = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                                  const m = mergeFaixaKmColVis(t, prev);
                                  const st =
                                    spec.kind === 'custo'
                                      ? countVehicleColumnVisibility(m, t, (mv) => mv.custoCol !== false)
                                      : spec.kind === 'totalCustoFaixa'
                                        ? countVehicleColumnVisibility(m, t, (mv) => mv.totalCustoFaixa !== false)
                                        : spec.kind === 'frete'
                                          ? countVehicleColumnVisibility(m, t, (mv) => mv.frete?.[spec.fk] !== false)
                                          : countVehicleColumnVisibility(m, t, (mv) => mv.totalFreteFaixa?.[spec.fk] !== false);
                                  const targetOn = !st.allOn;
                                  return applyVehicleColumnVisibilityAll(m, t, spec, targetOn);
                                })
                              }
                              className="h-3.5 w-3.5 shrink-0 rounded border-slate-400"
                              title={spec.title}
                            />
                            <span className="whitespace-normal text-center text-[7px] font-black uppercase leading-tight text-slate-500">
                              {spec.short}
                            </span>
                          </div>
                        ))}
                        {veiculosSnap.map((vv, ri) => {
                          const vid = String(vv.id);
                          const vvM = mergedFaixaKmColVis.veiculos[vid] || {};
                          const rowTop = ri > 0 ? 'border-t border-slate-200 pt-1.5' : 'pt-0.5';
                          return (
                            <React.Fragment key={vid}>
                              <div className={`min-w-0 truncate text-[11px] font-bold tracking-tight text-slate-900 ${rowTop}`}>
                                {vv.tipo}
                              </div>
                              {vehColSpecs.map((spec, idx) => {
                                const roundSep = idx >= 2 && (idx - 2) % 2 === 0 ? 'border-l border-slate-200 pl-0.5' : '';
                                const cell = `flex items-center justify-center ${rowTop} ${roundSep}`;
                                if (spec.kind === 'freq') {
                                  return (
                                    <div key={`${vid}-${spec.id}`} className={cell}>
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-violet-300"
                                        checked={vvM.freqCol !== false}
                                        title={`${vv.tipo} — Frequência`}
                                        aria-label={`${vv.tipo} — Frequência`}
                                        onChange={() =>
                                          setFaixaKmColVis((prev) => {
                                            const t = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                                            const m = mergeFaixaKmColVis(t, prev);
                                            const base = t.veiculos[vid];
                                            const cur = m.veiculos[vid] || base;
                                            const on = cur.freqCol !== false;
                                            return {
                                              ...m,
                                              veiculos: { ...m.veiculos, [vid]: { ...cur, freqCol: !on } },
                                            };
                                          })
                                        }
                                      />
                                    </div>
                                  );
                                }
                                if (spec.kind === 'custo') {
                                  return (
                                    <div key={`${vid}-${spec.id}`} className={cell}>
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-slate-300"
                                        checked={vvM.custoCol !== false}
                                        title={`${vv.tipo} — Custo`}
                                        aria-label={`${vv.tipo} — Custo`}
                                        onChange={() =>
                                          setFaixaKmColVis((prev) => {
                                            const t = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                                            const m = mergeFaixaKmColVis(t, prev);
                                            const base = t.veiculos[vid];
                                            const cur = m.veiculos[vid] || base;
                                            const on = cur.custoCol !== false;
                                            return {
                                              ...m,
                                              veiculos: { ...m.veiculos, [vid]: { ...cur, custoCol: !on } },
                                            };
                                          })
                                        }
                                      />
                                    </div>
                                  );
                                }
                                if (spec.kind === 'totalCustoFaixa') {
                                  return (
                                    <div key={`${vid}-${spec.id}`} className={cell}>
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-slate-300"
                                        checked={vvM.totalCustoFaixa !== false}
                                        title={`${vv.tipo} — Total custo faixa`}
                                        aria-label={`${vv.tipo} — Total custo faixa`}
                                        onChange={() =>
                                          setFaixaKmColVis((prev) => {
                                            const t = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                                            const m = mergeFaixaKmColVis(t, prev);
                                            const base = t.veiculos[vid];
                                            const cur = m.veiculos[vid] || base;
                                            const on = cur.totalCustoFaixa !== false;
                                            return {
                                              ...m,
                                              veiculos: { ...m.veiculos, [vid]: { ...cur, totalCustoFaixa: !on } },
                                            };
                                          })
                                        }
                                      />
                                    </div>
                                  );
                                }
                                if (spec.kind === 'frete') {
                                  const fk = spec.fk;
                                  return (
                                    <div key={`${vid}-${spec.id}`} className={cell}>
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-slate-300"
                                        checked={vvM.frete?.[fk] !== false}
                                        title={`${vv.tipo} — Frete R${fk}`}
                                        aria-label={`${vv.tipo} — Frete round ${fk}`}
                                        onChange={() =>
                                          setFaixaKmColVis((prev) => {
                                            const t = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                                            const m = mergeFaixaKmColVis(t, prev);
                                            const base = t.veiculos[vid];
                                            const cur = m.veiculos[vid] || base;
                                            const fr = { ...base.frete, ...cur.frete };
                                            const on = fr[fk] !== false;
                                            return {
                                              ...m,
                                              veiculos: { ...m.veiculos, [vid]: { ...cur, frete: { ...fr, [fk]: !on } } },
                                            };
                                          })
                                        }
                                      />
                                    </div>
                                  );
                                }
                                const fk = spec.fk;
                                return (
                                  <div key={`${vid}-${spec.id}`} className={cell}>
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-slate-300"
                                      checked={vvM.totalFreteFaixa?.[fk] !== false}
                                      title={`${vv.tipo} — Total frete faixa R${fk}`}
                                      aria-label={`${vv.tipo} — Total frete faixa R${fk}`}
                                      onChange={() =>
                                        setFaixaKmColVis((prev) => {
                                          const t = buildDefaultFaixaKmColVis(roundLabelsDet, veiculosSnap);
                                          const m = mergeFaixaKmColVis(t, prev);
                                          const base = t.veiculos[vid];
                                          const cur = m.veiculos[vid] || base;
                                          const xr = { ...base.totalFreteFaixa, ...cur.totalFreteFaixa };
                                          const on = xr[fk] !== false;
                                          return {
                                            ...m,
                                            veiculos: {
                                              ...m.veiculos,
                                              [vid]: { ...cur, totalFreteFaixa: { ...xr, [fk]: !on } },
                                            },
                                          };
                                        })
                                      }
                                    />
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              )}
              <div className="min-h-0 min-w-0 flex-1 overflow-auto overflow-x-scroll rounded-xl border border-slate-200 bg-white [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
                <FaixaKmTable
                  veiculos={veiculosComCadastro}
                  rows={displayRowsDetalhe}
                  roundLabels={roundLabelsDet}
                  anttTabela={anttTabelaAtiva}
                  columnVisibility={mergedFaixaKmColVis}
                  editable
                  onCustoChange={(lineId, vid, val) =>
                    setEditCustos((prev) => ({
                      ...prev,
                      [lineId]: { ...prev[lineId], [String(vid)]: val },
                    }))
                  }
                  markupVeiculoPctByVidByOrd={markupVeiculoPctByVidByOrd}
                  onMarkupVeiculoChangeByOrd={updateMarkupVeiculoDetalhe}
                  descontoColunaPctByVidByOrd={descontoColPctByVidByOrd}
                  onDescontoColunaChangeByOrd={updateDescontoColDetalhe}
                  descontoFaixaRulesByOrdFaixa={descontoFaixaRulesByOrdFaixa}
                  onDescontoFaixaRulePctChange={updateDescontoFaixaRulePct}
                  onToggleDescontoFaixaRuleVeiculo={toggleDescontoFaixaRuleVeiculoDetalhe}
                  onAddDescontoFaixaRegra={addDescontoFaixaRegraDetalhe}
                  onRemoveDescontoFaixaRegra={removeDescontoFaixaRegraDetalhe}
                  frequenciaByRowKey={frequenciaMapDetalhe}
                  editFrequenciaByLine={editFrequencia}
                  onFrequenciaChange={(lineId, vid, val) => {
                    setEditFrequencia((prev) => ({
                      ...prev,
                      [lineId]: { ...(prev[lineId] || {}), [String(vid)]: val },
                    }));
                  }}
                  editKmTotalByLine={editKmTotal}
                  onKmTotalChange={(lineId, vid, val) => {
                    setEditKmTotal((prev) => ({
                      ...prev,
                      [lineId]: { ...(prev[lineId] || {}), [String(vid)]: val },
                    }));
                  }}
                  lairPctByCellKey={lairPctDetalhe}
                  lairDesejadaPct={parametrosDre.percentualLairDesejada}
                />
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

function ContratacaoTabelaFaixaKm({
  parametrosDre,
  setParametrosDre,
  listaClienteTaxas = [],
  showTabelaClienteList = false,
  setShowTabelaClienteList,
  malhaSpotTipo,
  markupRotasCount = 0,
  compact = false,
}) {
  const wrap = compact ? '' : 'rounded-xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm';
  return (
    <div className={wrap || undefined}>
      {!compact && (
        <>
          <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-violet-900">Contratação (tabela)</p>
          <p className="mb-3 text-[10px] leading-snug text-violet-800/90">
            Define a malha de markup (ex.: BOTICARIO). O frete do round 1 usa o % por rota UF + ICMS + LAIR desejada.
          </p>
        </>
      )}
      <div className={`relative flex flex-col ${showTabelaClienteList ? 'z-[60]' : ''}`}>
        {compact && (
          <label className="text-[10px] font-bold uppercase text-violet-900">Contratação (tabela)</label>
        )}
        <input
          type="text"
          readOnly
          placeholder="Selecione a tabela…"
          className="mt-1 w-full cursor-pointer rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-[13px] font-bold text-blue-700 outline-none focus:border-violet-400"
          value={parametrosDre.tabelaCliente || ''}
          onClick={() => setShowTabelaClienteList?.((o) => !o)}
          onBlur={() => setTimeout(() => setShowTabelaClienteList?.(false), 220)}
        />
        {showTabelaClienteList && listaClienteTaxas.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-[70] mt-1 max-h-48 overflow-y-auto rounded-md border border-violet-200 bg-white shadow-lg">
            {listaClienteTaxas.map((c) => (
              <li
                key={c.id}
                className="cursor-pointer border-b border-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-800 last:border-0 hover:bg-violet-50"
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  setParametrosDre((p) => ({ ...p, tabelaCliente: c.nome_cliente }));
                  setShowTabelaClienteList?.(false);
                }}
              >
                {c.nome_cliente}
                {c.malha_spot_tipo ? (
                  <span className="ml-1 text-[9px] font-bold uppercase text-violet-600">({c.malha_spot_tipo})</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {malhaSpotTipo ? (
          <span className="mt-1 text-[9px] font-bold uppercase text-violet-700">Malha: {malhaSpotTipo}</span>
        ) : null}
      </div>
      {!compact && markupRotasCount > 0 ? (
        <p className="mt-2 text-[10px] font-semibold text-emerald-800">
          {markupRotasCount} regra(s) de markup por rota ativas na prévia.
        </p>
      ) : null}
      {!compact && parametrosDre.tabelaCliente && markupRotasCount === 0 ? (
        <p className="mt-2 text-[10px] text-amber-800">Selecione rotas e veículos para calcular o markup.</p>
      ) : null}
    </div>
  );
}

/** % LAIR desejada, prazo e representante — nova cotação (sempre) ou painel Configurações no detalhe. */
function CamposConfigDreFaixaKm({ parametrosDre, setParametrosDre, listaRepresentantes, embedded = false }) {
  const inner = (
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-[10px] font-bold uppercase text-violet-900">
          % LAIR desejada
          <select
            value={String(parametrosDre.percentualLairDesejada ?? 20)}
            className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-[13px] font-bold text-violet-950 outline-none focus:border-violet-400"
            onChange={(e) =>
              setParametrosDre((p) => ({ ...p, percentualLairDesejada: Number(e.target.value) }))
            }
          >
            <option value="20">20%</option>
            <option value="18">18%</option>
            <option value="15">15%</option>
            <option value="12">12%</option>
            <option value="10">10%</option>
          </select>
        </label>
        <label className="block text-[10px] font-bold uppercase text-violet-900">
          Prazo pagamento (dias)
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-[13px] font-bold text-violet-950 outline-none focus:border-violet-400"
            value={parametrosDre.prazoPagamento ?? 30}
            onChange={(e) =>
              setParametrosDre((p) => ({ ...p, prazoPagamento: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <label className="block text-[10px] font-bold uppercase text-violet-900">
          Representante
          <select
            value={parametrosDre.representanteId ?? ''}
            className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-[13px] font-semibold text-violet-950 outline-none focus:border-violet-400"
            onChange={(e) => setParametrosDre((p) => ({ ...p, representanteId: e.target.value }))}
          >
            <option value="">Nenhum</option>
            {(listaRepresentantes || []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome} ({Number(r.percentual_comissao).toLocaleString('pt-BR')}%)
              </option>
            ))}
          </select>
        </label>
      </div>
  );
  if (embedded) return inner;
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm">
      <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-violet-900">Parâmetros LAIR (DRE)</p>
      <p className="mb-3 text-[10px] leading-snug text-violet-800/90">
        Usados no <strong>L %</strong> do total frete faixa.
      </p>
      {inner}
    </div>
  );
}

function FaixaKmTable({
  veiculos,
  rows,
  roundLabels,
  anttTabela = 'A',
  columnVisibility,
  editable = false,
  onCustoChange,
  markupVeiculoPctByVidByOrd = null,
  onMarkupVeiculoChangeByOrd = null,
  descontoColunaPctByVidByOrd = null,
  onDescontoColunaChangeByOrd = null,
  descontoFaixaRulesByOrdFaixa = null,
  onDescontoFaixaRulePctChange = null,
  onToggleDescontoFaixaRuleVeiculo = null,
  onAddDescontoFaixaRegra = null,
  onRemoveDescontoFaixaRegra = null,
  frequenciaByRowKey = null,
  editFrequenciaByLine = null,
  onFrequenciaChange = null,
  kmTotalByCellKey = null,
  editKmTotalByLine = null,
  onKmTotalChange = null,
  onKmTotalChangeKey = null,
  lairPctByCellKey = null,
  lairDesejadaPct = 20,
}) {
  const numRounds = useMemo(() => {
    if (roundLabels?.length) return roundLabels.length;
    const vid = veiculos[0]?.id;
    const fr = vid ? rows[0]?.byVeiculoId?.[String(vid)]?.fretesPorRound : null;
    return fr?.length || 1;
  }, [roundLabels, rows, veiculos]);

  const labels = useMemo(() => {
    if (roundLabels?.length >= numRounds) return roundLabels.slice(0, numRounds);
    return Array.from({ length: numRounds }, (_, i) => ({
      ordem: i + 1,
      nome: `Frete KM round ${i + 1}`,
    }));
  }, [roundLabels, numRounds]);

  const vvis = useMemo(
    () => columnVisibility || buildDefaultFaixaKmColVis(labels, veiculos),
    [columnVisibility, labels, veiculos],
  );

  const vehicleVis = useCallback(
    (vid) => {
      const d = { frete: {}, totalFreteFaixa: {} };
      for (const lb of labels) {
        const o = String(lb.ordem);
        d.frete[o] = true;
        d.totalFreteFaixa[o] = true;
      }
      const p = vvis.veiculos[String(vid)] || {};
      return {
        freqCol: p.freqCol !== false,
        custoCol: p.custoCol !== false,
        totalCustoFaixa: p.totalCustoFaixa !== false,
        frete: { ...d.frete, ...p.frete },
        totalFreteFaixa: { ...d.totalFreteFaixa, ...p.totalFreteFaixa },
      };
    },
    [labels, vvis.veiculos],
  );

  const multiRoundEdit = Boolean(
    editable &&
      markupVeiculoPctByVidByOrd &&
      onMarkupVeiculoChangeByOrd &&
      onDescontoColunaChangeByOrd &&
      onDescontoFaixaRulePctChange,
  );
  const discountRoundLabels = useMemo(() => labels.filter((lb) => Number(lb.ordem) >= 2), [labels]);
  const visibleDescRounds = useMemo(
    () => discountRoundLabels.filter((lb) => vvis.descFaixa[String(lb.ordem)] !== false),
    [discountRoundLabels, vvis.descFaixa],
  );

  const showFrequenciaEdit = !!onFrequenciaChange;
  const showKmTotalEdit = Boolean(onKmTotalChange || onKmTotalChangeKey);

  const veiculoById = useMemo(
    () => Object.fromEntries((veiculos || []).map((v) => [String(v.id), v])),
    [veiculos],
  );

  const layoutInit = useMemo(() => loadFaixaKmBaseLayout(), []);
  const [baseColOrder, setBaseColOrder] = useState(layoutInit.order);
  const [baseColWidths, setBaseColWidths] = useState(layoutInit.widths);
  const [dragColKey, setDragColKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const resizeRef = useRef(null);

  useEffect(() => {
    saveFaixaKmBaseLayout(baseColOrder, baseColWidths);
  }, [baseColOrder, baseColWidths]);

  const visibleBaseKeys = useMemo(
    () => baseColOrder.filter((k) => vvis[k] !== false),
    [baseColOrder, vvis],
  );

  const moveBaseCol = useCallback((fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    setBaseColOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(fromKey);
      const to = next.indexOf(toKey);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, fromKey);
      return next;
    });
  }, []);

  const startResizeBaseCol = useCallback((key, clientX) => {
    resizeRef.current = {
      key,
      startX: clientX,
      startW: baseColWidths[key] || DEFAULT_FAIXA_KM_BASE_COL_WIDTHS[key] || 100,
    };
    const onMove = (ev) => {
      if (!resizeRef.current) return;
      const delta = ev.clientX - resizeRef.current.startX;
      const nw = Math.min(420, Math.max(48, Math.round(resizeRef.current.startW + delta)));
      setBaseColWidths((w) => ({ ...w, [resizeRef.current.key]: nw }));
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [baseColWidths]);

  const resetBaseColLayout = useCallback(() => {
    resetFaixaKmBaseLayoutStorage();
    setBaseColOrder([...FAIXA_KM_BASE_COL_KEYS]);
    setBaseColWidths({ ...DEFAULT_FAIXA_KM_BASE_COL_WIDTHS });
  }, []);

  const [quickFilter, setQuickFilter] = useState({ rota: '', origem: '', destino: '', faixa: '', frequencia: '' });

  const displayRows = useMemo(() => {
    const norm = (s) =>
      String(s ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
    const q = {
      rota: norm(quickFilter.rota).trim(),
      origem: norm(quickFilter.origem).trim(),
      destino: norm(quickFilter.destino).trim(),
      faixa: norm(quickFilter.faixa).trim(),
      frequencia: norm(quickFilter.frequencia).trim(),
    };
    if (!q.rota && !q.origem && !q.destino && !q.faixa && !q.frequencia) return rows;
    return rows.filter((r) => {
      if (q.rota) {
        const rotaCurta = norm(`${r.origem || ''}-${r.destino || ''}`);
        if (!norm(r.rotaLabel).includes(q.rota) && !rotaCurta.includes(q.rota)) return false;
      }
      if (q.origem && !norm(r.origem).includes(q.origem)) return false;
      if (q.destino && !norm(r.destino).includes(q.destino)) return false;
      if (q.faixa && !norm(r.faixaLabel).includes(q.faixa)) return false;
      if (q.frequencia) {
        const fk = rowFrequenciaStorageKey(r);
        const fv = frequenciaByRowKey?.[fk] ?? (r.frequencia != null ? String(r.frequencia) : '');
        if (!norm(fv).includes(q.frequencia)) return false;
      }
      return true;
    });
  }, [rows, quickFilter, frequenciaByRowKey]);

  /** Todas as colunas base visíveis ficam fixas à esquerda no scroll horizontal. */
  const nStickyLeftCols = visibleBaseKeys.length;

  const stickyIndexForBaseKey = useCallback(
    (key) => visibleBaseKeys.indexOf(key),
    [visibleBaseKeys],
  );

  const widthStyleForKey = useCallback(
    (key) => {
      const w = baseColWidths[key];
      if (!w) return {};
      return { width: w, minWidth: w, maxWidth: w };
    },
    [baseColWidths],
  );

  const baseColLabel = useCallback(
    (key) => labelBaseColHeader(key, baseColWidths[key]),
    [baseColWidths],
  );

  const stickyIndexForDescRound = useCallback(() => -1, []);

  const colsForVehicle = useCallback(
    (vid) => {
      const vv = vehicleVis(vid);
      let n = 0;
      if (vv.freqCol !== false) n++;
      if (vv.custoCol !== false) n += 2;
      for (const lb of labels) {
        const o = String(lb.ordem);
        if (vv.frete[o] !== false) n++;
      }
      if (vv.totalCustoFaixa !== false) n++;
      for (const lb of labels) {
        const o = String(lb.ordem);
        if (vv.totalFreteFaixa[o] !== false) n++;
      }
      return Math.max(1, n);
    },
    [labels, vehicleVis],
  );

  const vehicleHeaderColSpan = useMemo(
    () => veiculos.reduce((sum, v) => sum + colsForVehicle(v.id), 0),
    [veiculos, colsForVehicle],
  );

  const showEditExtras = multiRoundEdit;

  const theadMeasureRowRef = useRef(null);
  const [stickyLefts, setStickyLefts] = useState(() => [0]);

  useLayoutEffect(() => {
    const tr = theadMeasureRowRef.current;
    if (!tr?.cells?.length || nStickyLeftCols <= 0) return;
    const measure = () => {
      const lefts = [];
      let acc = 0;
      for (let i = 0; i < nStickyLeftCols; i++) {
        const cell = tr.cells[i];
        if (!cell) break;
        lefts.push(acc);
        acc += cell.offsetWidth;
      }
      if (lefts.length === nStickyLeftCols) setStickyLefts(lefts);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(tr);
    return () => ro?.disconnect();
  }, [nStickyLeftCols, showEditExtras, veiculos.length, labels.length, vvis, visibleDescRounds.length, visibleBaseKeys, baseColWidths]);

  const stickyBaseShadow = 'shadow-[2px_0_6px_-2px_rgba(15,23,42,0.18)]';

  const baseHdrProps = (_key, scheme, si) => {
    const st = si >= 0 && si < nStickyLeftCols;
    const leftPx = st ? stickyLefts[si] : undefined;
    const zi = st ? 32 + (nStickyLeftCols - si) : undefined;
    const stickyCls = st ? `sticky ${stickyBaseShadow}` : '';
    const w = widthStyleForKey(_key);
    if (scheme === 'desc') {
      const col =
        'border border-amber-800 bg-amber-600 px-1.5 py-2 text-center text-[8px] font-black uppercase leading-tight tracking-wide text-white shadow-sm';
      return {
        className: st ? `${stickyCls} ${col}`.trim() : col,
        style: { ...(st && leftPx != null ? { left: leftPx, zIndex: zi } : {}), ...w },
      };
    }
    if (scheme === 'dark') {
      const faixaKey = _key === 'faixa';
      const w = baseColWidths[_key];
      const narrow = Number(w) > 0 && Number(w) <= 56;
      const col = faixaKey
        ? `border border-cyan-900 bg-cyan-900 ${narrow ? 'px-0.5' : 'px-2'} py-2 text-center text-[10px] font-black uppercase text-white`
        : `border border-slate-700 bg-slate-800 ${narrow ? 'px-0.5' : 'px-2'} py-2 text-center text-[10px] font-black uppercase text-white`;
      return {
        className: st ? `${stickyCls} ${col}`.trim() : col,
        style: { ...(st && leftPx != null ? { left: leftPx, zIndex: zi } : {}), ...w },
      };
    }
    if (scheme === 'amber') {
      const col = 'border border-amber-200 bg-amber-50 px-1 py-1 text-slate-900';
      return {
        className: st ? `${stickyCls} ${col}`.trim() : col,
        style: { ...(st && leftPx != null ? { left: leftPx, zIndex: zi } : {}), ...w },
      };
    }
    const col = 'border border-slate-200 bg-slate-100 px-2 py-1';
    return {
      className: st ? `${stickyCls} ${col}`.trim() : col,
      style: { ...(st && leftPx != null ? { left: leftPx, zIndex: zi } : {}), ...w },
    };
  };

  const renderBaseColTh = (key, scheme, children) => {
    const si = stickyIndexForBaseKey(key);
    const hdr = baseHdrProps(key, scheme, si);
    const isOver = dragOverKey === key && dragColKey && dragColKey !== key;
    const canDrag = scheme === 'dark';
    return (
      <th
        key={`${scheme}-${key}`}
        className={`${hdr.className || ''} relative group ${isOver ? 'ring-2 ring-inset ring-blue-400' : ''} ${dragColKey === key ? 'opacity-60' : ''}`.trim()}
        style={hdr.style}
        draggable={canDrag}
        onDragStart={
          canDrag
            ? (e) => {
                setDragColKey(key);
                e.dataTransfer.effectAllowed = 'move';
                try {
                  e.dataTransfer.setData('text/plain', key);
                } catch {
                  /* ignore */
                }
              }
            : undefined
        }
        onDragEnd={canDrag ? () => { setDragColKey(null); setDragOverKey(null); } : undefined}
        onDragOver={
          canDrag
            ? (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverKey(key);
              }
            : undefined
        }
        onDragLeave={canDrag ? () => setDragOverKey((k) => (k === key ? null : k)) : undefined}
        onDrop={
          canDrag
            ? (e) => {
                e.preventDefault();
                const from = dragColKey || e.dataTransfer.getData('text/plain');
                moveBaseCol(from, key);
                setDragColKey(null);
                setDragOverKey(null);
              }
            : undefined
        }
        title={canDrag ? 'Arraste para reordenar; arraste a borda direita para redimensionar' : 'Arraste a borda direita para redimensionar'}
      >
        {children}
        <div
          role="separator"
          aria-label={`Redimensionar ${FAIXA_KM_BASE_COL_LABELS[key]}`}
          className="absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize touch-none hover:bg-blue-500/50 active:bg-blue-600/70"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startResizeBaseCol(key, e.clientX);
          }}
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
        />
      </th>
    );
  };

  const baseTdProps = (key, rowIdx, si) => {
    const rowBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
    const st = si >= 0 && si < nStickyLeftCols;
    const leftPx = st ? stickyLefts[si] : undefined;
    const zi = st ? 22 + (nStickyLeftCols - si) : undefined;
    const stickyCls = st ? `sticky ${stickyBaseShadow}` : '';
    const w = widthStyleForKey(key);
    const overflowCls = 'overflow-hidden max-w-0';
    if (key === 'rota') {
      const col = `border border-slate-200 ${rowBg} px-2 py-1.5 font-semibold text-slate-800 ${overflowCls}`;
      return {
        className: st ? `${stickyCls} ${col}`.trim() : col,
        style: { ...(st && leftPx != null ? { left: leftPx, zIndex: zi } : {}), ...w },
      };
    }
    if (key === 'faixa') {
      const faixaBg = rowIdx % 2 === 0 ? 'bg-cyan-50' : 'bg-cyan-100';
      const col = `border border-cyan-200 ${faixaBg} px-2 py-1.5 text-slate-800 ${overflowCls}`;
      return {
        className: st ? `${stickyCls} ${col}`.trim() : col,
        style: { ...(st && leftPx != null ? { left: leftPx, zIndex: zi } : {}), ...w },
      };
    }
    if (key === 'frequencia') {
      const freqBg = rowIdx % 2 === 0 ? 'bg-violet-50' : 'bg-violet-100/80';
      const col = `border border-violet-200 ${freqBg} px-2 py-1.5 text-center font-medium tabular-nums ${overflowCls}`;
      return {
        className: st ? `${stickyCls} ${col}`.trim() : col,
        style: { ...(st && leftPx != null ? { left: leftPx, zIndex: zi } : {}), ...w },
      };
    }
    const col = `border border-slate-200 ${rowBg} px-2 py-1.5 text-center font-medium ${overflowCls}`;
    return {
      className: st ? `${stickyCls} ${col}`.trim() : col,
      style: { ...(st && leftPx != null ? { left: leftPx, zIndex: zi } : {}), ...w },
    };
  };

  const rotaCurtaLabel = (r) => {
    const o = String(r.origem || '').trim();
    const d = String(r.destino || '').trim();
    if (o && d) return `${o}-${d}`;
    return r.rotaLabel || '—';
  };

  const baseCellText = (text, title) => (
    <span className="block min-w-0 truncate" title={title ?? text}>
      {text ?? '—'}
    </span>
  );

  const renderBaseTdContent = (key, r) => {
    if (key === 'rota') return baseCellText(rotaCurtaLabel(r), r.rotaLabel);
    if (key === 'origem') return baseCellText(r.origem, r.origem);
    if (key === 'destino') return baseCellText(r.destino, r.destino);
    if (key === 'faixa') return baseCellText(r.faixaLabel, r.faixaLabel);
    if (key === 'frequencia') {
      if (showFrequenciaEdit) {
        return (
          <input
            type="text"
            inputMode="decimal"
            className="w-full min-w-0 rounded border border-violet-200 bg-white px-1.5 py-1 text-right font-mono text-[11px] outline-none focus:border-violet-500"
            placeholder="—"
            title="Frequência de carga (ex.: viagens/mês)"
            value={
              frequenciaByRowKey?.[rowFrequenciaStorageKey(r)] ??
              (r.frequencia != null ? String(r.frequencia) : '')
            }
            onChange={(e) => onFrequenciaChange(rowFrequenciaStorageKey(r), e.target.value, r)}
          />
        );
      }
      const v =
        frequenciaByRowKey?.[rowFrequenciaStorageKey(r)] ??
        (r.frequencia != null ? String(r.frequencia) : '');
      return v !== '' ? v : '—';
    }
    return null;
  };

  const descFaixaTdProps = (rowIdx, si) => {
    const st = si >= 0 && si < nStickyLeftCols;
    const leftPx = st ? stickyLefts[si] : undefined;
    const zi = st ? 22 + (nStickyLeftCols - si) : undefined;
    const rowBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
    return {
      className: st
        ? `sticky ${stickyBaseShadow} min-w-[8.75rem] max-w-[12rem] border border-amber-200/80 bg-amber-50 px-1.5 py-1.5 align-top ${rowBg}`.trim()
        : 'min-w-[8.75rem] max-w-[12rem] border border-amber-200/80 bg-amber-50/50 px-1.5 py-1.5 align-top',
      style: st && leftPx != null ? { left: leftPx, zIndex: zi } : undefined,
    };
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 text-[9px] text-slate-500">
        <span>
          Colunas base: arraste o cabeçalho para mudar a ordem; puxe a borda direita da coluna para ajustar a largura (como no Excel).
        </span>
        <button
          type="button"
          className="shrink-0 font-bold uppercase text-blue-700 hover:underline"
          onClick={resetBaseColLayout}
        >
          Restaurar ordem e largura
        </button>
      </div>
      <table className="min-w-max border-separate border-spacing-0 border-slate-200 text-[11px]">
      <thead className="sticky top-0 z-30 isolate shadow-[0_4px_14px_-6px_rgba(15,23,42,0.2)]">
        <tr ref={theadMeasureRowRef} className="bg-slate-800 text-white">
          {visibleBaseKeys.map((key) =>
            renderBaseColTh(
              key,
              'dark',
              <span
                className="flex min-w-0 items-center justify-center gap-0.5 overflow-hidden pr-2 cursor-grab active:cursor-grabbing"
                title={FAIXA_KM_BASE_COL_LABELS[key]}
              >
                <GripVertical className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                <span className="block min-w-0 truncate text-center uppercase">{baseColLabel(key)}</span>
              </span>,
            ),
          )}
          {multiRoundEdit &&
            visibleDescRounds.map((lb) => (
              <th
                key={`hdr-df-${lb.ordem}`}
                title='Desconto % nesta faixa (round 2+). Pode haver várias regras: a mais específica (menos veículos) ganha. Regra sem veículos marcados = todos. Substitui o D% da coluna quando vale.'
                {...baseHdrProps(null, 'desc', stickyIndexForDescRound(lb.ordem))}
              >
                Desc. faixa
                <br />
                <span className="opacity-95">R{lb.ordem}</span>
              </th>
            ))}
          {veiculos.map((v) => {
            const cls = headerStylePorTipoVeiculo(v.tipo_veiculo);
            return (
              <th
                key={v.id}
                colSpan={colsForVehicle(v.id)}
                className={`border border-slate-600 px-1 py-2 text-center text-[10px] font-black uppercase ${cls}`}
              >
                {v.tipo_veiculo}
              </th>
            );
          })}
        </tr>
        {!showEditExtras && (
          <tr className="bg-amber-50 text-slate-900">
            {visibleBaseKeys.map((key) =>
              renderBaseColTh(
                key,
                'amber',
                <input
                  type="search"
                  value={quickFilter[key]}
                  onChange={(e) => setQuickFilter((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full min-w-0 rounded border border-amber-300 bg-white px-1.5 py-1 text-[10px] text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                  placeholder={baseColLabel(key)}
                  title={FAIXA_KM_BASE_COL_LABELS[key]}
                  aria-label={`Filtrar ${FAIXA_KM_BASE_COL_LABELS[key]}`}
                  onDragStart={(e) => e.preventDefault()}
                />,
              ),
            )}
            <th
              colSpan={Math.max(1, vehicleHeaderColSpan)}
              className="border border-amber-200 bg-amber-50 px-2 py-1 align-middle text-[9px] font-medium uppercase tracking-wide text-amber-900/70"
            />
          </tr>
        )}
        {showEditExtras && (
          <tr className="bg-amber-50 text-slate-900">
            {visibleBaseKeys.map((key) =>
              renderBaseColTh(
                key,
                'amber',
                <input
                  type="search"
                  value={quickFilter[key]}
                  onChange={(e) => setQuickFilter((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full min-w-0 rounded border border-amber-300 bg-white px-1.5 py-1 text-[10px] text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                  placeholder={baseColLabel(key)}
                  title={FAIXA_KM_BASE_COL_LABELS[key]}
                  aria-label={`Filtrar ${FAIXA_KM_BASE_COL_LABELS[key]}`}
                  onDragStart={(e) => e.preventDefault()}
                />,
              ),
            )}
            {multiRoundEdit &&
              visibleDescRounds.map((lb) => (
                <th
                  key={`am-df-${lb.ordem}`}
                  {...baseHdrProps(null, 'amber', stickyIndexForDescRound(lb.ordem))}
                  aria-hidden
                />
              ))}
            {veiculos.map((v) => {
              const vv = vehicleVis(v.id);
              return (
                <th
                  key={v.id}
                  colSpan={colsForVehicle(v.id)}
                  className="min-w-[10rem] border border-amber-200 bg-amber-50 px-1 py-1 align-middle text-center shadow-sm"
                >
                  <div className="flex min-h-[2.25rem] flex-wrap items-center justify-center gap-x-1 gap-y-1 py-0.5">
                    {labels.some((lb) => Number(lb.ordem) === 1) && vv.frete['1'] !== false && (
                      <label className="inline-flex items-center gap-0.5 text-[8px] whitespace-nowrap">
                        R1 M%
                        <PctInput
                          value={markupVeiculoPctByVidByOrd[1]?.[String(v.id)] ?? 0}
                          onCommit={(n) => onMarkupVeiculoChangeByOrd(v.id, 1, n)}
                          className="w-[3.75rem] rounded border border-amber-300 px-0.5 py-0.5 text-right font-mono text-[10px]"
                        />
                      </label>
                    )}
                    {discountRoundLabels.map((lb) =>
                      vv.frete?.[String(lb.ordem)] === false ? null : (
                        <label key={`dc-${v.id}-${lb.ordem}`} className="inline-flex items-center gap-0.5 text-[8px] whitespace-nowrap">
                          R{lb.ordem} D%
                          <PctInput
                            value={descontoColunaPctByVidByOrd[lb.ordem]?.[String(v.id)] ?? 0}
                            onCommit={(n) => onDescontoColunaChangeByOrd(v.id, lb.ordem, n)}
                            className="w-[3.75rem] rounded border border-amber-300 px-0.5 py-0.5 text-right font-mono text-[10px]"
                          />
                        </label>
                      ),
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        )}
        <tr className="bg-slate-100 text-slate-800">
          {visibleBaseKeys.map((key) =>
            renderBaseColTh(key, 'slate', <span className="sr-only">{FAIXA_KM_BASE_COL_LABELS[key]}</span>),
          )}
          {multiRoundEdit &&
            visibleDescRounds.map((lb) => (
              <th key={`s-df-${lb.ordem}`} {...baseHdrProps(null, 'slate', stickyIndexForDescRound(lb.ordem))} />
            ))}
          {veiculos.map((v) => {
            const cls = headerStylePorTipoVeiculo(v.tipo_veiculo);
            const vv = vehicleVis(v.id);
            return (
              <React.Fragment key={v.id}>
                {vv.freqCol !== false && (
                  <th
                    title="Frequência de carga (viagens/mês) — por veículo nesta linha"
                    className={`border border-violet-200 px-1 py-1 text-[8px] font-bold ${cls} opacity-90`}
                  >
                    Freq
                  </th>
                )}
                {vv.custoCol !== false && (
                  <>
                    <th
                      title="CCD — custo por km (R$/km), coeficiente ANTT"
                      className={`border border-slate-200 px-1 py-1 text-[8px] font-bold ${cls} opacity-90`}
                    >
                      CCD
                    </th>
                    <th
                      title="KM total = km representativo × frequência"
                      className="border border-sky-300 bg-sky-100 px-1 py-1 text-[8px] font-bold text-sky-950"
                    >
                      KM total
                    </th>
                  </>
                )}
                {labels.map((lb) => {
                  const o = String(lb.ordem);
                  return (
                    <React.Fragment key={`${v.id}-h3-f-${o}`}>
                      {vv.frete[o] !== false && (
                        <th
                          title="Frete R$/km neste round (custo km + markup)"
                          className={`border border-slate-200 px-1 py-1 text-[8px] font-bold ${cls} opacity-90`}
                        >
                          {lb.nome}
                        </th>
                      )}
                    </React.Fragment>
                  );
                })}
                {vv.totalCustoFaixa !== false && (
                  <th
                    title="ANTT: (km rep. × CCD) + CC — valor por viagem na faixa"
                    className="border border-emerald-300 bg-emerald-100 px-1 py-1 text-[8px] font-bold text-emerald-950"
                  >
                    <div className="leading-tight">Total custo</div>
                    <div className="font-black text-[7px] text-emerald-800">faixa ANTT</div>
                  </th>
                )}
                {labels.map((lb) => {
                  const o = String(lb.ordem);
                  return (
                    <React.Fragment key={`${v.id}-h3-t-${o}`}>
                      {vv.totalFreteFaixa[o] !== false && (
                        <th
                          title={`Total frete faixa R${o}; M% = markup; L% = LAIR DRE (totais × km)`}
                          className="border border-emerald-300 bg-emerald-100 px-1 py-1 text-[8px] font-bold text-emerald-950"
                        >
                          <div className="leading-tight">Total frete</div>
                          <div className="font-black text-[7px] text-emerald-800">
                            faixa R{o}
                          </div>
                          <div className="font-black text-[7px] text-violet-800">L %</div>
                        </th>
                      )}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {displayRows.map((r, idx) => (
          <tr key={r.id != null ? String(r.id) : `${r.rotaLabel}-${r.faixaId}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
            {visibleBaseKeys.map((key) => (
              <td key={`td-${key}-${idx}`} {...baseTdProps(key, idx, stickyIndexForBaseKey(key))}>
                {renderBaseTdContent(key, r)}
              </td>
            ))}
            {multiRoundEdit &&
              visibleDescRounds.map((lb) => {
                const ek = `${lb.ordem}|${r.faixaId}`;
                const rules = descontoFaixaRulesByOrdFaixa?.[ek] || [];
                const rowsToShow = rules.length > 0 ? rules : [null];
                return (
                  <td
                    key={`cell-df-${r.faixaId}-${lb.ordem}-${idx}`}
                    {...descFaixaTdProps(idx, stickyIndexForDescRound(lb.ordem))}
                  >
                    <div className="flex flex-col gap-2">
                      {rowsToShow.map((dfEntry, ruleIndex) => {
                        const pctVal = dfEntry != null ? Number(dfEntry.percentual_desconto) || 0 : 0;
                        const entryForUi =
                          dfEntry || (pctVal !== 0 ? { percentual_desconto: pctVal, veiculo_ids: null } : null);
                        return (
                          <div
                            key={`${ek}-r${ruleIndex}`}
                            className="rounded-lg border border-slate-200/90 bg-white p-1.5 shadow-sm ring-1 ring-slate-100/80"
                          >
                            {rules.length > 1 && (
                              <div className="mb-0.5 flex items-center justify-between gap-1">
                                <span className="text-[7px] font-black uppercase text-slate-500">Regra {ruleIndex + 1}</span>
                                {onRemoveDescontoFaixaRegra && (
                                  <button
                                    type="button"
                                    className="text-[7px] font-bold uppercase text-red-600 hover:underline"
                                    onClick={() => onRemoveDescontoFaixaRegra(r.faixaId, lb.ordem, ruleIndex)}
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                            )}
                            <PctInput
                              value={pctVal}
                              onCommit={(n) => onDescontoFaixaRulePctChange(r.faixaId, lb.ordem, ruleIndex, n)}
                              className="w-full min-w-0 rounded-md border border-slate-200 bg-slate-50/50 px-1.5 py-1 text-right font-mono text-[10px] focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
                            />
                            {onToggleDescontoFaixaRuleVeiculo &&
                              descontoFaixaRulesByOrdFaixa &&
                              (dfEntry != null || pctVal !== 0) && (
                                <details className="mt-1.5 text-left">
                                  <summary className="cursor-pointer select-none text-[8px] font-black uppercase tracking-wide text-blue-700 hover:text-blue-900">
                                    Veículos
                                  </summary>
                                  <div className="mt-1 flex max-h-28 flex-col gap-0.5 overflow-y-auto rounded-md border border-slate-100 bg-white p-1">
                                    {veiculos.map((vv) => (
                                      <label
                                        key={vv.id}
                                        className="flex cursor-pointer items-center gap-1 text-[9px] font-medium normal-case text-slate-700"
                                      >
                                        <input
                                          type="checkbox"
                                          className="h-3 w-3 shrink-0 rounded border-slate-300"
                                          checked={descontoFaixaMarcadoParaVeiculo(entryForUi, vv.id)}
                                          onChange={() =>
                                            onToggleDescontoFaixaRuleVeiculo(r.faixaId, lb.ordem, ruleIndex, vv.id)
                                          }
                                        />
                                        <span className="truncate">{vv.tipo_veiculo}</span>
                                      </label>
                                    ))}
                                  </div>
                                </details>
                              )}
                          </div>
                        );
                      })}
                      {onAddDescontoFaixaRegra && (
                        <button
                          type="button"
                          className="w-full rounded-md border border-dashed border-blue-300 bg-blue-50/90 py-1 text-[7px] font-black uppercase leading-tight text-blue-900 transition-colors hover:border-blue-400 hover:bg-blue-100"
                          onClick={() => onAddDescontoFaixaRegra(r.faixaId, lb.ordem)}
                        >
                          + Outro % (mesma faixa)
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            {veiculos.map((v) => {
              const cell = r.byVeiculoId?.[String(v.id)] || {};
              const fr = cell.fretesPorRound || [];
              const vv = vehicleVis(v.id);
              const kmRep = Number(r.kmRepresentativo) || 0;
              const c0 = Number(cell.custo);
              const freqCell = frequenciaDaCelula(
                r,
                v.id,
                editFrequenciaByLine || {},
                frequenciaByRowKey || {},
              );
              const kmTotalVal = kmTotalDaCelula(
                r,
                v.id,
                editKmTotalByLine || {},
                kmTotalByCellKey || {},
                kmRep,
                freqCell,
              );
              const ccVal = ccDoVeiculo(veiculoById[String(v.id)], anttTabela);
              const totalCustoFaixaVal = calcTotalCustoFaixaAntt({
                kmRepresentativo: kmRep,
                ccd: c0,
                cc: ccVal,
                frequencia: freqCell,
                kmTotal: kmTotalVal,
              });
              const kmTotalKey = cellFrequenciaStorageKey(r, v.id);
              const kmTotalInputVal =
                r.id != null && onKmTotalChange
                  ? editKmTotalByLine?.[r.id]?.[String(v.id)] ??
                    (cell.km_total != null ? String(cell.km_total) : '')
                  : kmTotalByCellKey?.[kmTotalKey] ?? '';
              return (
                <React.Fragment key={v.id}>
                  {vv.freqCol !== false && (
                    <td className="border border-violet-200 bg-violet-50/40 px-1 py-1.5 text-center align-middle">
                      {showFrequenciaEdit && onFrequenciaChange && r.id != null ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full min-w-[3.25rem] rounded border border-violet-200 bg-white px-1 py-1 text-center font-mono text-[11px] outline-none focus:border-violet-500"
                          placeholder="1"
                          title="Frequência deste veículo nesta linha (padrão 1)"
                          value={
                            editFrequenciaByLine?.[r.id]?.[String(v.id)] ??
                            (cell.frequencia != null ? String(cell.frequencia) : '')
                          }
                          onChange={(e) => onFrequenciaChange(r.id, v.id, e.target.value)}
                        />
                      ) : (
                        <span className="font-mono text-[11px] tabular-nums">
                          {frequenciaDaCelula(
                            r,
                            v.id,
                            editFrequenciaByLine || {},
                            frequenciaByRowKey || {},
                          )}
                        </span>
                      )}
                    </td>
                  )}
                  {vv.custoCol !== false && (
                    <td className="border border-slate-200 px-1.5 py-1.5 text-right tabular-nums align-middle font-semibold text-slate-900">
                      {editable && onCustoChange ? (
                        <MoneyInput
                          value={cell.custo}
                          onCommit={(n) => onCustoChange(r.id, v.id, n)}
                          className="w-full min-w-[6.75rem] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right font-mono text-[11px] text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
                        />
                      ) : (
                        <span className="block px-1 py-0.5">{fmtTarifa(cell.custo)}</span>
                      )}
                    </td>
                  )}
                  {vv.custoCol !== false && (
                    <td className="border border-sky-300 bg-sky-50 px-1 py-1.5 text-center align-middle">
                      {showKmTotalEdit && (onKmTotalChange || onKmTotalChangeKey) ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full min-w-[3.5rem] rounded border border-sky-400 bg-white px-1 py-1 text-center font-mono text-[11px] font-semibold text-slate-900 outline-none focus:border-sky-600"
                          placeholder={
                            Number.isFinite(kmRep) && kmRep > 0
                              ? String(kmRep * freqCell)
                              : '—'
                          }
                          title="KM total (período). Vazio = km da faixa × frequência. Total custo ANTT usa KM total ÷ freq. como distância."
                          value={kmTotalInputVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (r.id != null && onKmTotalChange) {
                              onKmTotalChange(r.id, v.id, val);
                            } else if (onKmTotalChangeKey) {
                              onKmTotalChangeKey(kmTotalKey, val);
                            }
                          }}
                        />
                      ) : (
                        <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-900">
                          {Number.isFinite(kmTotalVal) && kmTotalVal > 0
                            ? kmTotalVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                            : '—'}
                        </span>
                      )}
                    </td>
                  )}
                  {labels.map((lb, ri) => {
                    const o = String(lb.ordem);
                    const frItem = fr[ri] || {};
                    const dBits = [];
                    if (
                      frItem.descontos_aplicados &&
                      ((frItem.desconto_faixa_pct != null && Number(frItem.desconto_faixa_pct) !== 0) ||
                        (frItem.desconto_coluna_pct != null && Number(frItem.desconto_coluna_pct) !== 0))
                    ) {
                      const dparts = [];
                      if (frItem.desconto_faixa_pct != null && Number(frItem.desconto_faixa_pct) !== 0) {
                        dparts.push(`faixa ${fmtPctBr(frItem.desconto_faixa_pct)}`);
                      }
                      if (frItem.desconto_coluna_pct != null && Number(frItem.desconto_coluna_pct) !== 0) {
                        dparts.push(`col. ${fmtPctBr(frItem.desconto_coluna_pct)}`);
                      }
                      if (dparts.length) dBits.push(`D ${dparts.join(' · ')}`);
                    }
                    return (
                      <React.Fragment key={`${v.id}-cell-f-${o}`}>
                        {vv.frete[o] !== false && (
                          <td className="border border-slate-200 px-1 py-1.5 text-right align-middle tabular-nums font-semibold text-slate-900">
                            <div className="flex flex-col items-end justify-center gap-0.5">
                              <span>{fmtTarifa(frItem.valor)}</span>
                              {dBits.length > 0 && (
                                <span className="max-w-[11rem] text-right text-[8px] font-bold leading-tight text-red-600">
                                  {dBits.join(' · ')}
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {vv.totalCustoFaixa !== false && (
                    <td className="border border-slate-200 px-1 py-1.5 text-right tabular-nums font-semibold text-slate-900">
                      {Number.isFinite(totalCustoFaixaVal) ? fmtTarifa(totalCustoFaixaVal) : '—'}
                    </td>
                  )}
                  {(() => {
                    const totaisFretePorOrdem = computeTotaisFreteFaixaPorRound(
                      totalCustoFaixaVal,
                      fr,
                      markupVeiculoPctByVidByOrd?.[1]?.[String(v.id)],
                    );
                    return labels.map((lb, ri) => {
                    const o = String(lb.ordem);
                    const frItem = fr[ri] || {};
                    const totalFreteFaixaVal =
                      totaisFretePorOrdem[Number(lb.ordem)] ?? totaisFretePorOrdem[o];
                    const badgeM = badgeMarkupTotalFreteFaixa(
                      frItem,
                      o,
                      markupVeiculoPctByVidByOrd?.[1]?.[String(v.id)],
                    );
                    return (
                      <React.Fragment key={`${v.id}-cell-t-${o}`}>
                        {vv.totalFreteFaixa[o] !== false && (
                          <td className="border border-slate-200 px-1 py-1.5 text-right align-middle tabular-nums font-semibold text-slate-900">
                            <div className="flex flex-col items-end justify-center gap-0.5">
                              <span>{Number.isFinite(totalFreteFaixaVal) ? fmtTarifa(totalFreteFaixaVal) : '—'}</span>
                              {badgeM && Number.isFinite(badgeM.pct) && (
                                <span
                                  className={`text-[8px] font-bold leading-tight ${
                                    badgeM.tipo === 'D' ? 'text-red-600' : 'text-emerald-700'
                                  }`}
                                >
                                  {badgeM.tipo} {fmtPctBr(badgeM.pct)}
                                </span>
                              )}
                              <LairPctBadge
                                pct={lairPctByCellKey?.[cellLairKey(r, v.id, 'total', o)]}
                                lairDesejadaPct={lairDesejadaPct}
                                title={`LAIR: total custo faixa × total frete faixa R${o}`}
                              />
                            </div>
                          </td>
                        )}
                      </React.Fragment>
                    );
                  });
                  })()}
                </React.Fragment>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
