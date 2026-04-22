import { useState, useEffect, useMemo } from 'react';
import { Map, Truck, DollarSign, Plus, Search, ArrowUpDown, Trash2, Settings2, Save, X, ChevronRight, Table } from 'lucide-react';

const Configuracoes = () => {
  // --- NAVEGAÇÃO ---
  const [activeTab, setActiveTab] = useState('icms'); 
  const [activeSubTab, setActiveSubTab] = useState('veiculos'); 
  const [subAbaAtiva, setSubAbaAtiva] = useState('impostos');
  const [clienteMarkupAtivo, setClienteMarkupAtivo] = useState('DIVERSOS');

  // --- DADOS ---
  const [listaIcms, setListaIcms] = useState([]);
  const [listaVeiculos, setListaVeiculos] = useState([]);
  const [listaSemireboques, setListaSemireboques] = useState([]);
  const [listaTaxas, setListaTaxas] = useState([]);
  const [listaMarkup, setListaMarkup] = useState([]);
  const [listaTabelaPreco, setListaTabelaPreco] = useState([]); // Nova sub-aba

  // --- UI ---
  const [busca, setBusca] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editandoItem, setEditandoItem] = useState(null);
  const clientesMarkup = ['DIVERSOS', 'RENAULT', 'MAHLE', 'ROD CNH', 'NIDEC', 'BOTICARIO', 'ROD IVECO'];

  const [formData, setFormData] = useState({ 
    origem: '', destino: '', aliquota: '', 
    tipo: '', eixos: '', 
    descricao: '', valor: '', unidade: '%',
    cliente: 'DIVERSOS', margem: '', lucro: '', imposto_markup: '',
    rota: '', valor_tabela: '' // Campos novos
  });

  const API_BASE = 'http://localhost:8000';

  // --- CARREGAMENTO ---
  const carregarTudo = async () => {
    try {
      const [icms, veic, semi, imp, seg, gris, desp, mark, tabPreco] = await Promise.all([
        fetch(`${API_BASE}/icms/`).then(res => res.json()),
        fetch(`${API_BASE}/veiculos/`).then(res => res.json()),
        fetch(`${API_BASE}/semireboques/`).then(res => res.json()),
        fetch(`${API_BASE}/impostos/`).then(res => res.json().catch(() => [])),
        fetch(`${API_BASE}/custo-seguro-carga/`).then(res => res.json().catch(() => [])),
        fetch(`${API_BASE}/custo-gris/`).then(res => res.json().catch(() => [])),
        fetch(`${API_BASE}/custo-despesa-operacional/`).then(res => res.json().catch(() => [])),
        fetch(`${API_BASE}/markups/`).then(res => res.json().catch(() => [])),
        fetch(`${API_BASE}/tabela-precos/`).then(res => res.json().catch(() => [])),
      ]);

      setListaIcms(icms);
      setListaVeiculos(veic);
      setListaSemireboques(semi);
      setListaMarkup(mark);
      setListaTabelaPreco(tabPreco);
      setListaTaxas([
        ...imp.map(i => ({ id: `imp-${i.id}`, realId: i.id, categoria: 'impostos', descricao: i.nome, valor: i.aliquota, unidade: '%' })),
        ...seg.map(s => ({ id: `seg-${s.id}`, realId: s.id, categoria: 'seguro', descricao: s.tipo, valor: s.taxa, unidade: '%' })),
        ...gris.map(g => ({ id: `gris-${g.id}`, realId: g.id, categoria: 'custos', descricao: g.descricao, valor: g.valor, unidade: 'R$' })),
        ...desp.map(d => ({ id: `desp-${d.id}`, realId: d.id, categoria: 'custos', descricao: d.nome, valor: d.valor, unidade: d.unidade === 'PERCENTUAL' ? '%' : 'R$' }))
      ]);
    } catch (err) { console.error("Erro ao carregar:", err); }
  };

  useEffect(() => { carregarTudo(); }, []);

  // --- FILTRAGEM ---
  const dadosFiltrados = useMemo(() => {
    const termo = busca.trim().toUpperCase();
    if (activeTab === 'icms') return listaIcms.filter(i => (i.origem + i.destino).toUpperCase().includes(termo));
    if (activeTab === 'veiculos') return activeSubTab === 'veiculos' ? listaVeiculos.filter(v => v.tipo_veiculo.toUpperCase().includes(termo)) : listaSemireboques.filter(s => s.tipo_semireboque.toUpperCase().includes(termo));
    if (activeTab === 'taxas') {
      if (subAbaAtiva === 'markup') return listaMarkup.filter(m => m.cliente === clienteMarkupAtivo);
      if (subAbaAtiva === 'tabela') return listaTabelaPreco.filter(t => t.cliente === clienteMarkupAtivo);
      return listaTaxas.filter(t => t.categoria === subAbaAtiva && t.descricao.toUpperCase().includes(termo));
    }
    return [];
  }, [activeTab, activeSubTab, subAbaAtiva, clienteMarkupAtivo, listaIcms, listaVeiculos, listaSemireboques, listaTaxas, listaMarkup, listaTabelaPreco, busca]);

  // --- AÇÕES CRUD ---
  const handleSalvar = async () => {
    let url = ''; let body = {};
    const metodo = editandoItem ? 'PUT' : 'POST';

    try {
        if (activeTab === 'icms') {
          url = `${API_BASE}/icms/` + (editandoItem ? `${editandoItem.id}/` : '');
          body = { origem: formData.origem.toUpperCase(), destino: formData.destino.toUpperCase(), aliquota: parseFloat(formData.aliquota) };
        } else if (activeTab === 'veiculos') {
          const rota = activeSubTab === 'veiculos' ? 'veiculos' : 'semireboques';
          url = `${API_BASE}/${rota}/` + (editandoItem ? `${editandoItem.id}/` : '');
          body = activeSubTab === 'veiculos' ? { tipo_veiculo: formData.tipo, eixos_veiculo: parseInt(formData.eixos) } : { tipo_semireboque: formData.tipo, eixos_semireboque: parseInt(formData.eixos) };
        } else if (subAbaAtiva === 'markup') {
          url = `${API_BASE}/markups/` + (editandoItem ? `${editandoItem.id}/` : '');
          body = { cliente: formData.cliente, margem: parseFloat(formData.margem), lucro: parseFloat(formData.lucro), imposto: parseFloat(formData.imposto_markup) };
        } else if (subAbaAtiva === 'tabela') {
            url = `${API_BASE}/tabela-precos/` + (editandoItem ? `${editandoItem.id}/` : '');
            body = { cliente: formData.cliente, rota: formData.rota, valor: parseFloat(formData.valor_tabela) };
        } else {
          // Correção de campos para Seguro, Impostos e Custos
          if (subAbaAtiva === 'impostos') {
              url = `${API_BASE}/impostos/` + (editandoItem ? `${editandoItem.realId}/` : '');
              body = { nome: formData.descricao, aliquota: parseFloat(formData.valor) };
          } else if (subAbaAtiva === 'seguro') {
              url = `${API_BASE}/custo-seguro-carga/` + (editandoItem ? `${editandoItem.realId}/` : '');
              body = { tipo: formData.descricao, taxa: parseFloat(formData.valor) };
          } else {
              url = `${API_BASE}/custo-despesa-operacional/` + (editandoItem ? `${editandoItem.realId}/` : '');
              body = { nome: formData.descricao, valor: parseFloat(formData.valor), unidade: formData.unidade === '%' ? 'PERCENTUAL' : 'VALOR' };
          }
        }

        const res = await fetch(url, { 
            method: metodo, 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(body) 
        });
        
        if (res.ok) { carregarTudo(); fecharModal(); }
        else { alert("Erro ao salvar no servidor."); }
    } catch (err) { console.error("Erro na requisição:", err); }
  };

  const handleExcluir = async (item) => {
    if (!window.confirm("Excluir?")) return;
    let rota = activeTab === 'icms' ? 'icms' : (activeTab === 'veiculos' ? (activeSubTab === 'veiculos' ? 'veiculos' : 'semireboques') : (subAbaAtiva === 'markup' ? 'markups' : subAbaAtiva === 'tabela' ? 'tabela-precos' : (item.categoria === 'impostos' ? 'impostos' : item.categoria === 'seguro' ? 'custo-seguro-carga' : 'custo-despesa-operacional')));
    await fetch(`${API_BASE}/${rota}/${item.realId || item.id}/`, { method: 'DELETE' });
    carregarTudo();
  };

  const abrirEdicao = (item) => {
    setEditandoItem(item);
    if (activeTab === 'icms') setFormData({...formData, origem: item.origem, destino: item.destino, aliquota: item.aliquota});
    else if (activeTab === 'veiculos') setFormData({...formData, tipo: item.tipo_veiculo || item.tipo_semireboque, eixos: item.eixos_veiculo || item.eixos_semireboque});
    else if (subAbaAtiva === 'markup') setFormData({...formData, cliente: item.cliente, margem: item.margem, lucro: item.lucro, imposto_markup: item.imposto});
    else if (subAbaAtiva === 'tabela') setFormData({...formData, cliente: item.cliente, rota: item.rota, valor_tabela: item.valor});
    else setFormData({...formData, descricao: item.descricao, valor: item.valor, unidade: item.unidade});
    setIsModalOpen(true);
  };

  const fecharModal = () => {
    setIsModalOpen(false); setEditandoItem(null);
    setFormData({ origem: '', destino: '', aliquota: '', tipo: '', eixos: '', descricao: '', valor: '', unidade: '%', cliente: 'DIVERSOS', margem: '', lucro: '', imposto_markup: '', rota: '', valor_tabela: '' });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* NAVEGAÇÃO PRINCIPAL */}
        <div className="flex border-b bg-slate-50">
          {[
            { id: 'icms', label: 'Matriz ICMS', icon: <Map size={18}/> },
            { id: 'veiculos', label: 'Veículos', icon: <Truck size={18}/> },
            { id: 'taxas', label: 'Impostos e Taxas', icon: <DollarSign size={18}/> }
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition ${activeTab === t.id ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input className="pl-9 pr-4 py-2 border rounded-lg text-sm w-full" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition">
              <Plus size={16} /> Novo Registro
            </button>
          </div>

          {/* CONTEÚDO ICMS E VEÍCULOS */}
          {(activeTab === 'icms' || activeTab === 'veiculos') && (
            <div className="space-y-4">
              {activeTab === 'veiculos' && (
                <div className="flex gap-4 mb-4 border-b pb-2">
                  <button onClick={() => setActiveSubTab('veiculos')} className={`text-sm font-bold ${activeSubTab === 'veiculos' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Caminhões</button>
                  <button onClick={() => setActiveSubTab('semireboques')} className={`text-sm font-bold ${activeSubTab === 'semireboques' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Carretas</button>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {dadosFiltrados.map(item => (
                  <div key={item.id} className="p-4 border rounded-lg bg-slate-50 group hover:border-blue-300 relative transition-all">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{activeTab === 'icms' ? 'Alíquota' : 'Eixos'}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrirEdicao(item)} className="text-blue-500"><Settings2 size={14}/></button>
                        <button onClick={() => handleExcluir(item)} className="text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <p className="font-bold text-slate-700">{activeTab === 'icms' ? `${item.origem} ➔ ${item.destino}` : (item.tipo_veiculo || item.tipo_semireboque)}</p>
                    <p className="text-xl font-black text-blue-700">{activeTab === 'icms' ? `${item.aliquota}%` : `${item.eixos_veiculo || item.eixos_semireboque} Eixos`}</p>
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

      {/* MODAL COMPLETO DINÂMICO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-lg font-black text-slate-800 uppercase mb-6">{editandoItem ? 'Editar' : 'Novo'} Registro</h3>
            <div className="space-y-4">
              {activeTab === 'icms' ? (
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Origem (UF)" className="border rounded-lg p-2.5" value={formData.origem} onChange={e => setFormData({...formData, origem: e.target.value.toUpperCase()})} />
                  <input placeholder="Destino (UF)" className="border rounded-lg p-2.5" value={formData.destino} onChange={e => setFormData({...formData, destino: e.target.value.toUpperCase()})} />
                  <input placeholder="Alíquota %" className="border rounded-lg p-2.5 col-span-2" type="number" value={formData.aliquota} onChange={e => setFormData({...formData, aliquota: e.target.value})} />
                </div>
              ) : activeTab === 'veiculos' ? (
                <>
                  <input placeholder="Modelo" className="w-full border rounded-lg p-2.5" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} />
                  <input placeholder="Nº de Eixos" className="w-full border rounded-lg p-2.5" type="number" value={formData.eixos} onChange={e => setFormData({...formData, eixos: e.target.value})} />
                </>
              ) : subAbaAtiva === 'markup' ? (
                <>
                  <select className="w-full border rounded-lg p-2.5 bg-slate-50 font-bold" value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})}>
                    {clientesMarkup.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Margem %" className="border rounded-lg p-2.5" type="number" value={formData.margem} onChange={e => setFormData({...formData, margem: e.target.value})} />
                    <input placeholder="Lucro %" className="border rounded-lg p-2.5" type="number" value={formData.lucro} onChange={e => setFormData({...formData, lucro: e.target.value})} />
                  </div>
                  <input placeholder="Impostos %" className="w-full border rounded-lg p-2.5 bg-blue-50" type="number" value={formData.imposto_markup} onChange={e => setFormData({...formData, imposto_markup: e.target.value})} />
                </>
              ) : subAbaAtiva === 'tabela' ? (
                <>
                  <select className="w-full border rounded-lg p-2.5 bg-slate-50 font-bold mb-2" value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})}>
                    {clientesMarkup.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input placeholder="Rota (Ex: Curitiba x SP)" className="w-full border rounded-lg p-2.5" value={formData.rota} onChange={e => setFormData({...formData, rota: e.target.value})} />
                  <input placeholder="Valor R$" className="w-full border rounded-lg p-2.5" type="number" value={formData.valor_tabela} onChange={e => setFormData({...formData, valor_tabela: e.target.value})} />
                </>
              ) : (
                <>
                  <input placeholder="Descrição" className="w-full border rounded-lg p-2.5" value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} />
                  <div className="flex gap-2">
                    <input placeholder="Valor" className="flex-1 border rounded-lg p-2.5" type="number" value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} />
                    <select className="w-24 border rounded-lg p-2.5 bg-white" value={formData.unidade} onChange={e => setFormData({...formData, unidade: e.target.value})}>
                      <option value="%">%</option>
                      <option value="R$">R$</option>
                    </select>
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-6">
                <button onClick={fecharModal} className="flex-1 px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button onClick={handleSalvar} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-black shadow-lg flex items-center justify-center gap-2"><Save size={18}/> Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuracoes;