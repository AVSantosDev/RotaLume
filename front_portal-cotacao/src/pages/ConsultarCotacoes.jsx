import { useEffect, useMemo, useState } from 'react';
import { fetchJsonList, fetchJsonPost } from '../config/api';
import { Eye, Copy, CheckCircle2, XCircle, Clock3, FileText, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fmtBRL = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('pt-BR') : '—';
};

export default function ConsultarCotacoes() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [statusSavingId, setStatusSavingId] = useState(null);
  const nav = useNavigate();
  const [filtroNumero, setFiltroNumero] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroCnpj, setFiltroCnpj] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroCriadoDe, setFiltroCriadoDe] = useState('');
  const [filtroCriadoAte, setFiltroCriadoAte] = useState('');
  const [filtroValDe, setFiltroValDe] = useState('');
  const [filtroValAte, setFiltroValAte] = useState('');
  const [filtrosExpanded, setFiltrosExpanded] = useState(() => {
    try {
      const v = localStorage.getItem('consultarCotacoes.filtrosExpanded');
      if (v === '0') return false;
      if (v === '1') return true;
    } catch {
      // ignore
    }
    return true;
  });

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await fetchJsonList('/cotacoes/');
      setLista(data);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const statusIcon = (st) => {
    const s = String(st || '').toUpperCase();
    if (s === 'APROVADA') return <CheckCircle2 size={16} className="text-emerald-600" />;
    if (s === 'NAO_APROVADA') return <XCircle size={16} className="text-red-600" />;
    return <Clock3 size={16} className="text-amber-600" />;
  };

  const setStatus = async (id, status, motivo) => {
    setStatusSavingId(id);
    setErro('');
    try {
      await fetchJsonPost(`/cotacoes/${id}/status/`, { status, motivo_nao_aprovacao: motivo || '' });
      await carregar();
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setStatusSavingId(null);
    }
  };

  const clonar = async (id) => {
    nav(`/cotacao?clone=${encodeURIComponent(id)}`);
  };

  const rows = useMemo(() => {
    const base = Array.isArray(lista) ? lista : [];
    const fNum = String(filtroNumero || '').trim();
    const fCli = String(filtroCliente || '').trim().toUpperCase();
    const fCnpj = String(filtroCnpj || '').replace(/\D/g, '');
    const fSt = String(filtroStatus || '').trim().toUpperCase();
    const dCriadoDe = filtroCriadoDe ? new Date(`${filtroCriadoDe}T00:00:00`) : null;
    const dCriadoAte = filtroCriadoAte ? new Date(`${filtroCriadoAte}T23:59:59`) : null;
    const dValDe = filtroValDe ? new Date(`${filtroValDe}T00:00:00`) : null;
    const dValAte = filtroValAte ? new Date(`${filtroValAte}T23:59:59`) : null;

    return base.filter((c) => {
      if (fNum) {
        const idStr = String(c?.id ?? '');
        if (!idStr.includes(fNum)) return false;
      }
      if (fCli) {
        const nome = String(c?.cliente_nome || '').toUpperCase();
        if (!nome.includes(fCli)) return false;
      }
      if (fCnpj) {
        const cnpj = String(c?.cliente_cnpj || '').replace(/\D/g, '');
        if (!cnpj.includes(fCnpj)) return false;
      }
      if (fSt) {
        const st = String(c?.status || '').toUpperCase();
        if (st !== fSt) return false;
      }
      if (dCriadoDe || dCriadoAte) {
        const d = c?.created_at ? new Date(c.created_at) : null;
        if (!d || !Number.isFinite(d.getTime())) return false;
        if (dCriadoDe && d < dCriadoDe) return false;
        if (dCriadoAte && d > dCriadoAte) return false;
      }
      if (dValDe || dValAte) {
        const d = c?.valid_until ? new Date(c.valid_until) : null;
        if (!d || !Number.isFinite(d.getTime())) return false;
        if (dValDe && d < dValDe) return false;
        if (dValAte && d > dValAte) return false;
      }
      return true;
    });
  }, [lista, filtroNumero, filtroCliente, filtroCnpj, filtroStatus, filtroCriadoDe, filtroCriadoAte, filtroValDe, filtroValAte]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-slate-800">Consultar Cotações</h1>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase text-slate-700 hover:bg-slate-50"
          onClick={carregar}
          disabled={loading}
        >
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-slate-50"
          onClick={() => {
            setFiltrosExpanded((p) => {
              const n = !p;
              try {
                localStorage.setItem('consultarCotacoes.filtrosExpanded', n ? '1' : '0');
              } catch {
                // ignore
              }
              return n;
            });
          }}
          aria-expanded={filtrosExpanded}
        >
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-700">Filtros</div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
            <span>{filtrosExpanded ? 'Ocultar' : 'Mostrar'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${filtrosExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {filtrosExpanded && (
          <div className="border-t border-slate-200 p-3">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] font-black uppercase text-slate-500">Número da cotação</label>
            <input
              value={filtroNumero}
              onChange={(e) => setFiltroNumero(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 outline-none focus:border-blue-500"
              placeholder="Ex.: 12"
            />
          </div>
          <div className="col-span-12 sm:col-span-4">
            <label className="block text-[10px] font-black uppercase text-slate-500">Cliente</label>
            <input
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 outline-none focus:border-blue-500"
              placeholder="Nome do cliente"
            />
          </div>
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] font-black uppercase text-slate-500">CNPJ</label>
            <input
              value={filtroCnpj}
              onChange={(e) => setFiltroCnpj(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 outline-none focus:border-blue-500"
              placeholder="Somente números"
            />
          </div>
          <div className="col-span-12 sm:col-span-2">
            <label className="block text-[10px] font-black uppercase text-slate-500">Status</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-black text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="">Todos</option>
              <option value="AGUARDANDO_APROVACAO">Aguardando</option>
              <option value="APROVADA">Aprovada</option>
              <option value="NAO_APROVADA">Não aprovada</option>
            </select>
          </div>

          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] font-black uppercase text-slate-500">Criado em (de)</label>
            <input
              type="date"
              value={filtroCriadoDe}
              onChange={(e) => setFiltroCriadoDe(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] font-black uppercase text-slate-500">Criado em (até)</label>
            <input
              type="date"
              value={filtroCriadoAte}
              onChange={(e) => setFiltroCriadoAte(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] font-black uppercase text-slate-500">Validade (de)</label>
            <input
              type="date"
              value={filtroValDe}
              onChange={(e) => setFiltroValDe(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] font-black uppercase text-slate-500">Validade (até)</label>
            <input
              type="date"
              value={filtroValAte}
              onChange={(e) => setFiltroValAte(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold text-slate-600">
            Mostrando <span className="font-black text-slate-900">{rows.length}</span> cotações
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setFiltroNumero('');
              setFiltroCliente('');
              setFiltroCnpj('');
              setFiltroStatus('');
              setFiltroCriadoDe('');
              setFiltroCriadoAte('');
              setFiltroValDe('');
              setFiltroValAte('');
            }}
          >
            Limpar filtros
          </button>
        </div>
          </div>
        )}
      </div>

      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[12px] font-semibold text-red-800">
          {erro}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="w-full min-w-[1150px] border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
              <tr className="text-slate-700">
                <th className="px-3 py-3 font-black uppercase border-r border-slate-200">Número da cotação</th>
                <th className="px-3 py-3 font-black uppercase border-r border-slate-200">Criado em</th>
                <th className="px-3 py-3 font-black uppercase border-r border-slate-200">Validade</th>
                <th className="px-3 py-3 font-black uppercase border-r border-slate-200">Cliente</th>
                <th className="px-3 py-3 font-black uppercase border-r border-slate-200">CNPJ</th>
                <th className="px-3 py-3 font-black uppercase border-r border-slate-200 text-right">CTRB</th>
                <th className="px-3 py-3 font-black uppercase border-r border-slate-200 text-right">All In S/ICMS</th>
                <th className="px-3 py-3 font-black uppercase border-r border-slate-200 text-right">All In C/ICMS</th>
                <th className="px-3 py-3 font-black uppercase border-r border-slate-200 text-right">All In (desc.)</th>
                <th className="px-3 py-3 font-black uppercase border-r border-slate-200 text-right">LAIR %</th>
                <th className="px-3 py-3 font-black uppercase border-r border-slate-200">Status</th>
                <th className="px-3 py-3 font-black uppercase border-r border-slate-200">PDF</th>
                <th className="px-3 py-3 font-black uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-blue-50/40">
                  <td className="px-3 py-2 border-r border-slate-50 font-mono tabular-nums">{c.id}</td>
                  <td className="px-3 py-2 border-r border-slate-50 font-mono tabular-nums text-slate-700">{fmtDate(c.created_at)}</td>
                  <td className="px-3 py-2 border-r border-slate-50 font-mono tabular-nums text-slate-700">{fmtDate(c.valid_until)}</td>
                  <td className="px-3 py-2 border-r border-slate-50 font-black text-slate-900 uppercase">{c.cliente_nome || '—'}</td>
                  <td className="px-3 py-2 border-r border-slate-50 font-mono tabular-nums text-slate-700">{c.cliente_cnpj || '—'}</td>
                  <td className="px-3 py-2 border-r border-slate-50 text-right font-mono tabular-nums">{fmtBRL(c.ctrb_orcado)}</td>
                  <td className="px-3 py-2 border-r border-slate-50 text-right font-mono tabular-nums">{fmtBRL(c.frete_all_in_sicms)}</td>
                  <td className="px-3 py-2 border-r border-slate-50 text-right font-mono tabular-nums">{fmtBRL(c.frete_all_in_cicms)}</td>
                  <td className="px-3 py-2 border-r border-slate-50 text-right font-mono tabular-nums">{fmtBRL(c.frete_all_in_desc)}</td>
                  <td className="px-3 py-2 border-r border-slate-50 text-right font-mono tabular-nums">{Number(c.lair_pct || 0).toFixed(2).replace('.', ',')}%</td>
                  <td className="px-3 py-2 border-r border-slate-50">
                    <div className="flex items-center gap-2">
                      {statusIcon(c.status)}
                      <select
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-black"
                        value={c.status || 'AGUARDANDO_APROVACAO'}
                        onChange={(e) => setStatus(c.id, e.target.value, c.motivo_nao_aprovacao)}
                        disabled={statusSavingId === c.id}
                      >
                        <option value="AGUARDANDO_APROVACAO">AGUARDANDO</option>
                        <option value="APROVADA">APROVADA</option>
                        <option value="NAO_APROVADA">NÃO APROVADA</option>
                      </select>
                    </div>
                    {String(c.status || '').toUpperCase() === 'NAO_APROVADA' && (
                      <textarea
                        className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-[11px]"
                        placeholder="Motivo da não aprovação…"
                        defaultValue={c.motivo_nao_aprovacao || ''}
                        onBlur={(e) => setStatus(c.id, c.status, e.target.value)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 border-r border-slate-50">
                    <div className="flex items-center gap-2 text-slate-700">
                      <FileText size={16} />
                      <span className="truncate max-w-[180px]">{c.pdf_path || '—'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="mr-2 inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-50"
                      onClick={() => nav(`/cotacao?view=${encodeURIComponent(c.id)}`)}
                    >
                      <Eye size={14} /> Visualizar
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-50"
                      onClick={() => clonar(c.id)}
                    >
                      <Copy size={14} /> Clonar
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-slate-500">
                    Nenhuma cotação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

