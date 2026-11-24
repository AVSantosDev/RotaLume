import React, { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

const formatBRL = (val) =>
  Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function DreBaseLucroTable({ dre, compact = false }) {
  const tblCls = compact ? 'text-[9px]' : 'text-[12px]';
  const cellPad = compact ? 'px-1 py-0.5' : 'px-3 py-2';
  const labelPad = compact ? 'px-1 py-0.5 max-w-[7.5rem]' : 'px-3 py-2';
  const pctFrom = (num, den) => {
    const a = Number(num);
    const b = Number(den);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return '—';
    return `${((a / b) * 100).toFixed(2).replace('.', ',')}%`;
  };
  const pctFromRol = (num, denRol) => {
    const a = Number(num);
    const b = Number(denRol);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return '—';
    return `${((a / b) * 100).toFixed(2).replace('.', ',')}%`;
  };
  const fmtAbs = (v) => (Number.isFinite(Number(v)) ? formatBRL(Math.abs(Number(v))) : '0,00');
  const fmtSigned = (v) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return '—';
    const sinal = x < 0 ? '-' : '';
    return `${sinal}R$ ${formatBRL(Math.abs(x))}`;
  };

  const rows = [
    { key: 'rob', label: 'ROB', value: dre ? dre.rob : 0, pct: '100,00%', negative: false },
    {
      key: 'icmsiss',
      label: '(-) ICMS/ISS',
      value: dre ? dre.icmsIss : 0,
      pct: dre ? pctFrom(dre.icmsIss, dre.rob) : '—',
      negative: true,
    },
    {
      key: 'impfed',
      label: '(-) IMP.FED',
      value: dre ? dre.impFed : 0,
      pct: dre ? pctFrom(dre.impFed, dre.rob) : '—',
      negative: true,
    },
    {
      key: 'cred',
      label: '(+) CREDITO',
      value: dre ? dre.credito : 0,
      pct: dre ? (dre.creditoPct != null ? `${Number(dre.creditoPct).toFixed(2).replace('.', ',')}%` : '—') : '—',
      negative: false,
    },
    { key: 'rol', label: 'ROL', value: dre ? dre.rol : 0, pct: dre ? pctFrom(dre.rol, dre.rob) : '—', negative: false },
    { key: 'csp', label: 'CSP', value: dre ? dre.csp : 0, pct: dre ? pctFromRol(dre.csp, dre.rol) : '—', negative: true },
    { key: 'cv', label: 'C.V', value: dre ? dre.cv : 0, pct: dre ? pctFromRol(dre.cv, dre.rol) : '—', negative: true },
    { key: 'cf', label: 'C.F', value: dre ? dre.cf : 0, pct: dre ? pctFromRol(dre.cf, dre.rol) : '—', negative: true },
    { key: 'lo', label: 'L.O', value: dre ? dre.lo : 0, pct: dre ? pctFromRol(dre.lo, dre.rol) : '—', negative: false },
    {
      key: 'despfin',
      label: 'DESP./FIN.',
      value: dre ? dre.despFin : 0,
      pct: dre ? (dre.despFinPct != null ? `${Number(dre.despFinPct).toFixed(2).replace('.', ',')}%` : '—') : '—',
      negative: true,
    },
    {
      key: 'despcom',
      label: 'DESP./COMERCIAL',
      value: dre ? dre.despComercial : 0,
      pct:
        dre && dre.despComercialPct != null && dre.despComercialPct !== 0
          ? `${Number(dre.despComercialPct).toFixed(2).replace('.', ',')}%`
          : '—',
      negative: true,
    },
    {
      key: 'lair',
      label: 'LAIR',
      value: dre ? dre.lairValor : 0,
      pct:
        dre && dre.lairPct != null
          ? `${Number(dre.lairPct).toFixed(2).replace('.', ',')}%`
          : dre
            ? pctFromRol(dre.lairValor, dre.rol)
            : '—',
      negative: false,
      isTotal: true,
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 overflow-x-auto">
      <table
        className={`w-full border-collapse border border-slate-400 bg-white ${tblCls} ${
          compact ? 'table-fixed' : 'min-w-[520px]'
        }`}
      >
        <thead>
          <tr className="bg-slate-300 text-slate-900">
            <th className={`border border-slate-400 ${labelPad} text-left font-black uppercase`}>
              DRE
            </th>
            <th className={`border border-slate-400 ${cellPad} text-right font-black uppercase tabular-nums`}>
              Valor
            </th>
            <th className={`border border-slate-400 ${cellPad} w-[3.25rem] text-right font-black uppercase tabular-nums`}>
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const valueIsNeg = Number(r.value) < 0 || r.negative;
            const valorBg = valueIsNeg ? 'bg-red-100' : 'bg-green-100';
            const valorText = valueIsNeg ? 'text-red-700' : 'text-green-800';
            const pctBg = valueIsNeg ? 'bg-red-100' : 'bg-green-100';
            const pctText = valueIsNeg ? 'text-red-700' : 'text-green-800';
            const leftBg = r.isTotal ? 'bg-slate-300' : 'bg-slate-200';
            const rowFont = r.isTotal ? 'font-black' : 'font-semibold';
            return (
              <tr key={r.key}>
                <td className={`border border-slate-400 ${labelPad} ${leftBg} ${rowFont} text-slate-900`}>
                  {r.label}
                </td>
                <td
                  className={`border border-slate-400 ${cellPad} text-right font-black tabular-nums ${valorBg} ${valorText}`}
                >
                  {dre ? fmtSigned(r.value) : `R$ ${fmtAbs(0)}`}
                </td>
                <td className={`border border-slate-400 ${cellPad} text-right font-black tabular-nums ${pctBg} ${pctText}`}>
                  {r.pct}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!dre && (
        <p className="mt-2 text-center text-[10px] italic text-slate-500">
          Sem células com custo e frete preenchidos. Configure tabela, LAIR e preencha a grade.
        </p>
      )}
    </div>
  );
}

function roundLabelFromOrdem(roundOrdem, rounds) {
  if (roundOrdem === 'last') return 'Último round';
  return (
    rounds.find((r) => String(r.ordem) === String(roundOrdem))?.nome || `Round ${roundOrdem}`
  );
}

function DreMetaSummary({ meta, dre, roundLabel }) {
  if (!(meta?.celulas > 0)) return null;
  return (
    <p className="border-b border-slate-50 px-3 py-2 text-[10px] text-slate-500">
      <span className="font-bold text-slate-700">{roundLabel}</span>
      <span className="mx-1">·</span>
      {meta.celulas} célula(s) · {meta.linhas} linha(s) · {meta.veiculos} veículo(s)
      {dre?.lairPct != null && (
        <span className="ml-2 font-bold text-emerald-800">
          LAIR {Number(dre.lairPct).toFixed(2).replace('.', ',')}% sobre ROL (média ponderada × grade)
        </span>
      )}
    </p>
  );
}

const ROUND_COL_BORDER = [
  'border-blue-200 bg-blue-50/40',
  'border-violet-200 bg-violet-50/30',
  'border-emerald-200 bg-emerald-50/35',
  'border-amber-200 bg-amber-50/40',
  'border-rose-200 bg-rose-50/35',
  'border-cyan-200 bg-cyan-50/35',
];

export default function DreBaseLucroPanel({
  dre,
  meta,
  /** Um DRE por round: `{ ordem, nome, dre, meta }[]` */
  roundsDre = null,
  filtros,
  onFiltrosChange,
  faixas = [],
  veiculos = [],
  rounds = [],
  onClose,
  fullscreen = false,
}) {
  const [expanded, setExpanded] = useState(true);
  const tableVisible = fullscreen || expanded;
  const cols =
    Array.isArray(roundsDre) && roundsDre.length > 0
      ? roundsDre
      : dre
        ? [{ ordem: filtros.roundOrdem, nome: roundLabelFromOrdem(filtros.roundOrdem, rounds), dre, meta }]
        : [];
  const compararTodos = cols.length >= 2 && Boolean(filtros.compararRounds !== false);
  const modoUnico = cols.length === 1 || !compararTodos;
  const roundLabel = roundLabelFromOrdem(filtros.roundOrdem, rounds);

  const shellCls = fullscreen
    ? 'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-[12px] shadow-sm'
    : 'flex max-h-[min(62dvh,680px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-[12px] shadow-sm';

  return (
    <div className={shellCls}>
      {!fullscreen && (
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <span className="text-[11px] font-black uppercase tracking-wide text-slate-800">DRE — Base lucro</span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Fechar DRE"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-3 py-3">
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-[10px] font-bold uppercase text-slate-600">
          Faixa de KM
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium normal-case text-slate-900"
            value={filtros.faixaId}
            onChange={(e) => onFiltrosChange((f) => ({ ...f, faixaId: e.target.value }))}
          >
            <option value="__all__">Todas as faixas</option>
            {faixas.map((fx) => (
              <option key={fx.id} value={fx.id}>
                {fx.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-[10px] font-bold uppercase text-slate-600">
          Veículo
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium normal-case text-slate-900"
            value={filtros.veiculoId}
            onChange={(e) => onFiltrosChange((f) => ({ ...f, veiculoId: e.target.value }))}
          >
            <option value="__all__">Todos os veículos</option>
            {veiculos.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.tipo || v.tipo_veiculo || `Veículo ${v.id}`}
              </option>
            ))}
          </select>
        </label>
        {modoUnico && rounds.length > 1 && (
          <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-[10px] font-bold uppercase text-slate-600">
            Frete (round)
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium normal-case text-slate-900"
              value={String(filtros.roundOrdem)}
              onChange={(e) => {
                const v = e.target.value;
                onFiltrosChange((f) => ({
                  ...f,
                  roundOrdem: v === 'last' ? 'last' : Number(v) || v,
                }));
              }}
            >
              <option value="last">Último round (padrão)</option>
              {rounds.map((r) => (
                <option key={r.ordem} value={String(r.ordem)}>
                  {r.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        {rounds.length >= 2 && (
          <label className="flex items-center gap-2 pb-1 text-[10px] font-bold uppercase text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-violet-600"
              checked={compararTodos}
              onChange={(e) =>
                onFiltrosChange((f) => ({
                  ...f,
                  compararRounds: e.target.checked,
                }))
              }
            />
            Comparar todos os rounds ({rounds.length})
          </label>
        )}
      </div>

      {modoUnico && meta?.celulas > 0 && (
        <p className="shrink-0 border-b border-slate-50 px-3 py-2 text-[10px] text-slate-500">
          {meta.celulas} célula(s) · {meta.linhas} linha(s) · {meta.veiculos} veículo(s) · Frete: {roundLabel}
          {dre?.lairPct != null && (
            <span className="ml-2 font-bold text-emerald-800">
              LAIR {Number(dre.lairPct).toFixed(2).replace('.', ',')}% sobre ROL
              {meta.celulas === 1 ? ' (igual à grade)' : ''}
            </span>
          )}
          {meta.lairPctConsolidado != null && meta.celulas > 1 && (
            <span className="ml-2 text-slate-600">
              · consolidado todas as células:{' '}
              {Number(meta.lairPctConsolidado).toFixed(2).replace('.', ',')}%
            </span>
          )}
          {dre && Math.abs(Number(dre.icmsIss)) < 0.01 && (
            <span className="mt-1 block text-amber-800">
              ICMS/ISS zerado: confira alíquotas em Configurações → ICMS (origem/destino da rota).
            </span>
          )}
        </p>
      )}

      {!fullscreen && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
          className="flex w-full shrink-0 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-50"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExpanded((p) => !p);
            }
          }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            {expanded ? 'Encolher tabela' : 'Expandir tabela'}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </div>
      )}

      {tableVisible && compararTodos && (
        <div
          className={`min-h-0 flex-1 overflow-y-auto overflow-x-auto border-slate-100 px-3 pb-4 pt-2 [scrollbar-gutter:stable] ${
            fullscreen ? 'border-t-0 pt-4' : 'border-t'
          }`}
        >
          <p className="mb-2 text-[10px] font-semibold text-slate-500">
            {cols.length} round(s) — colunas ajustadas para caber na tela.
          </p>
          <div
            className="grid w-full min-w-0 gap-2 pb-2"
            style={{
              gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`,
            }}
          >
            {cols.map((col, i) => (
              <div
                key={String(col.ordem)}
                className={`min-w-0 overflow-hidden rounded-lg border ${
                  ROUND_COL_BORDER[i % ROUND_COL_BORDER.length]
                }`}
              >
                <DreMetaSummary
                  meta={col.meta}
                  dre={col.dre}
                  roundLabel={col.nome || roundLabelFromOrdem(col.ordem, rounds)}
                />
                <div className="px-1 pb-2">
                  <DreBaseLucroTable dre={col.dre} compact />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tableVisible && modoUnico && (
        <div
          className={`min-h-0 flex-1 overflow-y-auto overflow-x-auto border-slate-100 px-3 pb-4 pt-2 [scrollbar-gutter:stable] ${
            fullscreen ? 'border-t-0 pt-4' : 'border-t'
          }`}
        >
          <DreBaseLucroTable dre={dre} />
        </div>
      )}
    </div>
  );
}
