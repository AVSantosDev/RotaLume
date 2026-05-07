import { useState, useEffect } from 'react';
import { Shield, Save, KeyRound } from 'lucide-react';
import { getApiBase, fetchJsonPost } from '../config/api';

/**
 * Configuração do sistema — integrações (ex.: QualP).
 * Backend: app Django configsistema — separado das configurações operacionais.
 */
const ConfigSistema = () => {
  const [tab] = useState('qualp');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [cfg, setCfg] = useState({
    api_base_url: 'https://api.qualp.com.br',
    access_token: '',
    validade_cache_dias: 30,
    token_configurado: false,
  });

  const base = getApiBase();

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const res = await fetch(`${base}/qualp-config/`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
        if (!cancel) {
          setCfg((c) => ({
            ...c,
            ...data,
          }));
        }
      } catch (e) {
        if (!cancel) setErr(e.message || String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [base]);

  const salvarQualp = async () => {
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      const body = {
        api_base_url: cfg.api_base_url,
        validade_cache_dias: Number(cfg.validade_cache_dias) || 30,
      };
      if (cfg.access_token?.trim()) {
        body.access_token = cfg.access_token.trim();
      }
      const res = await fetch(`${base}/qualp-config/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
      setCfg((c) => ({
        ...c,
        ...data,
        access_token: '',
      }));
      setMsg('Configurações QualP gravadas.');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const testarToken = async () => {
    setMsg('');
    setErr('');
    try {
      await fetchJsonPost('/qualp/consulta/', {
        origem: 'Curitiba',
        uf_origem: 'PR',
        destino: 'São Paulo',
        uf_destino: 'SP',
        axis: 5,
        freight_type: 'A',
        load_type: 'geral',
        is_empty_return: false,
        forcar_busca_api: true,
        salvar_historico: false,
        salvar_cache: false,
      });
      setMsg('Consulta de teste à QualP realizada (não gravou histórico nem cache).');
    } catch (e) {
      setErr(e.message || String(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-slate-800">
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="rounded-lg bg-slate-900 p-2 text-white">
          <Shield size={22} />
        </div>
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-slate-900">Configuração sistema</h1>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Integrações e parâmetros sensíveis (app backend <strong>configsistema</strong>), à parte das configurações operacionais. Referência API:{' '}
            <a className="text-blue-700 underline hover:text-blue-900" href="https://docs.qualp.com.br/api" target="_blank" rel="noreferrer">
              QualP
            </a>
            .
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider ${
            tab === 'qualp' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-400'
          }`}
        >
          QualP
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <>
          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{err}</div>
          )}
          {msg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">{msg}</div>
          )}

          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-600">
              <KeyRound size={16} className="text-blue-600" />
              Access-Token QualP
            </div>
            <p className="text-[11px] text-slate-500">
              O token viaja apenas para o backend (header <code className="rounded bg-slate-100 px-1">Access-Token</code>). Não é exibido após
              salvar.
            </p>
            <label className="block text-[10px] font-bold uppercase text-slate-400">Novo token (opcional)</label>
            <input
              type="password"
              autoComplete="off"
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder={cfg.token_configurado ? '•••••• (deixe em branco para manter)' : 'Cole o Access-Token'}
              value={cfg.access_token}
              onChange={(e) => setCfg({ ...cfg, access_token: e.target.value })}
            />
            <p className="text-[10px] text-slate-500">
              Status:{' '}
              <span className={cfg.token_configurado ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>
                {cfg.token_configurado ? 'Token configurado' : 'Token ausente'}
              </span>
            </p>

            <label className="mt-2 block text-[10px] font-bold uppercase text-slate-400">URL base da API</label>
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              value={cfg.api_base_url}
              onChange={(e) => setCfg({ ...cfg, api_base_url: e.target.value })}
            />

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <label className="block text-[10px] font-bold uppercase text-slate-500">
                Validade dos dados consultados QualP (dias)
              </label>
              <input
                type="number"
                min={1}
                max={366}
                className="mt-1 w-full max-w-[120px] rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                value={cfg.validade_cache_dias}
                onChange={(e) => setCfg({ ...cfg, validade_cache_dias: e.target.value })}
              />
              <p className="mt-1 text-[11px] text-slate-600 leading-snug">
                Para a mesma origem/destino e mesmos parâmetros de tabela, o sistema devolve km, pedágio de referência e frete mínimo do banco até
                esse prazo sem nova chamada à API.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={salvarQualp}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={14} /> {saving ? 'Salvando...' : 'Salvar QualP'}
              </button>
              <button
                type="button"
                disabled={saving || !cfg.token_configurado}
                onClick={testarToken}
                className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-800 hover:bg-slate-200 disabled:opacity-50"
              >
                Testar consulta
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ConfigSistema;
