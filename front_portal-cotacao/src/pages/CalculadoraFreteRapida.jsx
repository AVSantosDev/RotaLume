import { useCallback, useEffect, useState } from 'react';
import { Calculator, RefreshCw } from 'lucide-react';
import { fetchJsonPost, getApiBase } from '../config/api';

const fmtBRL = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
    : '—';

const parseNum = (v) => {
  if (v === '' || v == null) return 0;
  const s = String(v).trim().replace(/\s/g, '').replace(/R\$\s?/gi, '');
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

const CalculadoraFreteRapida = () => {
  const [custo, setCusto] = useState('1000');
  const [markup, setMarkup] = useState('15');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);

  const recalc = useCallback(async () => {
    setErr('');
    const custoN = parseNum(custo);
    if (custoN <= 0) {
      setErr('Informe o custo CTRB maior que zero.');
      setRes(null);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchJsonPost('/calculadora-frete/rapida/', {
        custo_ctrb: custoN,
        markup_pct: parseNum(markup),
      });
      setRes(data);
    } catch (e) {
      setErr(e.message || String(e));
      setRes(null);
    } finally {
      setLoading(false);
    }
  }, [custo, markup]);

  useEffect(() => {
    const t = setTimeout(() => {
      recalc();
    }, 350);
    return () => clearTimeout(t);
  }, [recalc]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Calculator className="text-blue-600" size={28} />
            Calculadora de frete rápida
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Informe o <strong>custo CTRB</strong> e o <strong>percentual de markup</strong>. O frete é{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">custo × (1 + markup ÷ 100)</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => recalc()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Recalcular
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">Entradas</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400">Custo CTRB (R$)</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-lg outline-none focus:border-blue-500"
              value={custo}
              onChange={(e) => setCusto(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400">Markup (% sobre o custo)</label>
            <input
              type="number"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
            />
          </div>
        </div>
        {err && <p className="text-sm text-red-600 font-medium">{err}</p>}
        
      </div>

      {res?.ok && (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">Resultados</h2>
          <div className="rounded-xl bg-amber-50/80 border border-amber-100 p-4">
            <div className="text-[10px] font-black uppercase text-amber-900/70">Frete (valor)</div>
            <div className="text-2xl font-black text-amber-950 tabular-nums">{fmtBRL(res.frete_valor)}</div>
          </div>
          <div className="rounded-xl bg-slate-100 border border-slate-200 p-4 text-sm text-slate-700 space-y-1">
            <p>
              Acréscimo (markup sobre custo):{' '}
              <span className="font-mono font-bold">{fmtBRL(res.valor_acrescimo_markup)}</span>
            </p>
            <p>
              Markup efetivo (frete ÷ custo − 1):{' '}
              <span className="font-mono font-bold">
                {Number(res.markup_efetivo_sobre_custo_pct).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                %
              </span>{' '}
              <span className="text-slate-500">(igual ao informado)</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalculadoraFreteRapida;
