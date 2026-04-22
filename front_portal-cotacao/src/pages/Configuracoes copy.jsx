import { useState, useEffect, useMemo } from 'react';
import { Map, Truck, DollarSign, Plus, Search, ArrowUpDown, Trash2, Settings2, Percent, ShieldCheck, LayoutList, ChevronRight } from 'lucide-react';

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState('icms'); 
  const [activeSubTab, setActiveSubTab] = useState('veiculos'); 
  const [subAbaAtiva, setSubAbaAtiva] = useState('impostos'); // Controle das sub-abas de taxas
  const [clienteMarkupAtivo, setClienteMarkupAtivo] = useState('DIVERSOS');

  // Estados de Dados
  const [listaIcms, setListaIcms] = useState([]);
  const [listaVeiculos, setListaVeiculos] = useState([]);
  const [listaSemireboques, setListaSemireboques] = useState([]);
  const [listaTaxas, setListaTaxas] = useState([]);

  // Estados de UI
  const [busca, setBusca] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editandoItem, setEditandoItem] = useState(null);
  const clientesMarkup = ['DIVERSOS', 'RENAULT', 'MAHLE', 'ROD CNH', 'NIDEC', 'BOTICARIO', 'ROD IVECO'];

  // FormData unificado
  const [formData, setFormData] = useState({ 
    origem: '', destino: '', aliquota: '', 
    tipo: '', eixos: '', descricao: '', valor:'', unidade:'%' 
  });

  const API_BASE = 'http://localhost:8000';

  // --- CARREGAMENTO DE DADOS ---
  const carregarTudo = () => {
    fetch(`${API_BASE}/icms/`).then(res => res.json()).then(data => setListaIcms(data)).catch(err => console.error(err));
    fetch(`${API_BASE}/veiculos/`).then(res => res.json()).then(data => setListaVeiculos(data)).catch(err => console.error(err));
    fetch(`${API_BASE}/semireboques/`).then(res => res.json()).then(data => setListaSemireboques(data)).catch(err => console.error(err));
    fetch(`${API_BASE}/taxas/`).then(res => res.json()).then(data => setListaTaxas(data)).catch(err => console.error(err));
  };

  useEffect(() => { carregarTudo(); }, []);

  // --- LÓGICA DE FILTRO ---
  const dadosFiltrados = useMemo(() => {
    const termo = busca.trim().toUpperCase();
    let base = [];

    if (activeTab === 'icms') {
      base = listaIcms.filter(i => i.origem.includes(termo) || i.destino.includes(termo));
    } else if (activeTab === 'veiculos') {
      if (activeSubTab === 'veiculos') {
        base = listaVeiculos.filter(v => v.tipo_veiculo.toUpperCase().includes(termo));
      } else {
        base = listaSemireboques.filter(s => s.tipo_semireboque.toUpperCase().includes(termo));
      }
    } else if (activeTab === 'taxas') {
      // Filtra pela categoria da sub-aba e, se for markup, pelo cliente ativo
      base = listaTaxas.filter(t => 
        t.categoria.toLowerCase() === subAbaAtiva && 
        (subAbaAtiva !== 'markup' || t.sub_categoria === clienteMarkupAtivo) &&
        t.descricao.toUpperCase().includes(termo)
      );
    }

    return base.sort((a, b) => {
        const valA = (a.origem || a.tipo_veiculo || a.tipo_semireboque || a.descricao || "").toString();
        const valB = (b.origem || b.tipo_veiculo || b.tipo_semireboque || b.descricao || "").toString();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [activeTab, activeSubTab, subAbaAtiva, clienteMarkupAtivo, listaIcms, listaVeiculos, listaSemireboques, listaTaxas, busca, sortOrder]);

  // --- FUNÇÕES DE AÇÃO ---
  const handleSalvar = async () => {
    let url = '';
    let body = {};
    const metodo = editandoItem ? 'PUT' : 'POST';

    if (activeTab === 'icms') {
      url = `${API_BASE}/icms/` + (editandoItem ? `${editandoItem.id}/` : '');
      body = { origem: formData.origem.toUpperCase(), destino: formData.destino.toUpperCase(), aliquota: formData.aliquota };
    } else if (activeTab === 'veiculos') {
      const rota = activeSubTab === 'veiculos' ? 'veiculos' : 'semireboques';
      url = `${API_BASE}/${rota}/` + (editandoItem ? `${editandoItem.id}/` : '');
      body = activeSubTab === 'veiculos' 
        ? { tipo_veiculo: formData.tipo, eixos_veiculo: formData.eixos }
        : { tipo_semireboque: formData.tipo, eixos_semireboque: formData.eixos };
    } else if (activeTab === 'taxas') {
      url = `${API_BASE}/taxas/` + (editandoItem ? `${editandoItem.id}/` : '');
      body = { 
        categoria: subAbaAtiva.toUpperCase(), 
        sub_categoria: subAbaAtiva === 'markup' ? clienteMarkupAtivo : 'GERAL',
        descricao: formData.descricao, 
        valor: formData.valor,
        unidade: formData.unidade 
      };
    }

    try {
      const res = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) { carregarTudo(); fecharModal(); }
    } catch (err) { console.error("Erro ao salvar:", err); }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm("Confirmar exclusão definitiva?")) return;
    let rota = activeTab === 'icms' ? 'icms' : (activeTab === 'veiculos' ? (activeSubTab === 'veiculos' ? 'veiculos' : 'semireboques') : 'taxas');
    await fetch(`${API_BASE}/${rota}/${id}/`, { method: 'DELETE' });
    carregarTudo();
  };

  const abrirEdicao = (item) => {
    setEditandoItem(item);
    if (activeTab === 'icms') {
      setFormData({ ...formData, origem: item.origem, destino: item.destino, aliquota: item.aliquota });
    } else if (activeTab === 'veiculos') {
      setFormData({ ...formData, tipo: item.tipo_veiculo || item.tipo_semireboque, eixos: item.eixos_veiculo || item.eixos_semireboque });
    } else {
      setFormData({ ...formData, descricao: item.descricao, valor: item.valor, unidade: item.unidade });
    }
    setIsModalOpen(true);
  };

  const fecharModal = () => {
    setIsModalOpen(false);
    setEditandoItem(null);
    setFormData({ origem: '', destino: '', aliquota: '', tipo: '', eixos: '', descricao: '', valor: '', unidade: '%' });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Painel de Configurações Operacionais</h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* NAVEGAÇÃO PRINCIPAL */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button onClick={() => setActiveTab('icms')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition ${activeTab === 'icms' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Map size={18} /> Matriz ICMS
          </button>
          <button onClick={() => setActiveTab('veiculos')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition ${activeTab === 'veiculos' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Truck size={18} /> Veículos e Semirreboques
          </button>
          <button onClick={() => setActiveTab('taxas')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition ${activeTab === 'taxas' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
            <DollarSign size={18} /> Impostos e Taxas
          </button>
        </div>

        <div className="p-6">
          {/* BARRA DE BUSCA E AÇÕES (REPRODUZINDO SEU PADRÃO) */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <h2 className="font-bold text-slate-700 text-lg uppercase">
              {activeTab === 'icms' ? 'Alíquotas Interestaduais' : activeTab === 'veiculos' ? (activeSubTab === 'veiculos' ? 'Frota de Tração' : 'Frota de Carga') : `Taxas: ${subAbaAtiva}`}
            </h2>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Buscar..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-full outline-none focus:border-blue-500" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')} className="p-2 border rounded-lg hover:bg-slate-50 text-slate-600"><ArrowUpDown size={18} /></button>
              <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 font-bold"><Plus size={16} /> Novo</button>
            </div>
          </div>

          {/* CONTEÚDO: ICMS OU VEICULOS */}
          {(activeTab === 'icms' || activeTab === 'veiculos') && (
            <div className="space-y-4">
              {activeTab === 'veiculos' && (
                <div className="flex gap-4 mb-6 border-b pb-2">
                  <button onClick={() => setActiveSubTab('veiculos')} className={`pb-2 px-2 text-sm font-bold transition-all ${activeSubTab === 'veiculos' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Cavalos/Caminhões</button>
                  <button onClick={() => setActiveSubTab('semireboques')} className={`pb-2 px-2 text-sm font-bold transition-all ${activeSubTab === 'semireboques' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Semirreboques/Implementos</button>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {dadosFiltrados.map((item) => (
                  <div key={item.id} className="p-3 border rounded-lg bg-slate-50 flex flex-col gap-1 group hover:border-blue-300 transition-all shadow-sm">
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <span>{activeTab === 'icms' ? 'Alíquota' : 'Modelo'}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrirEdicao(item)} className="text-blue-500 hover:text-blue-700 font-bold">Editar</button>
                        <button onClick={() => handleExcluir(item.id)} className="text-red-500"><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <span className="font-bold text-slate-700 truncate">
                      {activeTab === 'icms' ? `${item.origem}-${item.destino}` : (item.tipo_veiculo || item.tipo_semireboque)}
                    </span>
                    <span className="text-lg font-black text-blue-700">
                      {activeTab === 'icms' ? `${item.aliquota}%` : `${item.eixos_veiculo || item.eixos_semireboque} Eixos`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SEÇÃO: IMPOSTOS E TAXAS (IMPLEMENTADA) */}
          {activeTab === 'taxas' && (
            <div className="space-y-6">
              {/* Navegação interna de Taxas */}
              <div className="flex gap-6 border-b border-slate-100 pb-2">
                {['impostos', 'custos', 'seguro', 'markup'].map(tab => (
                   <button key={tab} onClick={() => setSubAbaAtiva(tab)} className={`text-xs font-black uppercase tracking-widest pb-2 transition-all ${subAbaAtiva === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    {tab}
                   </button>
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar para Markup */}
                {subAbaAtiva === 'markup' && (
                  <div className="w-full md:w-48 space-y-1">
                    {clientesMarkup.map(c => (
                      <button key={c} onClick={() => setClienteMarkupAtivo(c)} className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${clienteMarkupAtivo === c ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-500'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                )}

                {/* Grid de Itens (Mesmo visual que você já usa) */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dadosFiltrados.map((taxa) => (
                    <div key={taxa.id} className="p-4 border rounded-xl bg-slate-50 flex flex-col justify-between group hover:border-blue-300 transition-all shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{taxa.categoria}</span>
                          <span className="font-bold text-slate-700 leading-tight">{taxa.descricao}</span>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => abrirEdicao(taxa)} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><Settings2 size={14} /></button>
                          <button onClick={() => handleExcluir(taxa.id)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="mt-auto">
                        <span className="text-2xl font-black text-blue-700">{taxa.valor}{taxa.unidade}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL GLOBAL (ADAPTADO) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editandoItem ? 'Editar' : 'Novo'} Registro</h3>
            <div className="space-y-4">
              {activeTab === 'icms' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Origem (UF)</label>
                        <input className="w-full border rounded p-2 focus:border-blue-500 outline-none" value={formData.origem} onChange={e => setFormData({...formData, origem: e.target.value.toUpperCase()})} maxLength={2} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Destino (UF)</label>
                        <input className="w-full border rounded p-2 focus:border-blue-500 outline-none" value={formData.destino} onChange={e => setFormData({...formData, destino: e.target.value.toUpperCase()})} maxLength={2} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Alíquota %</label>
                    <input type="number" className="w-full border rounded p-2 focus:border-blue-500 outline-none" value={formData.aliquota} onChange={e => setFormData({...formData, aliquota: e.target.value})} />
                  </div>
                </>
              ) : activeTab === 'veiculos' ? (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Tipo/Descrição</label>
                    <input placeholder="Ex: Bitrem, Truck..." className="w-full border rounded p-2 focus:border-blue-500 outline-none" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Quantidade de Eixos</label>
                    <input type="number" className="w-full border rounded p-2 focus:border-blue-500 outline-none" value={formData.eixos} onChange={e => setFormData({...formData, eixos: e.target.value})} />
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 bg-blue-50 rounded text-[10px] font-bold text-blue-600 uppercase mb-2">
                    {subAbaAtiva} {subAbaAtiva === 'markup' && `- ${clienteMarkupAtivo}`}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Descrição da Taxa</label>
                    <input className="w-full border rounded p-2 focus:border-blue-500 outline-none" value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400">Valor</label>
                      <input type="number" className="w-full border rounded p-2 focus:border-blue-500 outline-none" value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400">Unidade</label>
                      <select className="w-full border rounded p-2 bg-white outline-none" value={formData.unidade} onChange={e => setFormData({...formData, unidade: e.target.value})}>
                        <option value="%">%</option>
                        <option value="R$">R$</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={fecharModal} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                <button onClick={handleSalvar} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold transition-colors">Salvar Dados</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuracoes;