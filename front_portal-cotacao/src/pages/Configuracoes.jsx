import { useState, useEffect, useMemo, Fragment } from 'react';
import { Map as MapIcon, Truck, DollarSign, Plus, Search, ArrowUpDown, Trash2, Settings2 } from 'lucide-react';

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState('icms'); 
  const [activeSubTab, setActiveSubTab] = useState('veiculos'); 
  const [subAbaAtiva, setSubAbaAtiva] = useState('impostos');
  const [clienteMarkupAtivo, setClienteMarkupAtivo] = useState('DIVERSOS');

  // Estados de Dados
  const [listaIcms, setListaIcms] = useState([]);
  const [listaVeiculos, setListaVeiculos] = useState([]);
  const [listaSemireboques, setListaSemireboques] = useState([]);
  const [listaTaxas, setListaTaxas] = useState([]);
  const[listaTabelas, setListaTabelas]= useState([]);
  const [listaImpostos, setListaImpostos] = useState([]);
  const [listaSeguros, setListaSeguros] = useState([]);
  const [listaGris, setListaGris] = useState([]);
  const [listaDespesas, setListaDespesas] = useState([]);
  const [listaMarkupConfig, setListaMarkupConfig] = useState([]);

  // Estados de UI
  const [busca, setBusca] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editandoItem, setEditandoItem] = useState(null);
  const [seguroSubTab, setSeguroSubTab] = useState('carga'); // 'carga' | 'gris'
  //const clientesMarkup = ['DIVERSOS', 'RENAULT', 'MAHLE', 'ROD CNH', 'NIDEC', 'BOTICARIO', 'ROD IVECO'];
  // Gera a lista de clientes únicos baseada nos dados que vieram do banco
  const clientesMarkup = useMemo(() => {const nomes = listaTabelas.map(t => t.nome_cliente).filter(Boolean);return [...new Set(nomes)].sort();}, [listaTabelas]);

  const impostosOrdenados = useMemo(() => {
    const preferidos = ['PIS/COFINS', 'IR/CSLL', 'CPRB'];
    const nomes = listaImpostos.map(i => i.nome).filter(Boolean);
    const extras = [...new Set(nomes)]
      .filter(n => !preferidos.includes(n))
      .sort((a, b) => a.localeCompare(b));
    return [...preferidos.filter(n => nomes.includes(n)), ...extras];
  }, [listaImpostos]);

  const impostosPorNome = useMemo(() => {
    const map = new Map();
    for (const i of listaImpostos) {
      if (i?.nome) map.set(i.nome, i);
    }
    return map;
  }, [listaImpostos]);

  const markupClientes = useMemo(() => {
    const nomes = listaMarkupConfig.map(m => m.nome_cliente).filter(Boolean);
    return [...new Set(nomes)].sort((a, b) => a.localeCompare(b));
  }, [listaMarkupConfig]);

  const markupFaixas = useMemo(() => {
    const faixas = listaMarkupConfig.map(m => Number(m.faixa)).filter(n => Number.isFinite(n));
    return [...new Set(faixas)].sort((a, b) => a - b);
  }, [listaMarkupConfig]);

  const markupMap = useMemo(() => {
    const map = new Map();
    for (const m of listaMarkupConfig) {
      const cliente = m?.nome_cliente;
      const faixa = Number(m?.faixa);
      if (!cliente || !Number.isFinite(faixa)) continue;
      map.set(`${cliente}||${faixa}`, m);
    }
    return map;
  }, [listaMarkupConfig]);

  const initialFormData = { 
    origem: '',
    destino: '',
    aliquota: '',
    tipo: '',
    eixos: '',
    descricao: '',
    valor: '',
    unidade: '%',
    nome_cliente: '',
    seguro_taxa_1: 0,
    seguro_taxa_2: 0,
    valor_mercadoria_limite: 0,
    valor_ajudante: 0,
    taxa_utilitarios: 0,
    taxa_cavalo_4x2: 0,
    taxa_truck: 0,
    taxa_toco: 0,
    taxa_3_4: 0,
    taxa_cavalo_6x2: 0,
    imposto_nome: '',
    imposto_aliquota: '',
    seguro_tipo: '',
    seguro_taxa: '',
    gris_categoria: 'GERAL',
    gris_descricao: '',
    gris_valor: '',
    despesa_nome: '',
    despesa_valor: '',
    despesa_unidade: 'PERCENTUAL',
    markup_nome_cliente: '',
    markup_faixa: '',
    markup_percentual_base: '',
    markup_percentual_markup: '',
  };

  // FormData unificado
  const [formData, setFormData] = useState(initialFormData);

  const API_BASE = 'http://localhost:8000';

  const carregarTudo = () => {
    fetch(`${API_BASE}/icms/`).then(res => res.json()).then(data => setListaIcms(data)).catch(err => console.error(err));
    fetch(`${API_BASE}/veiculos/`).then(res => res.json()).then(data => setListaVeiculos(data)).catch(err => console.error(err));
    fetch(`${API_BASE}/semireboques/`).then(res => res.json()).then(data => setListaSemireboques(data)).catch(err => console.error(err));
    fetch(`${API_BASE}/taxas/`).then(res => res.json()).then(data => setListaTaxas(data)).catch(err => console.error(err));
    fetch(`${API_BASE}/impostos/`).then(res => res.json()).then(data => setListaImpostos(data)).catch(err => console.error(err));
    fetch(`${API_BASE}/seguros/`).then(res => res.json()).then(data => setListaSeguros(data)).catch(err => console.error(err));
    fetch(`${API_BASE}/gris/`).then(res => res.json()).then(data => setListaGris(data)).catch(err => console.error(err));
    fetch(`${API_BASE}/despesas-operacionais/`).then(res => res.json()).then(data => setListaDespesas(data)).catch(err => console.error(err));
    fetch(`${API_BASE}/markup-config/`).then(res => res.json()).then(data => setListaMarkupConfig(data)).catch(err => console.error(err));
    
    carregarTabelaPreco();

  };

  //---CARREGA OS DADOS NA TELA---
  useEffect(() => {
    carregarTudo();
    carregarTabelaPreco(); 
  }, []);


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
      if (subAbaAtiva === 'tabela') {
        base = listaTabelas.filter(t => 
          !busca || t.nome_cliente?.toUpperCase().includes(termo)
        );
      } else if (subAbaAtiva === 'impostos') {
        base = listaImpostos.filter(i => i.nome?.toUpperCase().includes(termo));
      } else if (subAbaAtiva === 'seguro') {
        base =
          seguroSubTab === 'carga'
            ? listaSeguros.filter(s => (s.tipo ?? '').toUpperCase().includes(termo))
            : listaGris.filter(g =>
                `${g.categoria ?? ''} ${g.descricao ?? ''}`.toUpperCase().includes(termo)
              );
      } else if (subAbaAtiva === 'custos') {
        base = listaDespesas.filter(d => (d.nome ?? '').toUpperCase().includes(termo));
      } else if (subAbaAtiva === 'markup') {
        base = listaMarkupConfig.filter(m => {
          const cliente = (m.nome_cliente ?? '').toUpperCase();
          const faixa = (m.faixa ?? '').toString().toUpperCase();
          return !termo || cliente.includes(termo) || faixa.includes(termo);
        });
      } else {
        // Mantém o filtro original para a aba de cards de Markup, se desejar
        base = listaTaxas.filter(t => 
          t.categoria?.toLowerCase() === subAbaAtiva && 
          (subAbaAtiva !== 'markup' || t.sub_categoria === clienteMarkupAtivo) &&
          t.descricao?.toUpperCase().includes(termo)
        );
      }
    }

    return base.sort((a, b) => {
        const valA = (a.nome_cliente || a.nome || a.tipo || a.origem || a.tipo_veiculo || a.tipo_semireboque || a.descricao || "").toString();
        const valB = (b.nome_cliente || b.nome || b.tipo || b.origem || b.tipo_veiculo || b.tipo_semireboque || b.descricao || "").toString();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [activeTab, activeSubTab, subAbaAtiva, clienteMarkupAtivo, seguroSubTab, listaIcms, listaVeiculos, listaSemireboques, listaTaxas, listaTabelas, listaImpostos, listaSeguros, listaGris, listaDespesas, listaMarkupConfig, busca, sortOrder]);


  

  const handleSalvar = async () => {
    if (activeTab === 'taxas' && subAbaAtiva === 'tabela') {
      return salvarTabelaPreco(formData); 
    }

    let url = '';
    let body = {};
    const metodo = editandoItem ? 'PUT' : 'POST';

    if (activeTab === 'icms') {
      url = `${API_BASE}/icms/` + (editandoItem ? `${editandoItem.id}/` : '');
      body = { origem: formData.origem.toUpperCase(), destino: formData.destino.toUpperCase(), aliquota: formData.aliquota };
    } else if (activeTab === 'veiculos') {
      const rota = activeSubTab === 'veiculos' ? 'veiculos' : 'semireboques';
      url = `${API_BASE}/${rota}/` + (editandoItem ? `${editandoItem.id}/` : '');
      
      // AQUI MANTÉM OS CAMPOS DO BANCO DE DADOS
      body = activeSubTab === 'veiculos' 
        ? { tipo_veiculo: formData.tipo, eixos_veiculo: formData.eixos }
        : { tipo_semireboque: formData.tipo, eixos_semireboque: formData.eixos };
    } else if (activeTab === 'taxas') {
      if (subAbaAtiva === 'impostos') {
        url = `${API_BASE}/impostos/` + (editandoItem ? `${editandoItem.id}/` : '');
        body = { 
          nome: formData.imposto_nome, 
          aliquota: formData.imposto_aliquota 
        };
      } else if (subAbaAtiva === 'seguro') {
        if (seguroSubTab === 'carga') {
          url = `${API_BASE}/seguros/` + (editandoItem ? `${editandoItem.id}/` : '');
          body = {
            tipo: formData.seguro_tipo,
            taxa: formData.seguro_taxa,
          };
        } else {
          url = `${API_BASE}/gris/` + (editandoItem ? `${editandoItem.id}/` : '');
          const grisValorNormalizado =
            formData.gris_valor === '' || formData.gris_valor === null || formData.gris_valor === undefined
              ? 0
              : typeof formData.gris_valor === 'string'
                ? parseFloat(formData.gris_valor.toString().replace(',', '.'))
                : formData.gris_valor;

          body = {
            categoria: formData.gris_categoria,
            descricao: formData.gris_descricao,
            valor: Number.isFinite(grisValorNormalizado) ? grisValorNormalizado : 0,
          };
        }
      } else if (subAbaAtiva === 'custos') {
        url = `${API_BASE}/despesas-operacionais/` + (editandoItem ? `${editandoItem.id}/` : '');
        body = {
          nome: formData.despesa_nome,
          valor: formData.despesa_valor,
          unidade: formData.despesa_unidade,
        };
      } else if (subAbaAtiva === 'markup') {
        url = `${API_BASE}/markup-config/` + (editandoItem ? `${editandoItem.id}/` : '');
        body = {
          nome_cliente: formData.markup_nome_cliente,
          faixa: Number(formData.markup_faixa),
          percentual_base: formData.markup_percentual_base,
          percentual_markup: formData.markup_percentual_markup,
        };
      } else {
        url = `${API_BASE}/taxas/` + (editandoItem ? `${editandoItem.id}/` : '');
        body = { 
          categoria: subAbaAtiva.toUpperCase(), 
          sub_categoria: subAbaAtiva === 'markup' ? clienteMarkupAtivo : 'GERAL',
          descricao: formData.descricao, 
          valor: formData.valor,
          unidade: formData.unidade 
        };
      }
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
  
    let rota = '';
  
    // Define a rota baseada na aba e sub-aba ativa
    if (activeTab === 'icms') {
      rota = 'icms';
    } else if (activeTab === 'veiculos') {
      rota = activeSubTab === 'veiculos' ? 'veiculos' : 'semireboques';
    } else if (activeTab === 'taxas') {
      // Se estiver na sub-aba de Tabela Preço, usa a rota específica do Django
      if (subAbaAtiva === 'tabela') rota = 'cliente-taxas-config';
      else if (subAbaAtiva === 'impostos') rota = 'impostos';
      else if (subAbaAtiva === 'seguro') rota = seguroSubTab === 'carga' ? 'seguros' : 'gris';
      else if (subAbaAtiva === 'custos') rota = 'despesas-operacionais';
      else if (subAbaAtiva === 'markup') rota = 'markup-config';
      else rota = 'taxas';
    }
  
    try {
      const res = await fetch(`${API_BASE}/${rota}/${id}/`, { 
        method: 'DELETE' 
      });
  
      if (res.ok) {
        console.log(`>>> [SUCESSO] Item ${id} excluído de ${rota}`);
        carregarTudo(); // Recarrega todas as listas
      } else {
        alert("Erro ao excluir o item no servidor.");
      }
    } catch (err) {
      console.error(">>> [ERRO REDE]:", err);
    }
  };

  const abrirEdicao = (item) => {
    setEditandoItem(item);

    if (activeTab === 'taxas' && subAbaAtiva === 'tabela') {
      setFormData({
        ...formData,
        nome_cliente: item.nome_cliente,
        seguro_taxa_1: item.seguro_taxa_1,
        seguro_taxa_2: item.seguro_taxa_2,
        valor_mercadoria_limite: item.valor_mercadoria_limite,
        valor_ajudante: item.valor_ajudante,
        taxa_utilitarios: item.taxa_utilitarios,
        taxa_cavalo_4x2: item.taxa_cavalo_4x2,
        taxa_truck: item.taxa_truck,
        taxa_toco: item.taxa_toco,
        taxa_3_4: item.taxa_3_4,
        taxa_cavalo_6x2: item.taxa_cavalo_6x2,
      });
    } else if (activeTab === 'taxas' && subAbaAtiva === 'impostos') {
      setFormData({
        ...formData,
        imposto_nome: item.nome ?? '',
        imposto_aliquota: item.aliquota ?? '',
      });
    } else if (activeTab === 'taxas' && subAbaAtiva === 'seguro') {
      if (seguroSubTab === 'carga') {
        setFormData({
          ...formData,
          seguro_tipo: item.tipo ?? '',
          seguro_taxa: item.taxa ?? '',
        });
      } else {
        setFormData({
          ...formData,
          gris_categoria: item.categoria ?? 'GERAL',
          gris_descricao: item.descricao ?? '',
          gris_valor: item.valor ?? '',
        });
      }
    } else if (activeTab === 'taxas' && subAbaAtiva === 'custos') {
      setFormData({
        ...formData,
        despesa_nome: item.nome ?? '',
        despesa_valor: item.valor ?? '',
        despesa_unidade: item.unidade ?? 'PERCENTUAL',
      });
    } else if (activeTab === 'taxas' && subAbaAtiva === 'markup') {
      setFormData({
        ...formData,
        markup_nome_cliente: item.nome_cliente ?? '',
        markup_faixa: item.faixa ?? '',
        markup_percentual_base: item.percentual_base ?? '',
        markup_percentual_markup: item.percentual_markup ?? '',
      });
    } else if (activeTab === 'icms') {
      setFormData({ ...formData, origem: item.origem, destino: item.destino, aliquota: item.aliquota });
    } else if (activeTab === 'veiculos') {
      // MAPEAMENTO CORRETO DOS CAMPOS PARA O FORM
      setFormData({ 
        ...formData, 
        tipo: item.tipo_veiculo || item.tipo_semireboque, 
        eixos: item.eixos_veiculo || item.eixos_semireboque 
      });
    } else {
      setFormData({ ...formData, descricao: item.descricao, valor: item.valor, unidade: item.unidade });
    }
    setIsModalOpen(true);
  };




  const fecharModal = () => {
    setIsModalOpen(false);
    setEditandoItem(null);
    setFormData(initialFormData);
  };



  // PARTE ONDE COMEÇA AS FUNÇÕES DAS <TAXAS>

  const formatarMoedaInput = (valor) => {
    // Remove tudo que não é dígito
    let v = valor.replace(/\D/g, '');
    // Divide por 100 para ter as casas decimais e formata como moeda brasileira
    v = (Number(v) / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    return v;
  };

  const formatarPercentualInput = (valor) => {
    if (!valor) return '';
    // Remove tudo que não é número ou ponto/vírgula
    const n = valor.toString().replace(',', '.');
    return `${n}%`;
  };

  const carregarImpostos = () => {
    fetch(`${API_BASE}/impostos/`)
      .then(res => res.json())
      .then(data => setListaImpostos(data));
  };
  
  const carregarSeguros = () => {
    fetch(`${API_BASE}/seguros/`) // CustoSeguroCarga
      .then(res => res.json())
      .then(data => setListaSeguros(data));
  };
  
  const carregarGris = () => {
    fetch(`${API_BASE}/gris/`) // CustoGris
      .then(res => res.json())
      .then(data => setListaGris(data));
  };
  
  const carregarDespesas = () => {
    fetch(`${API_BASE}/despesas-operacionais/`) // CustoDespesaOperacional
      .then(res => res.json())
      .then(data => setListaDespesas(data));
  };
  
  const carregarTabelaPreco = () => {
    fetch(`${API_BASE}/cliente-taxas-config/`) // ClienteTaxasConfig
      .then(res => res.json())
      .then(data => setListaTabelas(data));
  };

  const salvarTabelaPreco = async (formData) => {
    const url = `${API_BASE}/cliente-taxas-config/` + (editandoItem ? `${editandoItem.id}/` : '');
  
    // Função de Normalização: Garante que o valor seja um número float
    const normalizar = (valor) => {
      if (valor === undefined || valor === null || valor === '') return 0;
      // Se vier como string do input (ex: "100.50"), garante a conversão
      const n = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : valor;
      return isNaN(n) ? 0 : n;
    };
  
    const body = {
      nome_cliente: formData.nome_cliente,
      seguro_taxa_1: normalizar(formData.seguro_taxa_1),
      seguro_taxa_2: normalizar(formData.seguro_taxa_2),
      valor_mercadoria_limite: normalizar(formData.valor_mercadoria_limite),
      valor_ajudante: normalizar(formData.valor_ajudante),
      taxa_utilitarios: normalizar(formData.taxa_utilitarios),
      taxa_cavalo_4x2: normalizar(formData.taxa_cavalo_4x2),
      taxa_truck: normalizar(formData.taxa_truck),
      taxa_toco: normalizar(formData.taxa_toco),
      taxa_3_4: normalizar(formData.taxa_3_4),
      taxa_cavalo_6x2: normalizar(formData.taxa_cavalo_6x2),
    };
  
    // PRINTS PARA DEBUG NO TERMINAL DO NAVEGADOR (F12)
    console.log(">>> [DEBUG] Payload enviado ao Django:", body);
  
    try {
      const res = await fetch(url, {
        method: editandoItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
  
      const respostaServidor = await res.json();
  
      if (res.ok) {
        console.log(">>> [SUCESSO] Resposta:", respostaServidor);
        carregarTabelaPreco();
        fecharModal();
      } else {
        console.error(">>> [ERRO DJANGO] Detalhes:", respostaServidor);
        alert("Erro ao salvar. Verifique o console do navegador.");
      }
    } catch (err) {
      console.error(">>> [ERRO REDE]:", err);
    }
  };







  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Painel de Configurações Operacionais</h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button onClick={() => setActiveTab('icms')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition ${activeTab === 'icms' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
            <MapIcon size={18} /> Matriz ICMS
          </button>
          <button onClick={() => setActiveTab('veiculos')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition ${activeTab === 'veiculos' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Truck size={18} /> Veículos e Semirreboques
          </button>
          <button onClick={() => setActiveTab('taxas')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition ${activeTab === 'taxas' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
            <DollarSign size={18} /> Impostos e Taxas
          </button>
        </div>

        <div className="p-6">
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
              <button
                onClick={() => {
                  setEditandoItem(null);
                  setFormData(initialFormData);
                  setIsModalOpen(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 font-bold"
              >
                <Plus size={16} /> Novo
              </button>
            </div>
          </div>

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


            {/* parte de configuração das taxas */}
            {activeTab === 'taxas' && (
              <div className="space-y-6">
                {/* Sub-abas de navegação */}
                <div className="flex gap-6 border-b pb-2">
                  {['impostos', 'seguro', 'custos', 'markup', 'tabela'].map(tab => (
                    <button 
                      key={tab} 
                      onClick={() => setSubAbaAtiva(tab)} 
                      className={`text-xs font-black uppercase pb-2 transition-all ${subAbaAtiva === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                    >
                      {tab === 'tabela' ? 'Tabela Preço' : tab}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                  {/* ÁREA DE CONTEÚDO DINÂMICO */}
                  <div className="flex-1">
                    {subAbaAtiva === 'tabela' ? (
                      /* --- VISUALIZAÇÃO EM TABELA (LISTA COMPLETA) --- */
                      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="border-b border-r" colSpan="4"></th> {/* Espaço vazio para Cliente, Seguros e Ajudante */}
                              <th className="border-b-50/5 text-emerald-500 py-1 text-center font-bold" colSpan="6">
                                Taxas de Entrega
                              </th>
                              <th className="border-b" colSpan="2"></th> {/* Espaço vazio para Limite e Ações */}
                            </tr>
                              <tr className="text-slate-600 font-black uppercase">
                                <th className="px-4 py-3 border-r">Cliente</th>
                                <th className="px-3 py-3 text-center border-r">Seguro Tx-1</th>
                                <th className="px-3 py-3 text-center border-r">Seguro Tx-2</th>
                                <th className="px-3 py-3 text-center border-r bg-blue-50/30">Ajudante</th>
                                <th className="px-3 py-3 text-center border-r">Utilitários</th>
                                <th className="px-3 py-3 text-center border-r">3/4</th>
                                <th className="px-3 py-3 text-center border-r">Toco</th>
                                <th className="px-3 py-3 text-center border-r">Truck</th>
                                <th className="px-3 py-3 text-center border-r">Cavalo 4x2</th>
                                <th className="px-3 py-3 text-center border-r">Cavalo 6x2</th>
                                <th className="px-3 py-3 text-center bg-orange-50/30">Limite Mercadoria</th>
                                <th className="px-3 py-3 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {dadosFiltrados.map((item) => (
                                <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                  <td className="px-4 py-3 font-bold text-slate-700 border-r uppercase">
                                    {item.nome_cliente || 'Cliente'}
                                  </td>
                                  <td className="px-3 py-3 text-center border-r font-mono text-blue-700 font-bold">
                                    {Number(item.seguro_taxa_1).toFixed(2).replace('.', ',')}%
                                  </td>
                                  <td className="px-3 py-3 text-center border-r font-mono text-blue-700 font-bold">
                                    {Number(item.seguro_taxa_2).toFixed(2).replace('.', ',')}%
                                  </td>
                                  <td className="px-3 py-3 text-center border-r font-mono text-blue-700 font-bold">
                                    R$ {item.valor_ajudante}
                                  </td>
                                  
                                  <td className="px-3 py-3 text-center border-r font-mono text-slate-600">
                                    R$ {item.taxa_utilitarios}
                                  </td>
                                  <td className="px-3 py-3 text-center border-r font-mono text-slate-600">
                                    R$ {item.taxa_3_4}
                                  </td>
                                  <td className="px-3 py-3 text-center border-r font-mono text-slate-600">
                                    R$ {item.taxa_toco}
                                  </td>
                                  <td className="px-3 py-3 text-center border-r font-mono text-slate-600">
                                    R$ {item.taxa_truck}
                                  </td>
                                  
                                  <td className="px-3 py-3 text-center border-r font-mono text-slate-600">
                                    R$ {item.taxa_cavalo_4x2}
                                  </td>
                                  <td className="px-3 py-3 text-center border-r font-mono text-slate-600">
                                    R$ {item.taxa_cavalo_6x2}
                                  </td>
                                  <td className="px-3 py-3 text-center font-bold text-orange-700 bg-orange-50/20">
                                    {Number(item.valor_mercadoria_limite).toLocaleString('pt-BR', { 
                                      style: 'currency', 
                                      currency: 'BRL' 
                                    })}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <div className="flex justify-center gap-2">
                                      <button onClick={() => abrirEdicao(item)} className="text-blue-500 hover:text-blue-700"><Settings2 size={14}/></button>
                                      <button onClick={() => handleExcluir(item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : subAbaAtiva === 'impostos' ? (
                      /* --- VISUALIZAÇÃO EM TABELA (LINHAS) --- */
                      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr className="text-slate-600 font-black uppercase">
                                <th className="px-4 py-3 border-r">Imposto</th>
                                <th className="px-4 py-3 border-r text-center whitespace-nowrap">Alíquota</th>
                                <th className="px-4 py-3 text-center whitespace-nowrap">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {impostosOrdenados.map((nome) => {
                                const imposto = impostosPorNome.get(nome);
                                const valor = Number(imposto?.aliquota);

                                return (
                                  <tr key={nome} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="px-4 py-3 font-bold text-slate-700 border-r uppercase whitespace-nowrap">
                                      {nome}
                                    </td>
                                    <td className="px-4 py-3 border-r text-center">
                                      <span className="font-mono text-blue-700 font-black">
                                        {imposto && Number.isFinite(valor) ? `${valor.toFixed(2).replace('.', ',')}%` : '-'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {imposto ? (
                                        <div className="flex justify-center gap-2">
                                          <button
                                            onClick={() => abrirEdicao(imposto)}
                                            className="text-blue-500 hover:text-blue-700"
                                            title="Editar"
                                          >
                                            <Settings2 size={14} />
                                          </button>
                                          <button
                                            onClick={() => handleExcluir(imposto.id)}
                                            className="text-red-500 hover:text-red-700"
                                            title="Excluir"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 font-bold">-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : subAbaAtiva === 'seguro' ? (
                      <div className="space-y-4">
                        <div className="flex gap-4 border-b pb-2">
                          <button
                            onClick={() => setSeguroSubTab('carga')}
                            className={`pb-2 px-2 text-sm font-bold transition-all ${seguroSubTab === 'carga' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                          >
                            Seguro Carga
                          </button>
                          <button
                            onClick={() => setSeguroSubTab('gris')}
                            className={`pb-2 px-2 text-sm font-bold transition-all ${seguroSubTab === 'gris' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                          >
                            GRIS
                          </button>
                        </div>

                        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-[11px] border-collapse">
                              <thead className="bg-slate-50 border-b border-slate-200">
                                {seguroSubTab === 'carga' ? (
                                  <tr className="text-slate-600 font-black uppercase">
                                    <th className="px-4 py-3 border-r">Tipo</th>
                                    <th className="px-4 py-3 border-r text-center whitespace-nowrap">Taxa</th>
                                    <th className="px-4 py-3 text-center whitespace-nowrap">Ações</th>
                                  </tr>
                                ) : (
                                  <tr className="text-slate-600 font-black uppercase">
                                    <th className="px-4 py-3 border-r">Categoria</th>
                                    <th className="px-4 py-3 border-r">Descrição</th>
                                    <th className="px-4 py-3 border-r text-center whitespace-nowrap">Valor</th>
                                    <th className="px-4 py-3 text-center whitespace-nowrap">Ações</th>
                                  </tr>
                                )}
                              </thead>

                              <tbody className="divide-y divide-slate-100">
                                {seguroSubTab === 'carga'
                                  ? dadosFiltrados.map((item) => {
                                      const taxa = Number(item?.taxa);
                                      return (
                                        <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                          <td className="px-4 py-3 font-bold text-slate-700 border-r uppercase whitespace-nowrap">
                                            {item.tipo}
                                          </td>
                                          <td className="px-4 py-3 border-r text-center">
                                            <span className="font-mono text-blue-700 font-black">
                                              {Number.isFinite(taxa) ? `${taxa.toFixed(5).replace('.', ',')}%` : '-'}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-2">
                                              <button onClick={() => abrirEdicao(item)} className="text-blue-500 hover:text-blue-700" title="Editar">
                                                <Settings2 size={14} />
                                              </button>
                                              <button onClick={() => handleExcluir(item.id)} className="text-red-500 hover:text-red-700" title="Excluir">
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  : dadosFiltrados.map((item) => {
                                      const valor = Number(item?.valor);
                                      return (
                                        <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                          <td className="px-4 py-3 font-bold text-slate-700 border-r uppercase whitespace-nowrap">
                                            {item.categoria === 'VEICULO' ? 'VEICULO/CARRETA' : item.categoria}
                                          </td>
                                          <td className="px-4 py-3 border-r font-bold text-slate-700 whitespace-nowrap">
                                            {item.descricao}
                                          </td>
                                          <td className="px-4 py-3 border-r text-center">
                                            <span className="font-mono text-emerald-700 font-black">
                                              {Number.isFinite(valor)
                                                ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                : '-'}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-2">
                                              <button onClick={() => abrirEdicao(item)} className="text-blue-500 hover:text-blue-700" title="Editar">
                                                <Settings2 size={14} />
                                              </button>
                                              <button onClick={() => handleExcluir(item.id)} className="text-red-500 hover:text-red-700" title="Excluir">
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ) : subAbaAtiva === 'custos' ? (
                      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr className="text-slate-600 font-black uppercase">
                                <th className="px-4 py-3 border-r">Nome</th>
                                <th className="px-4 py-3 border-r text-center whitespace-nowrap">Valor</th>
                                <th className="px-4 py-3 border-r text-center whitespace-nowrap">Unidade</th>
                                <th className="px-4 py-3 text-center whitespace-nowrap">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {dadosFiltrados.map((item) => {
                                const valor = Number(item?.valor);
                                const isPercent = item?.unidade === 'PERCENTUAL';
                                return (
                                  <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="px-4 py-3 font-bold text-slate-700 border-r uppercase whitespace-nowrap">
                                      {item.nome}
                                    </td>
                                    <td className="px-4 py-3 border-r text-center">
                                      <span className={`font-mono font-black ${isPercent ? 'text-blue-700' : 'text-emerald-700'}`}>
                                        {Number.isFinite(valor)
                                          ? isPercent
                                            ? `${valor.toFixed(2).replace('.', ',')}%`
                                            : valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                          : '-'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 border-r text-center font-bold text-slate-500">
                                      {isPercent ? '%' : 'R$'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex justify-center gap-2">
                                        <button onClick={() => abrirEdicao(item)} className="text-blue-500 hover:text-blue-700" title="Editar">
                                          <Settings2 size={14} />
                                        </button>
                                        <button onClick={() => handleExcluir(item.id)} className="text-red-500 hover:text-red-700" title="Excluir">
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : subAbaAtiva === 'markup' ? (
                      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr className="text-slate-600 font-black uppercase">
                                <th className="px-4 py-3 border-r whitespace-nowrap">Faixa</th>
                                {markupClientes.map((cliente) => (
                                  <th key={cliente} className="px-4 py-3 border-r text-center whitespace-nowrap" colSpan={2}>
                                    {cliente}
                                  </th>
                                ))}
                              </tr>
                              <tr className="text-slate-500 font-black uppercase text-[10px]">
                                <th className="px-4 py-2 border-r"></th>
                                {markupClientes.map((cliente) => (
                                  <Fragment key={`${cliente}-cols`}>
                                    <th className="px-2 py-2 border-r text-center whitespace-nowrap bg-blue-50/40">
                                      Base (%)
                                    </th>
                                    <th className="px-2 py-2 border-r text-center whitespace-nowrap bg-amber-50/40">
                                      Markup (%)
                                    </th>
                                  </Fragment>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {markupFaixas.map((faixa) => (
                                <tr key={faixa} className="hover:bg-blue-50/30 transition-colors">
                                  <td className="px-4 py-3 font-black text-slate-700 border-r text-center">
                                    {faixa}
                                  </td>
                                  {markupClientes.map((cliente) => {
                                    const item = markupMap.get(`${cliente}||${faixa}`);
                                    const base = Number(item?.percentual_base);
                                    const mk = Number(item?.percentual_markup);

                                    return (
                                      <td key={`${cliente}-${faixa}`} className="px-3 py-2 border-r text-center" colSpan={2}>
                                        {item ? (
                                          <div className="flex items-center justify-center gap-2 group">
                                            <button
                                              onClick={() => abrirEdicao(item)}
                                              className="flex-1 py-2 rounded-lg hover:bg-blue-100/60 transition-colors font-mono font-black text-blue-700"
                                              title="Editar"
                                            >
                                              <div className="flex items-center justify-center gap-4">
                                                <span className="px-2 py-1 rounded bg-blue-50/60 text-blue-700">
                                                  {Number.isFinite(base) ? `${base.toFixed(2).replace('.', ',')}%` : '-'}
                                                </span>
                                                <span className="px-2 py-1 rounded bg-amber-50/60 text-amber-800">
                                                  {Number.isFinite(mk) ? `${mk.toFixed(2).replace('.', ',')}%` : '-'}
                                                </span>
                                              </div>
                                            </button>
                                            <button
                                              onClick={() => handleExcluir(item.id)}
                                              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
                                              title="Excluir"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => {
                                              setEditandoItem(null);
                                              setFormData({
                                                ...initialFormData,
                                                markup_nome_cliente: cliente,
                                                markup_faixa: faixa,
                                                markup_percentual_base: '',
                                                markup_percentual_markup: '',
                                              });
                                              setIsModalOpen(true);
                                            }}
                                            className="w-full py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 font-black"
                                            title="Cadastrar"
                                          >
                                            -
                                          </button>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}

                              {markupFaixas.length === 0 && (
                                <tr>
                                  <td className="px-4 py-6 text-center text-slate-400 font-bold" colSpan={1 + markupClientes.length * 2}>
                                    Nenhum markup cadastrado ainda. Clique em “Novo” para começar.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      /* --- VISUALIZAÇÃO EM CARDS (OUTRAS ABAS) --- */
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {dadosFiltrados.map(item => (
                          <div key={item.id} className="p-4 border rounded-xl bg-white group hover:border-blue-300 transition-all shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">
                                {item.categoria || subAbaAtiva}
                              </span>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => abrirEdicao(item)} className="text-blue-500 hover:text-blue-700"><Settings2 size={16}/></button>
                                <button onClick={() => handleExcluir(item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                              </div>
                            </div>
                            <p className="font-bold text-slate-700">{item.descricao || item.nome || item.tipo}</p>
                            <p className="text-2xl font-black text-blue-700 mt-4">
                              {item.unidade === 'MOEDA' || item.unidade === 'R$' 
                                ? `R$ ${item.valor || item.taxa || item.aliquota}` 
                                : `${item.valor || item.taxa || item.aliquota}${item.unidade || '%'}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* MODAL GLOBAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className={`bg-white p-6 rounded-xl shadow-xl w-full ${subAbaAtiva === 'tabela' ? 'max-w-2xl' : 'max-w-md'} transition-all`}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
              {editandoItem ? 'Editar' : 'Novo'} {subAbaAtiva === 'tabela' ? 'Configuração de Cliente' : 'Registro'}
            </h3>

            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scroll">
              {activeTab === 'icms' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400">Origem (UF)</label>
                      <input className="w-full border rounded p-2 outline-none uppercase focus:border-blue-500" value={formData.origem} onChange={e => setFormData({...formData, origem: e.target.value.toUpperCase()})} maxLength={2} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400">Destino (UF)</label>
                      <input className="w-full border rounded p-2 outline-none uppercase focus:border-blue-500" value={formData.destino} onChange={e => setFormData({...formData, destino: e.target.value.toUpperCase()})} maxLength={2} />
                    </div>
                  </div>
                  <input type="number" placeholder="Alíquota %" className="w-full border rounded p-2 outline-none focus:border-blue-500" value={formData.aliquota} onChange={e => setFormData({...formData, aliquota: e.target.value})} />
                </>
              ) : activeTab === 'veiculos' ? (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Descrição</label>
                    <input className="w-full border rounded p-2 outline-none focus:border-blue-500" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Eixos</label>
                    <input type="number" className="w-full border rounded p-2 outline-none focus:border-blue-500" value={formData.eixos} onChange={e => setFormData({...formData, eixos: e.target.value})} />
                  </div>
                </>
              ) : activeTab === 'taxas' && subAbaAtiva === 'tabela' ? (
                /* FORMULÁRIO ESPECÍFICO PARA ClienteTaxasConfig */
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Nome do Cliente</label>
                    <input className="w-full border rounded p-2 outline-none focus:border-blue-500 font-bold" placeholder="Ex: AMBEV, COCA-COLA..." value={formData.nome_cliente} onChange={e => setFormData({...formData, nome_cliente: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* SEÇÃO SEGURO */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-black uppercase text-blue-600 mb-3">Seguros e Limites</p>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Taxa 1 (%)</label>
                            {/* <input type="number" step="0.01" className="w-full border rounded p-2 text-sm" value={formData.seguro_taxa_1} onChange={e => setFormData({...formData, seguro_taxa_1: e.target.value})} />
                           */}
                            <div className="relative">
                              <input type="text" className="w-full border rounded p-2 text-sm pr-8" placeholder="0,00" value={formData.seguro_taxa_1}
                                onChange={e => {let v = e.target.value.replace(',', '.');if (isNaN(v) && v !== '') return;setFormData({...formData, seguro_taxa_1: v});}} />
                              <span className="absolute right-3 top-2 text-slate-400 pointer-events-none">%</span>
                            </div>
                          </div>



                          
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Taxa 2 (%)</label>
                            {/* <input type="number" step="0.01" className="w-full border rounded p-2 text-sm" value={formData.seguro_taxa_2} onChange={e => setFormData({...formData, seguro_taxa_2: e.target.value})} /> */}
                            <div className="relative">
                              <input type="text" className="w-full border rounded p-2 text-sm pr-8" placeholder="0,00" value={formData.seguro_taxa_1}
                                onChange={e => {let v = e.target.value.replace(',', '.'); if (isNaN(v) && v !== '') return; setFormData({...formData, seguro_taxa_1: v}); }}/>
                              <span className="absolute right-3 top-2 text-slate-400 pointer-events-none">%</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Limite de Mercadoria (R$)</label>
                          {/* <input type="number" step="00.01" className="w-full border rounded p-2 text-sm font-bold text-green-700" value={formData.valor_mercadoria_limite} onChange={e => setFormData({...formData, valor_mercadoria_limite: e.target.value})} /> */}
                          <input 
                            type="text" 
                            className="w-full border rounded p-2 text-sm font-bold text-green-700 outline-none focus:border-blue-500" 
                            placeholder="R$ 0,00"
                            // Exibe o valor formatado se houver valor, senão vazio
                            value={formData.valor_mercadoria_limite ? formatarMoedaInput(formData.valor_mercadoria_limite.toString()) : ''} 
                            onChange={e => {
                              // Pega apenas os números para salvar no estado (ex: "150050" para R$ 1.500,50)
                              const apenasNumeros = e.target.value.replace(/\D/g, '');
                              // Salva como número decimal (ex: 1500.50) para o banco de dados aceitar
                              const valorDecimal = Number(apenasNumeros) / 100;
                              setFormData({...formData, valor_mercadoria_limite: valorDecimal});
                            }} 
                          />                        
                        </div>
                      </div>
                    </div>

                    {/* SEÇÃO TAXAS OPERACIONAIS */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-black uppercase text-blue-600 mb-3">Custos Operacionais (R$)</p>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Ajudante</label>
                            <input type="number" className="w-full border rounded p-2 text-sm" value={formData.valor_ajudante} onChange={e => setFormData({...formData, valor_ajudante: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Utilitários</label>
                            <input type="number" className="w-full border rounded p-2 text-sm" value={formData.taxa_utilitarios} onChange={e => setFormData({...formData, taxa_utilitarios: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Truck</label>
                            <input type="number" className="w-full border rounded p-2 text-sm" value={formData.taxa_truck} onChange={e => setFormData({...formData, taxa_truck: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Toco</label>
                            <input type="number" className="w-full border rounded p-2 text-sm" value={formData.taxa_toco} onChange={e => setFormData({...formData, taxa_toco: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">3/4</label>
                            <input type="number" className="w-full border rounded p-2 text-sm" value={formData.taxa_3_4} onChange={e => setFormData({...formData, taxa_3_4: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Cavalo 4x2</label>
                            <input type="number" className="w-full border rounded p-2 text-sm" value={formData.taxa_cavalo_4x2} onChange={e => setFormData({...formData, taxa_cavalo_4x2: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Cavalo 6x2</label>
                            <input type="number" className="w-full border rounded p-2 text-sm" value={formData.taxa_cavalo_6x2} onChange={e => setFormData({...formData, taxa_cavalo_6x2: e.target.value})} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'taxas' && subAbaAtiva === 'impostos' ? (
                /* FORMULÁRIO ESPECÍFICO PARA Imposto */
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Nome do Imposto</label>
                    <input
                      className="w-full border rounded p-2 outline-none focus:border-blue-500 font-bold uppercase"
                      placeholder="Ex: PIS/COFINS"
                      value={formData.imposto_nome}
                      onChange={e => setFormData({ ...formData, imposto_nome: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Alíquota (%)</label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full border rounded p-2 text-sm pr-8 outline-none focus:border-blue-500 font-bold"
                        placeholder="0,00"
                        value={(formData.imposto_aliquota ?? '').toString().replace('.', ',')}
                        onChange={e => {
                          let v = e.target.value.replace(',', '.');
                          if (v === '') {
                            setFormData({ ...formData, imposto_aliquota: '' });
                            return;
                          }
                          if (/^\d*\.?\d*$/.test(v)) {
                            setFormData({ ...formData, imposto_aliquota: v });
                          }
                        }}
                      />
                      <span className="absolute right-3 top-2 text-slate-400 pointer-events-none">%</span>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'taxas' && subAbaAtiva === 'seguro' ? (
                /* FORMULÁRIO ESPECÍFICO PARA Seguro (CustoSeguroCarga / CustoGris) */
                <div className="space-y-4">
                  <div className="flex gap-3 border-b pb-2">
                    <button
                      type="button"
                      onClick={() => setSeguroSubTab('carga')}
                      className={`pb-2 px-2 text-sm font-bold transition-all ${seguroSubTab === 'carga' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                    >
                      Seguro Carga
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeguroSubTab('gris')}
                      className={`pb-2 px-2 text-sm font-bold transition-all ${seguroSubTab === 'gris' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                    >
                      GRIS
                    </button>
                  </div>

                  {seguroSubTab === 'carga' ? (
                    <>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Tipo</label>
                        <input
                          className="w-full border rounded p-2 outline-none focus:border-blue-500 font-bold uppercase"
                          placeholder="Ex: RCTR-C"
                          value={formData.seguro_tipo}
                          onChange={e => setFormData({ ...formData, seguro_tipo: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Taxa (%)</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full border rounded p-2 text-sm pr-8 outline-none focus:border-blue-500 font-bold"
                            placeholder="0,00000"
                            value={(formData.seguro_taxa ?? '').toString().replace('.', ',')}
                            onChange={e => {
                              let v = e.target.value.replace(',', '.');
                              if (v === '') {
                                setFormData({ ...formData, seguro_taxa: '' });
                                return;
                              }
                              if (/^\d*\.?\d*$/.test(v)) {
                                setFormData({ ...formData, seguro_taxa: v });
                              }
                            }}
                          />
                          <span className="absolute right-3 top-2 text-slate-400 pointer-events-none">%</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Categoria</label>
                        <select
                          className="w-full border rounded p-2 outline-none focus:border-blue-500 font-bold"
                          value={formData.gris_categoria}
                          onChange={e => setFormData({ ...formData, gris_categoria: e.target.value })}
                        >
                          <option value="MOTORISTA">MOTORISTA</option>
                          <option value="VEICULO">VEICULO/CARRETA</option>
                          <option value="CONJUNTO">CONJUNTO</option>
                          <option value="GERAL">GERAL</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Descrição</label>
                        <input
                          className="w-full border rounded p-2 outline-none focus:border-blue-500 font-bold"
                          placeholder="Ex: Pesquisa Expressa"
                          value={formData.gris_descricao}
                          onChange={e => setFormData({ ...formData, gris_descricao: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Valor (R$)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-slate-400 pointer-events-none font-bold">R$</span>
                          <input
                            type="text"
                            className="w-full border rounded p-2 text-sm pl-10 outline-none focus:border-blue-500 font-bold text-emerald-700"
                            placeholder="0,00"
                            value={(formData.gris_valor ?? '').toString().replace('.', ',')}
                            onChange={e => {
                              const raw = e.target.value;
                              // Aceita números com vírgula (pt-BR) enquanto digita
                              if (raw === '') {
                                setFormData({ ...formData, gris_valor: '' });
                                return;
                              }
                              if (/^\d*([.,]\d*)?$/.test(raw)) {
                                setFormData({ ...formData, gris_valor: raw.replace(',', '.') });
                              }
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : activeTab === 'taxas' && subAbaAtiva === 'custos' ? (
                /* FORMULÁRIO ESPECÍFICO PARA CustoDespesaOperacional */
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Nome</label>
                    <input
                      className="w-full border rounded p-2 outline-none focus:border-blue-500 font-bold uppercase"
                      placeholder="Ex: CGO, DESP.ADM, FINANCEIRO..."
                      value={formData.despesa_nome}
                      onChange={e => setFormData({ ...formData, despesa_nome: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Unidade</label>
                    <select
                      className="w-full border rounded p-2 outline-none focus:border-blue-500 font-bold"
                      value={formData.despesa_unidade}
                      onChange={e => setFormData({ ...formData, despesa_unidade: e.target.value })}
                    >
                      <option value="PERCENTUAL">Percentual (%)</option>
                      <option value="MOEDA">Valor (R$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Valor</label>
                    {formData.despesa_unidade === 'PERCENTUAL' ? (
                      <div className="relative">
                        <input
                          type="text"
                          className="w-full border rounded p-2 text-sm pr-8 outline-none focus:border-blue-500 font-bold"
                          placeholder="0,00"
                          value={(formData.despesa_valor ?? '').toString().replace('.', ',')}
                          onChange={e => {
                            let v = e.target.value.replace(',', '.');
                            if (v === '') {
                              setFormData({ ...formData, despesa_valor: '' });
                              return;
                            }
                            if (/^\d*\.?\d*$/.test(v)) {
                              setFormData({ ...formData, despesa_valor: v });
                            }
                          }}
                        />
                        <span className="absolute right-3 top-2 text-slate-400 pointer-events-none">%</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400 pointer-events-none font-bold">R$</span>
                        <input
                          type="text"
                          className="w-full border rounded p-2 text-sm pl-10 outline-none focus:border-blue-500 font-bold text-emerald-700"
                          placeholder="0,00"
                          value={(formData.despesa_valor ?? '').toString().replace('.', ',')}
                          onChange={e => {
                            const raw = e.target.value;
                            if (raw === '') {
                              setFormData({ ...formData, despesa_valor: '' });
                              return;
                            }
                            if (/^\d*([.,]\d*)?$/.test(raw)) {
                              setFormData({ ...formData, despesa_valor: raw.replace(',', '.') });
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === 'taxas' && subAbaAtiva === 'markup' ? (
                /* FORMULÁRIO ESPECÍFICO PARA MarkupClienteFaixa */
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Cliente</label>
                    <input
                      className="w-full border rounded p-2 outline-none focus:border-blue-500 font-bold uppercase"
                      placeholder="Ex: DIVERSOS"
                      value={formData.markup_nome_cliente}
                      onChange={e => setFormData({ ...formData, markup_nome_cliente: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400">Faixa</label>
                      <input
                        type="number"
                        className="w-full border rounded p-2 outline-none focus:border-blue-500 font-bold"
                        placeholder="1"
                        value={formData.markup_faixa}
                        onChange={e => setFormData({ ...formData, markup_faixa: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400">Base (%)</label>
                      <div className="relative">
                        <input
                          type="text"
                          className="w-full border rounded p-2 text-sm pr-8 outline-none focus:border-blue-500 font-bold"
                          placeholder="0,00"
                          value={(formData.markup_percentual_base ?? '').toString().replace('.', ',')}
                          onChange={e => {
                            let v = e.target.value.replace(',', '.');
                            if (v === '') {
                              setFormData({ ...formData, markup_percentual_base: '' });
                              return;
                            }
                            if (/^\d*\.?\d*$/.test(v)) {
                              setFormData({ ...formData, markup_percentual_base: v });
                            }
                          }}
                        />
                        <span className="absolute right-3 top-2 text-slate-400 pointer-events-none">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400">Markup (%)</label>
                      <div className="relative">
                        <input
                          type="text"
                          className="w-full border rounded p-2 text-sm pr-8 outline-none focus:border-blue-500 font-bold"
                          placeholder="0,00"
                          value={(formData.markup_percentual_markup ?? '').toString().replace('.', ',')}
                          onChange={e => {
                            let v = e.target.value.replace(',', '.');
                            if (v === '') {
                              setFormData({ ...formData, markup_percentual_markup: '' });
                              return;
                            }
                            if (/^\d*\.?\d*$/.test(v)) {
                              setFormData({ ...formData, markup_percentual_markup: v });
                            }
                          }}
                        />
                        <span className="absolute right-3 top-2 text-slate-400 pointer-events-none">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* FORMULÁRIO PADRÃO (Impostos, Custos, etc) */
                <>
                  <input placeholder="Descrição" className="w-full border rounded p-2 outline-none focus:border-blue-500" value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Valor" className="w-full border rounded p-2 outline-none focus:border-blue-500" value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} />
                    <select className="border rounded p-2 outline-none focus:border-blue-500" value={formData.unidade} onChange={e => setFormData({...formData, unidade: e.target.value})}>
                      <option value="%">%</option>
                      <option value="R$">R$</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-between items-center gap-2 mt-8 pt-4 border-t">
              <div>
                {editandoItem && activeTab === 'taxas' && subAbaAtiva === 'markup' && (
                  <button
                    onClick={() => {
                      handleExcluir(editandoItem.id);
                      fecharModal();
                    }}
                    className="px-4 py-2 text-red-600 font-bold uppercase text-xs hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Excluir
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={fecharModal} className="px-4 py-2 text-slate-400 font-bold uppercase text-xs hover:bg-slate-50 rounded-lg transition-colors">Cancelar</button>
                <button onClick={handleSalvar} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md shadow-blue-200 transition-all uppercase text-xs">Confirmar e Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuracoes;