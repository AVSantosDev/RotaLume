import React, { useState, useEffect, useMemo } from 'react';
import { Map, Truck, DollarSign, Plus, Search, ArrowUpDown, Trash2, Settings2, X } from 'lucide-react';

const Configuracoes = () => {
  // --- ESTADOS DE NAVEGAÇÃO ---
  const [activeTab, setActiveTab] = useState('icms'); 
  const [activeSubTab, setActiveSubTab] = useState('veiculos'); 
  const [subAbaAtiva, setSubAbaAtiva] = useState('impostos');
  const [clienteMarkupAtivo, setClienteMarkupAtivo] = useState('DIVERSOS');

  // --- ESTADOS DE DADOS ---
  const [listaIcms, setListaIcms] = useState([]);
  const [listaVeiculos, setListaVeiculos] = useState([]);
  const [listaSemireboques, setListaSemireboques] = useState([]);
  const [listaTaxas, setListaTaxas] = useState([]);

  // --- ESTADOS DE UI ---
  const [busca, setBusca] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editandoItem, setEditandoItem] = useState(null);
  const clientesMarkup = ['DIVERSOS', 'RENAULT', 'MAHLE', 'ROD CNH', 'NIDEC', 'BOTICARIO', 'ROD IVECO'];

  const [formData, setFormData] = useState({ 
    origem: '', destino: '', aliquota: '', 
    tipo: '', eixos: '', descricao: '', valor: '', unidade: '%' 
  });

  const API_BASE = 'http://localhost:8000';

  // --- 1. CARREGAMENTO E NORMALIZAÇÃO ---
  const carregarTudo = async () => {
    try {
      // Carregamento de ICMS e Veículos
      const [icms, veic, semi] = await Promise.all([
        fetch(`${API_BASE}/icms/`).then(res => res.json()),
        fetch(`${API_BASE}/veiculos/`).then(res => res.json()),
        fetch(`${API_BASE}/semireboques/`).then(res => res.json()),
      ]);
      
      setListaIcms(icms);
      setListaVeiculos(veic);
      setListaSemireboques(semi);

      // Carregamento de Taxas e Impostos
      const [imp, seg, gris, desp] = await Promise.all([
        fetch(`${API_BASE}/impostos/`).then(res => res.json().catch(() => [])),
        fetch(`${API_BASE}/custo-seguro-carga/`).then(res => res.json().catch(() => [])),
        fetch(`${API_BASE}/custo-gris/`).then(res => res.json().catch(() => [])),
        fetch(`${API_BASE}/custo-despesa-operacional/`).then(res => res.json().catch(() => [])),
      ]);

      const taxasUnificadas = [
        ...imp.map(i => ({ id: `imp-${i.id}`, realId: i.id, categoria: 'impostos', descricao: i.nome, valor: i.aliquota, unidade: '%' })),
        ...seg.map(s => ({ id: `seg-${s.id}`, realId: s.id, categoria: 'seguro', descricao: s.tipo, valor: s.taxa, unidade: '%' })),
        ...gris.map(g => ({ id: `gris-${g.id}`, realId: g.id, categoria: 'custos', descricao: g.descricao, valor: g.valor, unidade: 'R$' })),
        ...desp.map(d => ({ id: `desp-${d.id}`, realId: d.id, categoria: 'custos', descricao: d.nome, valor: d.valor, unidade: d.unidade === 'PERCENTUAL' ? '%' : 'R$' }))
      ];

      setListaTaxas(taxasUnificadas);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    }
  };

  useEffect(() => { carregarTudo(); }, []);

  // --- 2. FILTRAGEM ---
  const dadosFiltrados = useMemo(() => {
    const termo = busca.trim().toUpperCase();
    let base = [];

    if (activeTab === 'icms') {
      base = listaIcms.filter(i => i.origem.includes(termo) || i.destino.includes(termo));
    } else if (activeTab === 'veiculos') {
      base = activeSubTab === 'veiculos' 
        ? listaVeiculos.filter(v => v.tipo_veiculo.toUpperCase().includes(termo))
        : listaSemireboques.filter(s => s.tipo_semireboque.toUpperCase().includes(termo));
    } else if (activeTab === 'taxas') {
      base = listaTaxas.filter(t => t.categoria === subAbaAtiva && t.descricao.toUpperCase().includes(termo));
    }

    return base.sort((a, b) => {
      const valA = (a.origem || a.tipo_veiculo || a.tipo_semireboque || a.descricao || "").toString();
      const valB = (b.origem || b.tipo_veiculo || b.tipo_semireboque || b.descricao || "").toString();
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [activeTab, activeSubTab, subAbaAtiva, listaIcms, listaVeiculos, listaSemireboques, listaTaxas, busca, sortOrder]);

  // --- 3. AÇÕES ---
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
      const rotaTaxa = subAbaAtiva === 'impostos' ? 'impostos' : subAbaAtiva === 'seguro' ? 'custo-seguro-carga' : 'custo-despesa-operacional';
      url = `${API_BASE}/${rotaTaxa}/` + (editandoItem ? `${editandoItem.realId}/` : '');
      
      if (subAbaAtiva === 'impostos') body = { nome: formData.descricao, aliquota: formData.valor };
      else if (subAbaAtiva === 'seguro') body = { tipo: formData.descricao, taxa: formData.valor };
      else body = { nome: formData.descricao, valor: formData.valor, unidade: formData.unidade === '%' ? 'PERCENTUAL' : 'VALOR' };
    }

    try {
      const res = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) { carregarTudo(); fecharModal(); }
    } catch (err) { console.error(err); }
  };

  const handleExcluir = async (item) => {
    if (!window.confirm("Confirmar exclusão?")) return;
    let rota = activeTab === 'icms' ? 'icms' : (activeTab === 'veiculos' ? (activeSubTab === 'veiculos' ? 'veiculos' : 'semireboques') : (item.categoria === 'impostos' ? 'impostos' : item.categoria === 'seguro' ? 'custo-seguro-carga' : 'custo-despesa-operacional'));
    const id = item.realId || item.id;
    await fetch(`${API_BASE}/${rota}/${id}/`, { method: 'DELETE' });
    carregarTudo();
  };

  const abrirEdicao = (item) => {
    setEditandoItem(item);
    if (activeTab === 'icms') setFormData({ ...formData, origem: item.origem, destino: item.destino, aliquota: item.aliquota });
    else if (activeTab === 'veiculos') setFormData({ ...formData, tipo: item.tipo_veiculo || item.tipo_semireboque, eixos: item.eixos_veiculo || item.eixos_semireboque });
    else setFormData({ ...formData, descricao: item.descricao, valor: item.valor, unidade: item.unidade });
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
          {/* BARRA DE BUSCA E AÇÕES */}
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

          {/* LISTAGEM ICMS / VEICULOS */}
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
                        <button onClick={() => abrirEdicao(item)} className="text-blue-500 p-1 hover:bg-blue-100 rounded transition-colors"><Settings2 size={12} /></button>
                        <button onClick={() => handleExcluir(item)} className="text-red-500 p-1 hover:bg-red-100 rounded transition-colors"><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <span className="font-bold text-slate-700 truncate uppercase">
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

           {/* CONTEÚDO TAXAS / MARKUP / TABELA */}
           {activeTab === 'taxas' && (
            <div className="space-y-6">
              <div className="flex gap-6 border-b pb-2">
                {['impostos', 'seguro', 'custos', 'markup', 'tabela'].map(tab => (
                  <button key={tab} onClick={() => setSubAbaAtiva(tab)} className={`text-xs font-black uppercase pb-2 ${subAbaAtiva === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>{tab === 'tabela' ? 'Tabela Preço' : tab}</button>
                ))}
              </div>
              <div className="flex flex-col md:flex-row gap-6">
                {(subAbaAtiva === 'markup' || subAbaAtiva === 'tabela') && (
                  <div className="w-full md:w-48 space-y-1">
                    {clientesMarkup.map(c => (
                      <button key={c} onClick={() => setClienteMarkupAtivo(c)} className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase ${clienteMarkupAtivo === c ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-500'}`}>{c}</button>
                    ))}
                  </div>
                )}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dadosFiltrados.map(item => (
                    <div key={item.id} className="p-4 border rounded-xl bg-slate-50 group hover:border-blue-300 transition-all">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{item.cliente || item.categoria}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => abrirEdicao(item)} className="text-blue-500"><Settings2 size={16}/></button>
                          <button onClick={() => handleExcluir(item)} className="text-red-500"><Trash2 size={16}/></button>
                        </div>
                      </div>
                      <p className="font-bold text-slate-700">{subAbaAtiva === 'markup' ? 'Markup Final' : subAbaAtiva === 'tabela' ? item.rota : item.descricao}</p>
                      {subAbaAtiva === 'markup' ? (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold">
                          <div className="bg-white p-2 rounded border">Margem: {item.margem}%</div>
                          <div className="bg-white p-2 rounded border">Lucro: {item.lucro}%</div>
                          <div className="bg-blue-50 p-2 rounded border col-span-2 text-blue-700 text-center text-sm">Total: {item.imposto}%</div>
                        </div>
                      ) : subAbaAtiva === 'tabela' ? (
                        <p className="text-2xl font-black text-blue-700 mt-4">R$ {item.valor}</p>
                      ) : (
                        <p className="text-2xl font-black text-blue-700 mt-4">{item.unidade === 'R$' ? `R$ ${item.valor}` : `${item.valor}${item.unidade}`}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL GLOBAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 uppercase text-slate-700">{editandoItem ? 'Editar' : 'Novo'} Registro</h3>
            <div className="space-y-4">
              {activeTab === 'icms' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Origem</label>
                    <input className="border rounded p-2 outline-none focus:border-blue-500 uppercase" maxLength={2} value={formData.origem} onChange={e => setFormData({...formData, origem: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Destino</label>
                    <input className="border rounded p-2 outline-none focus:border-blue-500 uppercase" maxLength={2} value={formData.destino} onChange={e => setFormData({...formData, destino: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Alíquota %</label>
                    <input className="border rounded p-2 outline-none focus:border-blue-500" type="number" value={formData.aliquota} onChange={e => setFormData({...formData, aliquota: e.target.value})} />
                  </div>
                </div>
              ) : activeTab === 'veiculos' ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Modelo/Tipo</label>
                    <input className="w-full border rounded p-2 outline-none focus:border-blue-500" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Qtd. Eixos</label>
                    <input className="w-full border rounded p-2 outline-none focus:border-blue-500" type="number" value={formData.eixos} onChange={e => setFormData({...formData, eixos: e.target.value})} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Descrição da Taxa</label>
                    <input className="w-full border rounded p-2 outline-none focus:border-blue-500" value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Valor</label>
                      <input className="w-full border rounded p-2 outline-none focus:border-blue-500" type="number" value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Unidade</label>
                      <select className="border rounded p-2 bg-white outline-none" value={formData.unidade} onChange={e => setFormData({...formData, unidade: e.target.value})}>
                        <option value="%">% (Percentual)</option>
                        <option value="R$">R$ (Moeda)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={fecharModal} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded transition-colors uppercase text-xs font-bold">Cancelar</button>
                <button onClick={handleSalvar} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition-all shadow-md uppercase text-xs tracking-wider">Salvar Alterações</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuracoes;