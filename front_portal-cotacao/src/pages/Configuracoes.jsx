import { useState, useEffect, useMemo, Fragment } from 'react';
import { Map as MapIcon, Building2, Truck, DollarSign, Plus, Search, ArrowUpDown, Trash2, Settings2, Users, FileText, Save } from 'lucide-react';
import { getApiBase, fetchJsonList, fetchJsonPost } from '../config/api';
import { buscarMunicipiosPorTermo } from '../lib/cidadesIbge';
import { buildPropostaHtml } from '../lib/propostaTemplateHtml';

/** Colunas de frete por faixa de km (Veículo — frota de tração). */
const VEICULO_COLUNAS_FRETE = [
  { key: 'frete_minimo_ate_50km', label: 'Frete mín. até 50 km', short: 'Mín.≤50' },
  { key: 'tarifa_0_50', label: '0–50 km', short: '0–50' },
  { key: 'tarifa_51_100', label: '51–100 km', short: '51–100' },
  { key: 'tarifa_101_150', label: '101–150 km', short: '101–150' },
  { key: 'tarifa_151_200', label: '151–200 km', short: '151–200' },
  { key: 'tarifa_201_300', label: '201–300 km', short: '201–300' },
  { key: 'tarifa_301_400', label: '301–400 km', short: '301–400' },
  { key: 'tarifa_401_500', label: '401–500 km', short: '401–500' },
  { key: 'tarifa_acima_500', label: 'Acima 500 km', short: '>500' },
];

const emptyVeiculoFreteForm = () =>
  VEICULO_COLUNAS_FRETE.reduce((acc, { key }) => {
    acc[key] = '';
    return acc;
  }, {});

const fmtBRLCell = (v) => {
  if (v === undefined || v === null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
};

const parseDecimalFrete = (v) => {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/\s/g, '').replace(/R\$\s?/gi, '');
  if (!s) return 0;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

const veiculoItemIntoForm = (item) => ({
  ...emptyVeiculoFreteForm(),
  ...Object.fromEntries(
    VEICULO_COLUNAS_FRETE.map(({ key }) => [
      key,
      item[key] != null && item[key] !== '' ? Number(item[key]) : '',
    ]),
  ),
  taxa_correcao:
    item.taxa_correcao != null && item.taxa_correcao !== '' ? Number(item.taxa_correcao) : '',
  ctrb_somar_taxa_correcao: !!item.ctrb_somar_taxa_correcao,
});

const veiculoPayloadFromForm = (fd) => {
  const o = {
    tipo_veiculo: fd.tipo,
    eixos_veiculo: parseInt(String(fd.eixos), 10) || 0,
    taxa_correcao: parseDecimalFrete(fd.taxa_correcao),
    ctrb_somar_taxa_correcao: !!fd.ctrb_somar_taxa_correcao,
  };
  for (const { key } of VEICULO_COLUNAS_FRETE) {
    o[key] = parseDecimalFrete(fd[key]);
  }
  return o;
};

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState('icms'); 
  const [activeSubTab, setActiveSubTab] = useState('veiculos'); 
  const [subAbaAtiva, setSubAbaAtiva] = useState('impostos');
  const [clienteMarkupAtivo, setClienteMarkupAtivo] = useState('DIVERSOS');

  // Estados de Dados
  const [listaIcms, setListaIcms] = useState([]);
  const [listaIss, setListaIss] = useState([]);
  const [listaVeiculos, setListaVeiculos] = useState([]);
  const [listaSemireboques, setListaSemireboques] = useState([]);
  const [listaTaxas, setListaTaxas] = useState([]);
  const[listaTabelas, setListaTabelas]= useState([]);
  const [listaImpostos, setListaImpostos] = useState([]);
  const [listaSeguros, setListaSeguros] = useState([]);
  const [listaGris, setListaGris] = useState([]);
  const [listaDespesas, setListaDespesas] = useState([]);
  const [listaMarkupConfig, setListaMarkupConfig] = useState([]);

  // Proposta Comercial (global)
  const baseApi = getApiBase();
  const [tplLoading, setTplLoading] = useState(false);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplErr, setTplErr] = useState('');
  const [tplMsg, setTplMsg] = useState('');
  const [tplPreviewOpen, setTplPreviewOpen] = useState(false);
  const [tplSubTab, setTplSubTab] = useState('template'); // 'template'(layout) | 'email'(envio)
  const [tpl, setTpl] = useState({
    empresa_nome: 'ESTRELA DO ORIENTE',
    titulo: 'PROPOSTA COMERCIAL',
    email_comercial: 'comercial@estrelaoriente.com.br',
    telefone_comercial: 'fone/whatsapp: 41 9973-1834',
    logo_data_url: '',
    condicoes_comerciais: '',
  });

  const propostaPreviewHtml = useMemo(() => {
    // Preview vazio (sem dados de cotação), apenas layout + textos do template
    return buildPropostaHtml({
      template: tpl,
      numeroCotacao: null,
      cliente_nome: '',
      cliente_cnpj: '',
      contato: '',
      email: '',
      origem: '',
      uf_origem: '',
      destino: '',
      uf_destino: '',
      tipoVeiculo: '',
      qtdAjudante: 0,
      taxaAdicionalEntrega: 0,
      valorMercadoria: 0,
      sIcms: { fretePeso: 0, seguro: 0, gris: 0, pedagio: 0, total: 0 },
      cIcms: { total: 0 },
      frete_all_in_sicms: 0,
      frete_all_in_cicms: 0,
    });
  }, [tpl]);

  // Config E-mail (SMTP) — usado no envio de proposta
  const [emailCfgLoading, setEmailCfgLoading] = useState(false);
  const [emailCfgSaving, setEmailCfgSaving] = useState(false);
  const [emailCfgErr, setEmailCfgErr] = useState('');
  const [emailCfgMsg, setEmailCfgMsg] = useState('');
  const [emailCfg, setEmailCfg] = useState({
    habilitado: false,
    modo_envio: 'AUTH',
    remetente_nome: '',
    remetente_email: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_usuario: '',
    smtp_senha: '',
    smtp_use_tls: true,
    relay_ip_publico: '',
    senha_configurada: false,
  });
  const [emailCfgShowSenha, setEmailCfgShowSenha] = useState(false);
  const [sugestoesIssCidade, setSugestoesIssCidade] = useState([]);

  // Base: Clientes e Solicitantes
  const [listaClientesBase, setListaClientesBase] = useState([]);
  const [listaSolicitantesBaseAll, setListaSolicitantesBaseAll] = useState([]);
  const [baseLoading, setBaseLoading] = useState(false);
  const [baseErro, setBaseErro] = useState('');
  const [clienteBaseEditId, setClienteBaseEditId] = useState(null);
  const [solicitanteBaseEditId, setSolicitanteBaseEditId] = useState(null);
  const [baseModalOpen, setBaseModalOpen] = useState(false);
  const [baseModalMode, setBaseModalMode] = useState('cliente'); // 'cliente' | 'solicitante'
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cnpjLookupErro, setCnpjLookupErro] = useState('');
  const [clienteBaseForm, setClienteBaseForm] = useState({
    nome_empresa: '',
    cnpj: '',
    endereco: '',
    cep: '',
    numero: '',
  });
  const [solicitanteBaseForm, setSolicitanteBaseForm] = useState({
    cliente: '',
    nome: '',
    email: '',
    telefone: '',
  });

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
    const nomes = (listaMarkupConfig || [])
      .filter((m) => (m?.tipo || 'FAIXA').toString().toUpperCase() === 'FAIXA')
      .map(m => m.nome_cliente)
      .filter(Boolean);
    return [...new Set(nomes)].sort((a, b) => a.localeCompare(b));
  }, [listaMarkupConfig]);

  const markupC26Rows = useMemo(() => {
    // Linhas fixas da planilha (C26): não permitir criar novas faixas via UI.
    return [20, 18, 15, 12, 10];
  }, [listaMarkupConfig]);

  const markupMap = useMemo(() => {
    const map = new Map();
    /** Prioriza linha “manual” (sem alíquota de rota); evita célula presa a 1 dos N ids da seed. */
    const pickRow = (prev, m) => {
      if (!prev) return m;
      const prevManual = prev.aliquota_bruta == null && prev.aliquota_reduzida == null;
      const mManual = m.aliquota_bruta == null && m.aliquota_reduzida == null;
      if (mManual && !prevManual) return m;
      if (prevManual && !mManual) return prev;
      return Number(prev.id) <= Number(m.id) ? prev : m;
    };
    for (const m of listaMarkupConfig || []) {
      const tipo = (m?.tipo || 'FAIXA').toString().toUpperCase();
      if (tipo !== 'FAIXA') continue;
      const cliente = (m?.nome_cliente || '').toString().trim().toUpperCase();
      const c26 = Number(m?.percentual_markup);
      if (!cliente || !Number.isFinite(c26)) continue;
      const key = `${cliente}||${c26.toFixed(2)}`;
      map.set(key, pickRow(map.get(key), m));
    }
    return map;
  }, [listaMarkupConfig]);

  const initialFormData = { 
    origem: '',
    destino: '',
    cidade: '',
    /** UF apenas para exibir "Cidade - UF" após escolha IBGE (Matriz ISS). */
    iss_uf: '',
    aliquota: '',
    tipo: '',
    eixos: '',
    descricao: '',
    valor: '',
    unidade: '%',
    nome_cliente: '',
    malha_spot_tipo: 'DIVERSOS',
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
    markup_percentual_base: '',
    markup_percentual_markup: '',
    ...emptyVeiculoFreteForm(),
    taxa_correcao: '',
    ctrb_somar_taxa_correcao: false,
  };

  // FormData unificado
  const [formData, setFormData] = useState(initialFormData);

  const API_BASE = getApiBase();

  const carregarTabelaPreco = async () => {
    const data = await fetchJsonList('/cliente-taxas-config/');
    setListaTabelas(data);
  };

  const carregarTudo = async () => {
    const [
      icms,
      iss,
      veiculos,
      semireboques,
      impostos,
      seguros,
      gris,
      despesas,
      markup,
      clientesBase,
      solicitantesBase,
    ] = await Promise.all([
      fetchJsonList('/icms/'),
      fetchJsonList('/matriz-iss/'),
      fetchJsonList('/veiculos/'),
      fetchJsonList('/semireboques/'),
      fetchJsonList('/impostos/'),
      fetchJsonList('/seguros/'),
      fetchJsonList('/gris/'),
      fetchJsonList('/despesas-operacionais/'),
      fetchJsonList('/markup-config/'),
      fetchJsonList('/clientes/'),
      fetchJsonList('/solicitantes/'),
    ]);
    setListaIcms(icms);
    setListaIss(iss);
    setListaVeiculos(veiculos);
    setListaSemireboques(semireboques);
    setListaTaxas([]);
    setListaImpostos(impostos);
    setListaSeguros(seguros);
    setListaGris(gris);
    setListaDespesas(despesas);
    setListaMarkupConfig(markup);
    setListaClientesBase(clientesBase);
    setListaSolicitantesBaseAll(solicitantesBase);
    await carregarTabelaPreco();
  };

  //---CARREGA OS DADOS NA TELA---
  useEffect(() => {
    carregarTudo();
  }, []);


  const dadosFiltrados = useMemo(() => {
    const termo = busca.trim().toUpperCase();
    let base = [];

    if (activeTab === 'icms') {
      base = listaIcms.filter(i => i.origem.includes(termo) || i.destino.includes(termo));
    } else if (activeTab === 'iss') {
      base = listaIss.filter(i => (i.cidade ?? '').toUpperCase().includes(termo));
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
    } else if (activeTab === 'base') {
      base = (listaClientesBase || []).filter((c) => {
        if (!termo) return true;
        return (
          (c?.nome_empresa || '').toUpperCase().includes(termo) ||
          (c?.cnpj || '').toUpperCase().includes(termo)
        );
      });
    }

    return base.sort((a, b) => {
        const valA = (a.nome_cliente || a.nome || a.tipo || a.cidade || a.origem || a.tipo_veiculo || a.tipo_semireboque || a.descricao || "").toString();
        const valB = (b.nome_cliente || b.nome || b.tipo || b.cidade || b.origem || b.tipo_veiculo || b.tipo_semireboque || b.descricao || "").toString();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [activeTab, activeSubTab, subAbaAtiva, clienteMarkupAtivo, seguroSubTab, listaIcms, listaIss, listaVeiculos, listaSemireboques, listaTaxas, listaTabelas, listaImpostos, listaSeguros, listaGris, listaDespesas, listaMarkupConfig, listaClientesBase, busca, sortOrder]);

  useEffect(() => {
    if (activeTab !== 'template') return;
    let cancel = false;
    (async () => {
      setTplLoading(true);
      setTplErr('');
      setTplMsg('');
      try {
        const res = await fetch(`${baseApi}/proposta-template/`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
        if (!cancel) setTpl((t) => ({ ...t, ...data }));
      } catch (e) {
        if (!cancel) setTplErr(e.message || String(e));
      } finally {
        if (!cancel) setTplLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [activeTab, baseApi]);

  useEffect(() => {
    if (activeTab !== 'template') return;
    let cancel = false;
    (async () => {
      setEmailCfgLoading(true);
      setEmailCfgErr('');
      setEmailCfgMsg('');
      try {
        const res = await fetch(`${baseApi}/email-config/`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
        if (!cancel) setEmailCfg((c) => ({ ...c, ...data, smtp_senha: '' }));
      } catch (e) {
        if (!cancel) setEmailCfgErr(e.message || String(e));
      } finally {
        if (!cancel) setEmailCfgLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [activeTab, baseApi]);

  const salvarEmailCfg = async () => {
    setEmailCfgSaving(true);
    setEmailCfgErr('');
    setEmailCfgMsg('');
    try {
      const payload = {
        habilitado: !!emailCfg.habilitado,
        modo_envio: emailCfg.modo_envio || 'AUTH',
        remetente_nome: emailCfg.remetente_nome,
        remetente_email: emailCfg.remetente_email,
        smtp_host: emailCfg.smtp_host,
        smtp_port: Number(emailCfg.smtp_port) || 587,
        smtp_usuario: emailCfg.smtp_usuario,
        smtp_use_tls: !!emailCfg.smtp_use_tls,
        relay_ip_publico: emailCfg.relay_ip_publico || '',
      };
      if (emailCfg.smtp_senha?.trim()) payload.smtp_senha = emailCfg.smtp_senha.trim();
      const res = await fetch(`${baseApi}/email-config/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
      setEmailCfg((c) => ({ ...c, ...data, smtp_senha: '' }));
      setEmailCfgMsg('Configuração de e-mail gravada.');
    } catch (e) {
      setEmailCfgErr(e.message || String(e));
    } finally {
      setEmailCfgSaving(false);
    }
  };

  const detectarIpPublicoEmail = async () => {
    setEmailCfgErr('');
    try {
      const res = await fetch(`${baseApi}/email/egress-ip/`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
      setEmailCfg((c) => ({ ...c, relay_ip_publico: data.ip_publico || c.relay_ip_publico }));
      setEmailCfgMsg('IP público detectado e preenchido.');
    } catch (e) {
      setEmailCfgErr(e.message || String(e));
    }
  };

  const salvarTemplateProposta = async () => {
    setTplSaving(true);
    setTplErr('');
    setTplMsg('');
    try {
      const res = await fetch(`${baseApi}/proposta-template/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_nome: tpl.empresa_nome,
          titulo: tpl.titulo,
          email_comercial: tpl.email_comercial,
          telefone_comercial: tpl.telefone_comercial,
          logo_data_url: tpl.logo_data_url,
          condicoes_comerciais: tpl.condicoes_comerciais,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
      setTpl((t) => ({ ...t, ...data }));
      setTplMsg('Template da proposta gravado.');
    } catch (e) {
      setTplErr(e.message || String(e));
    } finally {
      setTplSaving(false);
    }
  };

  const visualizarTemplate = () => setTplPreviewOpen(true);

  const refreshBaseData = async () => {
    setBaseLoading(true);
    setBaseErro('');
    try {
      const [clientes, solicitantes] = await Promise.all([
        fetchJsonList('/clientes/'),
        fetchJsonList('/solicitantes/'),
      ]);
      setListaClientesBase(clientes);
      setListaSolicitantesBaseAll(solicitantes);
    } catch (e) {
      setBaseErro(e.message || String(e));
    } finally {
      setBaseLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'base') return;
    // sempre que entrar na aba base, recarrega para refletir alterações recentes
    refreshBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const apiJson = async (method, path, body) => {
    const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text.slice(0, 400) };
      }
    }
    if (!res.ok) throw new Error(data.error || data.detail || `HTTP ${res.status}`);
    return data;
  };

  const resetClienteBaseForm = () =>
    setClienteBaseForm({ nome_empresa: '', cnpj: '', endereco: '', cep: '', numero: '' });
  const resetSolicitanteBaseForm = () => setSolicitanteBaseForm({ cliente: '', nome: '', email: '', telefone: '' });

  const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

  const buscarDadosCnpj = async () => {
    const cnpj = onlyDigits(clienteBaseForm.cnpj);
    if (cnpj.length !== 14) {
      setCnpjLookupErro('Informe um CNPJ com 14 dígitos.');
      return;
    }
    setCnpjLookupErro('');
    setBaseErro('');
    setCnpjLookupLoading(true);
    try {
      // API gratuita: BrasilAPI
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        const msg = data?.message || data?.error || `Falha ao consultar CNPJ (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      const nome = data?.razao_social || data?.nome_fantasia || '';
      const logradouro = data?.logradouro || '';
      const numero = data?.numero || '';
      const bairro = data?.bairro || '';
      const municipio = data?.municipio || '';
      const uf = data?.uf || '';
      const cep = onlyDigits(data?.cep || '');

      const enderecoParts = [logradouro, bairro && `Bairro ${bairro}`, municipio && `${municipio}${uf ? ` - ${uf}` : ''}`]
        .filter(Boolean)
        .join(', ');

      setClienteBaseForm((prev) => ({
        ...prev,
        nome_empresa: prev.nome_empresa?.trim() ? prev.nome_empresa : nome,
        endereco: prev.endereco?.trim() ? prev.endereco : enderecoParts,
        cep: prev.cep?.trim() ? prev.cep : cep,
        numero: prev.numero?.trim() ? prev.numero : numero,
        cnpj, // normaliza para dígitos
      }));
    } catch (e) {
      setCnpjLookupErro(e.message || String(e));
    } finally {
      setCnpjLookupLoading(false);
    }
  };

  const salvarClienteBase = async () => {
    setBaseErro('');
    setBaseLoading(true);
    try {
      const payload = {
        ...clienteBaseForm,
        numero: clienteBaseForm.numero === '' ? null : Number(clienteBaseForm.numero),
      };
      if (clienteBaseEditId) {
        await apiJson('PUT', `/clientes/${clienteBaseEditId}/`, payload);
      } else {
        await fetchJsonPost('/clientes/', payload);
      }
      await refreshBaseData();
      setClienteBaseEditId(null);
      resetClienteBaseForm();
      return true;
    } catch (e) {
      setBaseErro(e.message || String(e));
      return false;
    } finally {
      setBaseLoading(false);
    }
  };

  const excluirClienteBase = async (id) => {
    if (!id) return;
    if (!confirm('Excluir este cliente? Isso também remove os solicitantes relacionados.')) return;
    setBaseErro('');
    setBaseLoading(true);
    try {
      await apiJson('DELETE', `/clientes/${id}/`);
      await refreshBaseData();
    } catch (e) {
      setBaseErro(e.message || String(e));
    } finally {
      setBaseLoading(false);
    }
  };

  const salvarSolicitanteBase = async () => {
    const clienteId = solicitanteBaseForm.cliente;
    if (!clienteId) {
      setBaseErro('Selecione o cliente para associar o solicitante.');
      return false;
    }
    setBaseErro('');
    setBaseLoading(true);
    try {
      const payload = { ...solicitanteBaseForm, cliente: Number(clienteId) };
      if (solicitanteBaseEditId) {
        await apiJson('PUT', `/solicitantes/${solicitanteBaseEditId}/`, payload);
      } else {
        await fetchJsonPost('/solicitantes/', payload);
      }
      await refreshBaseData();
      setSolicitanteBaseEditId(null);
      resetSolicitanteBaseForm();
      return true;
    } catch (e) {
      setBaseErro(e.message || String(e));
      return false;
    } finally {
      setBaseLoading(false);
    }
  };

  const excluirSolicitanteBase = async (id) => {
    if (!id) return;
    if (!confirm('Excluir este solicitante?')) return;
    setBaseErro('');
    setBaseLoading(true);
    try {
      await apiJson('DELETE', `/solicitantes/${id}/`);
      await refreshBaseData();
    } catch (e) {
      setBaseErro(e.message || String(e));
    } finally {
      setBaseLoading(false);
    }
  };


  

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
    } else if (activeTab === 'iss') {
      url = `${API_BASE}/matriz-iss/` + (editandoItem ? `${editandoItem.id}/` : '');
      const cidadeNome = (formData.cidade || '').trim();
      const aliqNum = parseFloat(String(formData.aliquota ?? '').replace(',', '.'));
      body = { cidade: cidadeNome, aliquota: aliqNum };
    } else if (activeTab === 'veiculos') {
      const rota = activeSubTab === 'veiculos' ? 'veiculos' : 'semireboques';
      url = `${API_BASE}/${rota}/` + (editandoItem ? `${editandoItem.id}/` : '');
      
      // AQUI MANTÉM OS CAMPOS DO BANCO DE DADOS
      body =
        activeSubTab === 'veiculos'
          ? veiculoPayloadFromForm(formData)
          : { tipo_semireboque: formData.tipo, eixos_semireboque: parseInt(String(formData.eixos), 10) || 0 };
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
          tipo: 'FAIXA',
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

    if (!url) {
      alert('Não foi possível identificar o recurso a salvar.');
      return;
    }

    if (activeTab === 'iss') {
      if (!body.cidade) {
        alert('Informe o município (use a lista do IBGE ao digitar 3+ letras).');
        return;
      }
      if (!Number.isFinite(body.aliquota)) {
        alert('Informe uma alíquota válida (%).');
        return;
      }
    }

    try {
      const res = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await carregarTudo();
        fecharModal();
        return;
      }
      let detail = `Erro ao salvar (${res.status})`;
      try {
        const errBody = await res.json();
        if (typeof errBody === 'string') detail = errBody;
        else if (errBody?.error) detail = String(errBody.error);
        else if (errBody?.detail) detail = String(errBody.detail);
        else if (errBody && typeof errBody === 'object') {
          const msgs = Object.entries(errBody).flatMap(([k, v]) => {
            const val = Array.isArray(v) ? v.join(' ') : String(v);
            return `${k}: ${val}`;
          });
          detail = msgs.length ? msgs.join(' | ') : JSON.stringify(errBody);
        }
      } catch {
        try {
          detail = (await res.text()).slice(0, 240);
        } catch { /* ignore */ }
      }
      alert(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Falha de rede ao salvar. Verifique se o backend está no ar.');
    }
  };





  const handleExcluir = async (id, opts = {}) => {
    const { skipConfirm = false, skipReload = false } = opts || {};
    if (!skipConfirm && !window.confirm("Confirmar exclusão definitiva?")) return;
  
    let rota = '';
  
    // Define a rota baseada na aba e sub-aba ativa
    if (activeTab === 'icms') {
      rota = 'icms';
    } else if (activeTab === 'iss') {
      rota = 'matriz-iss';
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
        if (!skipReload) carregarTudo(); // Recarrega todas as listas
      } else {
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          detail = body?.detail || body?.error || JSON.stringify(body);
        } catch {
          try { detail = (await res.text()).slice(0, 320); } catch { /* ignore */ }
        }
        alert(`Erro ao excluir (${rota}): ${detail}`);
      }
    } catch (err) {
      console.error(">>> [ERRO REDE]:", err);
    }
  };

  const excluirMarkupCelula = async (nomeCliente, c26) => {
    const cliente = (nomeCliente || '').toString().trim().toUpperCase();
    const lair = Number(c26);
    if (!cliente || !Number.isFinite(lair)) return;

    const rows = (listaMarkupConfig || []).filter((m) => {
      const tipo = (m?.tipo || 'FAIXA').toString().toUpperCase();
      if (tipo !== 'FAIXA') return false;
      const c = (m?.nome_cliente || '').toString().trim().toUpperCase();
      return c === cliente && Math.abs(Number(m?.percentual_markup) - lair) < 0.02;
    });

    if (!rows.length) return;
    const ok = window.confirm(`Excluir ${rows.length} registro(s) de Markup para ${cliente} / LAIR ${lair.toFixed(2)}%?`);
    if (!ok) return;

    for (const r of rows) {
      // eslint-disable-next-line no-await-in-loop
      await handleExcluir(r.id, { skipConfirm: true, skipReload: true });
    }
    carregarTudo();
  };

  const abrirEdicao = (item) => {
    setEditandoItem(item);

    if (activeTab === 'taxas' && subAbaAtiva === 'tabela') {
      setFormData({
        ...formData,
        nome_cliente: item.nome_cliente,
        malha_spot_tipo: item.malha_spot_tipo || 'DIVERSOS',
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
        markup_percentual_base: item.percentual_base ?? '',
        markup_percentual_markup: item.percentual_markup ?? '',
      });
    } else if (activeTab === 'icms') {
      setFormData({ ...formData, origem: item.origem, destino: item.destino, aliquota: item.aliquota });
    } else if (activeTab === 'iss') {
      setFormData({
        ...formData,
        cidade: item.cidade ?? '',
        iss_uf: '',
        aliquota: item.aliquota ?? '',
      });
    } else if (activeTab === 'veiculos') {
      if (activeSubTab === 'veiculos') {
        setFormData({
          ...initialFormData,
          tipo: item.tipo_veiculo ?? '',
          eixos: item.eixos_veiculo ?? '',
          ...veiculoItemIntoForm(item),
        });
      } else {
        setFormData({
          ...initialFormData,
          tipo: item.tipo_semireboque ?? '',
          eixos: item.eixos_semireboque ?? '',
        });
      }
    } else {
      setFormData({ ...formData, descricao: item.descricao, valor: item.valor, unidade: item.unidade });
    }
    setIsModalOpen(true);
  };




  const fecharModal = () => {
    setIsModalOpen(false);
    setEditandoItem(null);
    setFormData(initialFormData);
    setSugestoesIssCidade([]);
  };

  const buscaIssCidades = async (termo) => {
    if (termo.length < 3) {
      setSugestoesIssCidade([]);
      return;
    }
    try {
      const filtrados = await buscarMunicipiosPorTermo(termo, 8);
      setSugestoesIssCidade(filtrados);
    } catch (e) {
      console.error(e);
      setSugestoesIssCidade([]);
    }
  };

  const selecionarIssCidade = (item) => {
    setFormData((prev) => ({ ...prev, cidade: item.cidade, iss_uf: item.uf || '' }));
    setSugestoesIssCidade([]);
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

  const carregarImpostos = async () => {
    setListaImpostos(await fetchJsonList('/impostos/'));
  };

  const carregarSeguros = async () => {
    setListaSeguros(await fetchJsonList('/seguros/'));
  };

  const carregarGris = async () => {
    setListaGris(await fetchJsonList('/gris/'));
  };

  const carregarDespesas = async () => {
    setListaDespesas(await fetchJsonList('/despesas-operacionais/'));
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
      malha_spot_tipo: formData.malha_spot_tipo || 'DIVERSOS',
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
        await carregarTabelaPreco();
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
    <div className="max-w-6xl mx-auto space-y-6 min-w-0">
      <h1 className="text-2xl font-bold text-slate-800">Painel de Configurações Operacionais</h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-full">
        <div className="border-b border-slate-200 bg-slate-50 min-w-0">
          {/* Mobile: sem scroll, usa seleção */}
          <div className="sm:hidden px-4 py-3">
            <label className="block text-[10px] font-bold uppercase text-slate-400">Seção</label>
            <select
              className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
            >
              <option value="icms">Matriz ICMS</option>
              <option value="iss">Matriz ISS</option>
              <option value="veiculos">Veículos e Semirreboques</option>
              <option value="taxas">Impostos e Taxas</option>
              <option value="base">Base Clientes e Solicitantes</option>
              <option value="template">Proposta Comercial</option>
            </select>
          </div>

          {/* Desktop: uma linha, sem scroll */}
          <div className="hidden sm:flex items-center gap-1 px-2">
            <button onClick={() => setActiveTab('icms')} className={`flex items-center gap-2 px-3 py-3 text-[12px] font-bold transition whitespace-nowrap ${activeTab === 'icms' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
              <MapIcon size={16} /> Matriz ICMS
            </button>
            <button onClick={() => setActiveTab('iss')} className={`flex items-center gap-2 px-3 py-3 text-[12px] font-bold transition whitespace-nowrap ${activeTab === 'iss' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Building2 size={16} /> Matriz ISS
            </button>
            <button onClick={() => setActiveTab('veiculos')} className={`flex items-center gap-2 px-3 py-3 text-[12px] font-bold transition whitespace-nowrap ${activeTab === 'veiculos' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Truck size={16} /> Veículos e Semirreboques
            </button>
            <button onClick={() => setActiveTab('taxas')} className={`flex items-center gap-2 px-3 py-3 text-[12px] font-bold transition whitespace-nowrap ${activeTab === 'taxas' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
              <DollarSign size={16} /> Impostos e Taxas
            </button>
            <button onClick={() => setActiveTab('base')} className={`flex items-center gap-2 px-3 py-3 text-[12px] font-bold transition whitespace-nowrap ${activeTab === 'base' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Users size={16} /> Base Clientes e Solicitantes
            </button>
            <button onClick={() => setActiveTab('template')} className={`flex items-center gap-2 px-3 py-3 text-[12px] font-bold transition whitespace-nowrap ${activeTab === 'template' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
              <FileText size={16} /> Proposta Comercial
            </button>
          </div>
        </div>

        <div className="p-6 min-w-0 max-w-full">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <h2 className="font-bold text-slate-700 text-lg uppercase">
              {activeTab === 'icms'
                ? 'Alíquotas Interestaduais'
                : activeTab === 'iss'
                  ? 'Alíquotas de ISS por Município'
                  : activeTab === 'veiculos'
                    ? activeSubTab === 'veiculos'
                      ? 'Frota de Tração'
                      : 'Frota de Carga'
                    : activeTab === 'base'
                      ? 'Base de Clientes e Solicitantes'
                      : activeTab === 'template'
                        ? 'Proposta Comercial — Layout e Envio'
                      : `Taxas: ${subAbaAtiva}`}
            </h2>
            
            {activeTab !== 'template' ? (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Buscar..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-full outline-none focus:border-blue-500" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')} className="p-2 border rounded-lg hover:bg-slate-50 text-slate-600"><ArrowUpDown size={18} /></button>
              {activeTab !== 'base' && (
                <button
                  onClick={() => {
                    setEditandoItem(null);
                    setFormData(initialFormData);
                    setSugestoesIssCidade([]);
                    setIsModalOpen(true);
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 font-bold"
                >
                  <Plus size={16} /> Novo
                </button>
              )}
            </div>
            ) : (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={visualizarTemplate}
                  type="button"
                  className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-200 font-bold text-slate-800"
                >
                  <FileText size={16} /> Visualizar
                </button>
                <button
                  onClick={salvarTemplateProposta}
                  disabled={tplSaving}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 font-bold disabled:opacity-50"
                >
                  <Save size={16} /> {tplSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            )}
          </div>

          {activeTab === 'template' && (
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setTplSubTab('template')}
                  className={`px-4 py-2 text-[11px] font-black uppercase tracking-wider ${
                    tplSubTab === 'template' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-400'
                  }`}
                >
                  Layout
                </button>
                <button
                  type="button"
                  onClick={() => setTplSubTab('email')}
                  className={`px-4 py-2 text-[11px] font-black uppercase tracking-wider ${
                    tplSubTab === 'email' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-400'
                  }`}
                >
                  Envio
                </button>
              </div>

              {tplErr && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{tplErr}</div>
              )}
              {tplMsg && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">{tplMsg}</div>
              )}
              {tplSubTab === 'template' ? (
                tplLoading ? (
                  <div className="text-sm text-slate-500">Carregando template...</div>
                ) : (
                  <div className="grid grid-cols-12 gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="col-span-12 md:col-span-6">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Nome da empresa</label>
                      <input
                        className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        value={tpl.empresa_nome}
                        onChange={(e) => setTpl({ ...tpl, empresa_nome: e.target.value })}
                      />
                    </div>
                  <div className="col-span-12 md:col-span-6">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Logo (PNG/JPEG)</label>
                    <div className="mt-1 flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="block w-full text-sm"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 900 * 1024) {
                            setTplErr('Logo muito grande. Use até ~900KB.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            const url = typeof reader.result === 'string' ? reader.result : '';
                            setTpl((t) => ({ ...t, logo_data_url: url }));
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                      {tpl.logo_data_url ? (
                        <button
                          type="button"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-black uppercase text-slate-700 hover:bg-slate-100"
                          onClick={() => setTpl((t) => ({ ...t, logo_data_url: '' }))}
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                    {tpl.logo_data_url && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <img alt="Logo" src={tpl.logo_data_url} className="h-10 object-contain" />
                      </div>
                    )}
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Título</label>
                    <input
                      className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      value={tpl.titulo}
                      onChange={(e) => setTpl({ ...tpl, titulo: e.target.value })}
                    />
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Email comercial</label>
                    <input
                      className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      value={tpl.email_comercial}
                      onChange={(e) => setTpl({ ...tpl, email_comercial: e.target.value })}
                    />
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Telefone comercial</label>
                    <input
                      className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      value={tpl.telefone_comercial}
                      onChange={(e) => setTpl({ ...tpl, telefone_comercial: e.target.value })}
                    />
                  </div>
                  <div className="col-span-12">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Condições comerciais (uma linha por item)</label>
                    <textarea
                      rows={12}
                      className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 font-mono"
                      value={tpl.condicoes_comerciais}
                      onChange={(e) => setTpl({ ...tpl, condicoes_comerciais: e.target.value })}
                      placeholder="* Pedágio incluso no frete&#10;* ICMS/ISS não incluso no frete..."
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Dica: você pode colar exatamente do Excel. O PDF vai respeitar a ordem das linhas.
                    </p>
                  </div>
                </div>
              )
              ) : (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  {emailCfgErr && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{emailCfgErr}</div>
                  )}
                  {emailCfgMsg && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">{emailCfgMsg}</div>
                  )}
                  {emailCfgLoading ? (
                    <div className="text-sm text-slate-500">Carregando configuração de e-mail...</div>
                  ) : (
                    <>
                  <label className="flex items-center gap-2 text-[11px] font-black uppercase text-slate-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-600"
                          checked={!!emailCfg.habilitado}
                          onChange={(e) => setEmailCfg((c) => ({ ...c, habilitado: e.target.checked }))}
                        />
                    Habilitar envio por e-mail
                      </label>

                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 md:col-span-6">
                          <label className="text-[10px] font-bold uppercase text-slate-400">Modo de envio</label>
                          <select
                            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 font-bold"
                            value={emailCfg.modo_envio || 'AUTH'}
                            onChange={(e) => setEmailCfg((c) => ({ ...c, modo_envio: e.target.value }))}
                          >
                            <option value="AUTH">SMTP (Usuário/Senha)</option>
                            <option value="RELAY">SMTP Relay (Sem autenticação)</option>
                          </select>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Para Microsoft 365 com Basic Auth bloqueado, use <strong>SMTP Relay</strong> + conector liberando o IP.
                          </p>
                        </div>
                        <div className="col-span-12 md:col-span-6">
                          <label className="text-[10px] font-bold uppercase text-slate-400">IP público (saída) para liberar</label>
                          <div className="mt-1 flex gap-2">
                            <input
                              className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 font-semibold"
                              value={emailCfg.relay_ip_publico || ''}
                              onChange={(e) => setEmailCfg((c) => ({ ...c, relay_ip_publico: e.target.value }))}
                              placeholder="Ex: 200.200.200.200"
                            />
                            <button
                              type="button"
                              className="rounded border border-slate-300 bg-white px-3 py-2 text-[11px] font-black uppercase text-slate-700 hover:bg-slate-100"
                              onClick={detectarIpPublicoEmail}
                            >
                              Detectar
                            </button>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Esse é o IP que a TI deve colocar no conector do Microsoft 365 (SMTP Relay).
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 md:col-span-6">
                          <label className="text-[10px] font-bold uppercase text-slate-400">Nome do remetente</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            value={emailCfg.remetente_nome}
                            onChange={(e) => setEmailCfg((c) => ({ ...c, remetente_nome: e.target.value }))}
                          />
                        </div>
                        <div className="col-span-12 md:col-span-6">
                          <label className="text-[10px] font-bold uppercase text-slate-400">E-mail do remetente</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            value={emailCfg.remetente_email}
                            onChange={(e) => setEmailCfg((c) => ({ ...c, remetente_email: e.target.value }))}
                            placeholder="seuemail@dominio.com"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 md:col-span-6">
                          <label className="text-[10px] font-bold uppercase text-slate-400">SMTP Host</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            value={emailCfg.smtp_host}
                            onChange={(e) => setEmailCfg((c) => ({ ...c, smtp_host: e.target.value }))}
                            placeholder="smtp.gmail.com"
                          />
                        </div>
                        <div className="col-span-6 md:col-span-3">
                          <label className="text-[10px] font-bold uppercase text-slate-400">Porta</label>
                          <input
                            type="number"
                            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            value={emailCfg.smtp_port}
                            onChange={(e) => setEmailCfg((c) => ({ ...c, smtp_port: e.target.value }))}
                          />
                        </div>
                        <div className="col-span-6 md:col-span-3">
                          <label className="text-[10px] font-bold uppercase text-slate-400">TLS</label>
                          <select
                            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            value={emailCfg.smtp_use_tls ? '1' : '0'}
                            onChange={(e) => setEmailCfg((c) => ({ ...c, smtp_use_tls: e.target.value === '1' }))}
                          >
                            <option value="1">Sim</option>
                            <option value="0">Não</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 md:col-span-6">
                          <label className="text-[10px] font-bold uppercase text-slate-400">Usuário SMTP</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            value={emailCfg.smtp_usuario}
                            onChange={(e) => setEmailCfg((c) => ({ ...c, smtp_usuario: e.target.value }))}
                          />
                        </div>
                        <div className="col-span-12 md:col-span-6">
                          <label className="text-[10px] font-bold uppercase text-slate-400">
                            Senha SMTP (opcional)
                          </label>
                          <div className="mt-1 flex gap-2">
                            <input
                              type={emailCfgShowSenha ? 'text' : 'password'}
                              className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              value={emailCfg.smtp_senha}
                              onChange={(e) => setEmailCfg((c) => ({ ...c, smtp_senha: e.target.value }))}
                              placeholder={emailCfg.senha_configurada ? '•••••• (deixe em branco para manter)' : 'Digite para configurar'}
                            />
                            <button
                              type="button"
                              className="rounded border border-slate-300 bg-white px-3 py-2 text-[11px] font-black uppercase text-slate-700 hover:bg-slate-100"
                              onClick={() => setEmailCfgShowSenha((v) => !v)}
                            >
                              {emailCfgShowSenha ? 'Ocultar' : 'Mostrar'}
                            </button>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Dica: provedores como Gmail exigem <strong>senha de app</strong>.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          disabled={emailCfgSaving}
                          onClick={salvarEmailCfg}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-[12px] font-black uppercase text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {emailCfgSaving ? 'Salvando...' : 'Salvar configuração de e-mail'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {tplPreviewOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Preview do template (vazio)
                      </div>
                      <button
                        type="button"
                        onClick={() => setTplPreviewOpen(false)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-black uppercase text-slate-700 hover:bg-slate-100"
                      >
                        Fechar
                      </button>
                    </div>
                    <div className="max-h-[75vh] overflow-auto bg-slate-100 p-4">
                      <div className="mx-auto w-[1123px] bg-white shadow">
                        <div dangerouslySetInnerHTML={{ __html: propostaPreviewHtml }} />
                      </div>
                      <p className="mt-3 text-center text-[11px] font-semibold text-slate-600">
                        Este preview não gera PDF — é só para visualizar o layout e os textos configurados.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'base' && (
            <div className="space-y-4">
              {baseErro && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-800">
                  {baseErro}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-600">
                  1 linha = 1 solicitante (com os dados do cliente). Cliente pode ter vários solicitantes.
                </p>
                <button
                  type="button"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-[12px] font-black uppercase text-white hover:bg-blue-700"
                  onClick={() => {
                    setBaseModalMode('cliente');
                    setClienteBaseEditId(null);
                    setSolicitanteBaseEditId(null);
                    resetClienteBaseForm();
                    resetSolicitanteBaseForm();
                    setBaseModalOpen(true);
                  }}
                >
                  <Plus size={16} className="inline -mt-[2px] mr-1" /> Novo
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-auto">
                  <table className="w-full min-w-[980px] border-collapse text-left text-[11px]">
                    <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
                      <tr className="text-slate-700">
                        <th className="px-3 py-3 font-black uppercase border-r border-slate-200">CNPJ</th>
                        <th className="px-3 py-3 font-black uppercase border-r border-slate-200">Cliente</th>
                        <th className="px-3 py-3 font-black uppercase border-r border-slate-200">Solicitante</th>
                        <th className="px-3 py-3 font-black uppercase border-r border-slate-200">Telefone</th>
                        <th className="px-3 py-3 font-black uppercase border-r border-slate-200">Email</th>
                        <th className="px-3 py-3 font-black uppercase text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const clientes = dadosFiltrados || [];
                        const sols = listaSolicitantesBaseAll || [];
                        const solsPorCliente = new Map();
                        for (const s of sols) {
                          const cid = typeof s?.cliente === 'object' ? s?.cliente?.id : s?.cliente;
                          if (!cid) continue;
                          if (!solsPorCliente.has(cid)) solsPorCliente.set(cid, []);
                          solsPorCliente.get(cid).push(s);
                        }

                        const rows = [];
                        for (const c of clientes) {
                          const list = solsPorCliente.get(c.id) || [];
                          if (list.length === 0) {
                            rows.push({ cliente: c, solicitante: null, key: `c-${c.id}` });
                          } else {
                            for (const s of list) rows.push({ cliente: c, solicitante: s, key: `s-${s.id}` });
                          }
                        }

                        if (rows.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                Nenhum registro encontrado.
                              </td>
                            </tr>
                          );
                        }

                        return rows.map(({ cliente: c, solicitante: s, key }) => (
                          <tr key={key} className="border-b border-slate-100 hover:bg-blue-50/40">
                            <td className="px-3 py-2.5 border-r border-slate-50 text-slate-700 tabular-nums">
                              {c.cnpj || '—'}
                            </td>
                            <td className="px-3 py-2.5 border-r border-slate-50">
                              <div className="font-black text-slate-900 uppercase">{c.nome_empresa || '—'}</div>
                              <div className="text-[10px] text-slate-500">{c.endereco || '—'}</div>
                            </td>
                            <td className="px-3 py-2.5 border-r border-slate-50 font-bold text-slate-800">
                              {s?.nome || '—'}
                            </td>
                            <td className="px-3 py-2.5 border-r border-slate-50 text-slate-700">
                              {s?.telefone || '—'}
                            </td>
                            <td className="px-3 py-2.5 border-r border-slate-50 text-slate-700">
                              {s?.email || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                className="mr-2 text-blue-600 hover:text-blue-800 font-black"
                                onClick={() => {
                                  setBaseModalMode('cliente');
                                  setClienteBaseEditId(c.id);
                                  setSolicitanteBaseEditId(null);
                                  setClienteBaseForm({
                                    nome_empresa: c.nome_empresa || '',
                                    cnpj: c.cnpj || '',
                                    endereco: c.endereco || '',
                                    cep: c.cep || '',
                                    numero: c.numero ?? '',
                                  });
                                  setBaseModalOpen(true);
                                }}
                              >
                                Editar cliente
                              </button>
                              <button
                                type="button"
                                className="mr-2 text-red-600 hover:text-red-800 font-black"
                                onClick={() => excluirClienteBase(c.id)}
                              >
                                Excluir cliente
                              </button>
                              <button
                                type="button"
                                className="mr-2 text-emerald-700 hover:text-emerald-900 font-black"
                                onClick={() => {
                                  setBaseModalMode('solicitante');
                                  setSolicitanteBaseEditId(null);
                                  resetSolicitanteBaseForm();
                                  setSolicitanteBaseForm((p) => ({ ...p, cliente: String(c.id) }));
                                  setBaseModalOpen(true);
                                }}
                              >
                                + Solicitante
                              </button>
                              {s && (
                                <>
                                  <button
                                    type="button"
                                    className="mr-2 text-blue-600 hover:text-blue-800 font-black"
                                    onClick={() => {
                                      setBaseModalMode('solicitante');
                                      setClienteBaseEditId(null);
                                      setSolicitanteBaseEditId(s.id);
                                      setSolicitanteBaseForm({
                                        cliente: String(typeof s?.cliente === 'object' ? s?.cliente?.id : s?.cliente || ''),
                                        nome: s.nome || '',
                                        email: s.email || '',
                                        telefone: s.telefone || '',
                                      });
                                      setBaseModalOpen(true);
                                    }}
                                  >
                                    Editar sol.
                                  </button>
                                  <button
                                    type="button"
                                    className="text-red-600 hover:text-red-800 font-black"
                                    onClick={() => excluirSolicitanteBase(s.id)}
                                  >
                                    Excluir sol.
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {baseModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
                      <div className="text-sm font-black uppercase text-slate-700">Novo / Editar</div>
                      <button
                        type="button"
                        className="text-slate-600 hover:text-slate-900 font-black"
                        onClick={() => setBaseModalOpen(false)}
                      >
                        Fechar
                      </button>
                    </div>

                    <div className="px-4 py-3">
                      {baseErro && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-800">
                          {baseErro}
                        </div>
                      )}
                      <div className="flex gap-2 border-b pb-2 mb-3">
                        {[
                          { id: 'cliente', label: 'Cliente' },
                          { id: 'solicitante', label: 'Solicitante' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setBaseModalMode(m.id)}
                            className={`px-3 py-2 text-[11px] font-black uppercase rounded-lg ${
                              baseModalMode === m.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>

                      {baseModalMode === 'cliente' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <input className="col-span-2 rounded border border-slate-200 px-3 py-2 text-sm" placeholder="Nome empresa" value={clienteBaseForm.nome_empresa} onChange={(e) => setClienteBaseForm((p) => ({ ...p, nome_empresa: e.target.value }))} />
                          <div className="flex gap-2">
                            <input
                              className="flex-1 rounded border border-slate-200 px-3 py-2 text-sm"
                              placeholder="CNPJ (14 dígitos)"
                              value={clienteBaseForm.cnpj}
                              onChange={(e) => setClienteBaseForm((p) => ({ ...p, cnpj: e.target.value }))}
                            />
                            <button
                              type="button"
                              disabled={cnpjLookupLoading}
                              className="whitespace-nowrap rounded bg-slate-800 px-3 py-2 text-[11px] font-black uppercase text-white hover:bg-slate-900 disabled:opacity-60"
                              onClick={buscarDadosCnpj}
                              title="Busca dados do CNPJ (BrasilAPI)"
                            >
                              {cnpjLookupLoading ? 'Buscando…' : 'Buscar CNPJ'}
                            </button>
                          </div>
                          <input className="rounded border border-slate-200 px-3 py-2 text-sm" placeholder="CEP" value={clienteBaseForm.cep} onChange={(e) => setClienteBaseForm((p) => ({ ...p, cep: e.target.value }))} />
                          <input className="col-span-2 rounded border border-slate-200 px-3 py-2 text-sm" placeholder="Endereço" value={clienteBaseForm.endereco} onChange={(e) => setClienteBaseForm((p) => ({ ...p, endereco: e.target.value }))} />
                          <input className="rounded border border-slate-200 px-3 py-2 text-sm" placeholder="Número" value={clienteBaseForm.numero} onChange={(e) => setClienteBaseForm((p) => ({ ...p, numero: e.target.value }))} />
                          {cnpjLookupErro && (
                            <p className="col-span-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                              {cnpjLookupErro}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <select className="col-span-2 rounded border border-slate-200 px-3 py-2 text-sm" value={solicitanteBaseForm.cliente} onChange={(e) => setSolicitanteBaseForm((p) => ({ ...p, cliente: e.target.value }))}>
                            <option value="">Selecione o cliente…</option>
                            {(listaClientesBase || []).map((c) => (
                              <option key={c.id} value={String(c.id)}>
                                {c.nome_empresa} {c.cnpj ? `(${c.cnpj})` : ''}
                              </option>
                            ))}
                          </select>
                          <input className="col-span-2 rounded border border-slate-200 px-3 py-2 text-sm" placeholder="Nome solicitante" value={solicitanteBaseForm.nome} onChange={(e) => setSolicitanteBaseForm((p) => ({ ...p, nome: e.target.value }))} />
                          <input className="rounded border border-slate-200 px-3 py-2 text-sm" placeholder="Telefone" value={solicitanteBaseForm.telefone} onChange={(e) => setSolicitanteBaseForm((p) => ({ ...p, telefone: e.target.value }))} />
                          <input className="rounded border border-slate-200 px-3 py-2 text-sm" placeholder="Email" value={solicitanteBaseForm.email} onChange={(e) => setSolicitanteBaseForm((p) => ({ ...p, email: e.target.value }))} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t bg-slate-50 px-4 py-3">
                      <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-[11px] font-black uppercase text-slate-700 hover:bg-white" onClick={() => setBaseModalOpen(false)}>
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={baseLoading}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-60"
                        onClick={async () => {
                          const ok = baseModalMode === 'cliente' ? await salvarClienteBase() : await salvarSolicitanteBase();
                          if (ok) setBaseModalOpen(false);
                        }}
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {(activeTab === 'icms' || activeTab === 'iss' || activeTab === 'veiculos') && (
            <div className="space-y-4">
              {activeTab === 'veiculos' && (
                <div className="flex gap-4 mb-6 border-b pb-2">
                  <button onClick={() => setActiveSubTab('veiculos')} className={`pb-2 px-2 text-sm font-bold transition-all ${activeSubTab === 'veiculos' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Cavalos/Caminhões</button>
                  <button onClick={() => setActiveSubTab('semireboques')} className={`pb-2 px-2 text-sm font-bold transition-all ${activeSubTab === 'semireboques' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Semirreboques/Implementos</button>
                </div>
              )}

              {activeTab === 'veiculos' && activeSubTab === 'veiculos' ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full min-w-[1100px] border-collapse text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                        <th className="sticky left-0 z-10 bg-slate-100 px-2 py-2 font-black uppercase border-r border-slate-200">
                          Tipo veículo
                        </th>
                        <th className="px-2 py-2 font-black uppercase text-center border-r border-slate-200 w-12">Eixos</th>
                        <th
                          className="px-1.5 py-2 font-black uppercase text-center whitespace-nowrap border-r border-slate-100"
                          title="Taxa de correção (R$)"
                        >
                          Taxa corr.
                        </th>
                        {VEICULO_COLUNAS_FRETE.map((col) => (
                          <th key={col.key} className="px-1.5 py-2 font-black uppercase text-center whitespace-nowrap border-r border-slate-100 last:border-r-0" title={col.label}>
                            {col.short}
                          </th>
                        ))}
                        <th className="px-2 py-2 font-black uppercase text-center w-24">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosFiltrados.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50/40">
                          <td className="sticky left-0 z-[1] bg-white px-2 py-1.5 font-bold text-slate-800 uppercase border-r border-slate-100">
                            {item.tipo_veiculo}
                          </td>
                          <td className="px-2 py-1.5 text-center font-black text-blue-700 border-r border-slate-100">
                            {item.eixos_veiculo}
                          </td>
                          <td className="px-1 py-1.5 text-right tabular-nums border-r border-slate-50 text-slate-700">
                            {fmtBRLCell(item.taxa_correcao)}
                          </td>
                          {VEICULO_COLUNAS_FRETE.map((col) => (
                            <td key={col.key} className="px-1 py-1.5 text-right tabular-nums border-r border-slate-50 text-slate-700">
                              {fmtBRLCell(item[col.key])}
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center whitespace-nowrap">
                            <button type="button" onClick={() => abrirEdicao(item)} className="text-blue-600 hover:text-blue-800 font-bold mr-2">
                              Editar
                            </button>
                            <button type="button" onClick={() => handleExcluir(item.id)} className="text-red-500 hover:text-red-700 font-bold">
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dadosFiltrados.length === 0 && (
                    <p className="py-8 text-center text-sm text-slate-500 font-medium">Nenhum veículo cadastrado.</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {dadosFiltrados.map((item) => (
                    <div key={item.id} className="p-3 border rounded-lg bg-slate-50 flex flex-col gap-1 group hover:border-blue-300 transition-all shadow-sm">
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        <span>{activeTab === 'icms' ? 'Rota UF' : activeTab === 'iss' ? 'Município' : 'Modelo'}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => abrirEdicao(item)} className="text-blue-500 hover:text-blue-700 font-bold">Editar</button>
                          <button onClick={() => handleExcluir(item.id)} className="text-red-500"><Trash2 size={12} /></button>
                        </div>
                      </div>
                      <span className="font-bold text-slate-700 truncate uppercase">
                        {activeTab === 'icms' ? `${item.origem}-${item.destino}` : activeTab === 'iss' ? (item.cidade || '—') : (item.tipo_veiculo || item.tipo_semireboque)}
                      </span>
                      <span className="text-lg font-black text-blue-700">
                        {activeTab === 'icms' || activeTab === 'iss' ? `${item.aliquota}%` : `${item.eixos_veiculo || item.eixos_semireboque} Eixos`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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

                <div className="flex flex-col md:flex-row gap-6 min-w-0 max-w-full">
                  {/* ÁREA DE CONTEÚDO DINÂMICO */}
                  <div className="flex-1 min-w-0 max-w-full">
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
                                <th className="px-3 py-3 text-center border-r">Taxa - 1 Seguro</th>
                                <th className="px-3 py-3 text-center border-r">Taxa - 2 Gris</th>
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
                      <div className="bg-white border rounded-xl shadow-sm max-w-full min-w-0">
                        <div className="overflow-x-auto overscroll-x-contain">
                          <table className="w-max min-w-full text-left text-[11px] border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr className="text-slate-600 font-black uppercase">
                                <th className="px-4 py-3 border-r whitespace-nowrap">LAIR (%)</th>
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
                                      LAIR (%)
                                    </th>
                                  </Fragment>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {markupC26Rows.map((c26) => (
                                <tr key={c26} className="hover:bg-blue-50/30 transition-colors">
                                  <td className="px-4 py-3 font-black text-slate-700 border-r text-center">
                                    {Number(c26).toFixed(2).replace('.', ',')}%
                                  </td>
                                  {markupClientes.map((cliente) => {
                                    const key = `${cliente.toUpperCase()}||${Number(c26).toFixed(2)}`;
                                    const item = markupMap.get(key);
                                    const base = Number(item?.percentual_base);
                                    const mk = Number(item?.percentual_markup);

                                    return (
                                      <Fragment key={`${cliente}-${c26}`}>
                                        <td className="px-3 py-2 border-r text-center bg-blue-50/10">
                                          {item ? (
                                            <button
                                              onClick={() => abrirEdicao(item)}
                                              className="w-full py-2 rounded-lg hover:bg-blue-100/60 transition-colors font-mono font-black text-blue-700"
                                              title="Editar"
                                            >
                                              {Number.isFinite(base) ? `${base.toFixed(4).replace('.', ',')}` : '-'}
                                            </button>
                                          ) : (
                                            <span className="block w-full py-2 text-slate-300 font-black select-none">-</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 border-r text-center bg-amber-50/10">
                                          {item ? (
                                            <div className="flex items-center justify-center gap-2 group">
                                              <button
                                                onClick={() => abrirEdicao(item)}
                                                className="flex-1 py-2 rounded-lg hover:bg-amber-100/60 transition-colors font-mono font-black text-amber-800"
                                                title="Editar"
                                              >
                                                {Number.isFinite(mk) ? `${mk.toFixed(2).replace('.', ',')}%` : '-'}
                                              </button>
                                              <button
                                                onClick={() => excluirMarkupCelula(cliente, c26)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
                                                title="Excluir"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          ) : (
                                            <span className="block w-full py-2 text-slate-300 font-black select-none">-</span>
                                          )}
                                        </td>
                                      </Fragment>
                                    );
                                  })}
                                </tr>
                              ))}

                              {markupClientes.length === 0 && (
                                <tr>
                                  <td className="px-4 py-6 text-center text-slate-400 font-bold" colSpan={1 + markupClientes.length * 2}>
                                    Nenhum cliente com markup disponível ainda.
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
          <div
            className={`bg-white p-6 rounded-xl shadow-xl w-full transition-all ${
              activeTab === 'veiculos' && activeSubTab === 'veiculos'
                ? 'max-w-6xl'
                : subAbaAtiva === 'tabela'
                  ? 'max-w-2xl'
                  : 'max-w-md'
            }`}
          >
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
              {editandoItem ? 'Editar' : 'Novo'}{' '}
              {activeTab === 'taxas' && subAbaAtiva === 'tabela'
                ? 'Configuração de Cliente'
                : activeTab === 'icms'
                  ? 'Alíquota ICMS'
                  : activeTab === 'iss'
                    ? 'Alíquota ISS'
                    : activeTab === 'veiculos'
                      ? (activeSubTab === 'veiculos' ? 'Veículo' : 'Semirreboque')
                      : 'Registro'}
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
              ) : activeTab === 'iss' ? (
                <>
                  <div className="relative">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Município (IBGE)</label>
                    <input
                      className="w-full border rounded p-2 outline-none focus:border-blue-500 font-bold uppercase"
                      placeholder="Digite 3+ letras e escolha na lista..."
                      autoComplete="off"
                      value={formData.iss_uf ? `${formData.cidade} - ${formData.iss_uf}` : formData.cidade}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFormData((prev) => ({ ...prev, cidade: v, iss_uf: '' }));
                        buscaIssCidades(v);
                      }}
                    />
                    {sugestoesIssCidade.length > 0 && (
                      <ul className="absolute z-[60] left-0 right-0 mt-1 max-h-48 overflow-auto bg-white border border-slate-200 shadow-lg rounded-md text-xs">
                        {sugestoesIssCidade.map((item, i) => (
                          <li
                            key={`${item.cidade}-${item.uf}-${i}`}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 text-left font-semibold text-slate-700"
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              selecionarIssCidade(item);
                            }}
                          >
                            {item.label}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[9px] text-slate-400 mt-1">
                      O nome salvo é o oficial do IBGE (mesmo fluxo da Nova Cotação).
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Alíquota (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      className="w-full border rounded p-2 outline-none focus:border-blue-500"
                      value={formData.aliquota}
                      onChange={e => setFormData({ ...formData, aliquota: e.target.value })}
                    />
                  </div>
                </>
              ) : activeTab === 'veiculos' ? (
                activeSubTab === 'veiculos' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Tipo de veículo</label>
                        <input
                          className="w-full border rounded p-2 outline-none focus:border-blue-500 font-semibold uppercase"
                          value={formData.tipo}
                          onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Eixos</label>
                        <input
                          type="number"
                          min={2}
                          max={9}
                          className="w-full border rounded p-2 outline-none focus:border-blue-500"
                          value={formData.eixos}
                          onChange={(e) => setFormData({ ...formData, eixos: e.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase text-slate-400">Taxa de correção (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          className="w-full border rounded p-2 outline-none focus:border-blue-500 text-right font-semibold tabular-nums"
                          value={formData.taxa_correcao}
                          onChange={(e) => setFormData({ ...formData, taxa_correcao: e.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-2 pt-2">
                        <input
                          id="ctrb_somar_taxa_correcao"
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={!!formData.ctrb_somar_taxa_correcao}
                          onChange={(e) =>
                            setFormData({ ...formData, ctrb_somar_taxa_correcao: e.target.checked })
                          }
                        />
                        <label htmlFor="ctrb_somar_taxa_correcao" className="text-xs font-semibold text-slate-700 cursor-pointer">
                          Somar taxa de correção no CTRB orçado (Nova Cotação)
                        </label>
                      </div>
                    </div>
                    <p className="mt-4 text-[10px] font-black uppercase text-slate-500">Valores de referência por faixa de distância (R$)</p>
                    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full min-w-[720px] border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {VEICULO_COLUNAS_FRETE.map((col) => (
                              <th key={col.key} className="px-1 py-2 font-black uppercase text-center text-slate-600 border-r border-slate-100 last:border-r-0 whitespace-nowrap" title={col.label}>
                                {col.short}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {VEICULO_COLUNAS_FRETE.map((col) => (
                              <td key={col.key} className="border-r border-slate-100 p-1 align-middle last:border-r-0">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0"
                                  className="w-full min-w-[70px] rounded border border-slate-200 px-1 py-1.5 text-right font-semibold tabular-nums outline-none focus:border-blue-500"
                                  value={formData[col.key]}
                                  onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value })}
                                />
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400">Descrição</label>
                      <input className="w-full border rounded p-2 outline-none focus:border-blue-500" value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400">Eixos</label>
                      <input type="number" className="w-full border rounded p-2 outline-none focus:border-blue-500" value={formData.eixos} onChange={(e) => setFormData({ ...formData, eixos: e.target.value })} />
                    </div>
                  </>
                )
              ) : activeTab === 'taxas' && subAbaAtiva === 'tabela' ? (
                /* FORMULÁRIO ESPECÍFICO PARA ClienteTaxasConfig */
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Nome do Cliente</label>
                    <input className="w-full border rounded p-2 outline-none focus:border-blue-500 font-bold" placeholder="Ex: AMBEV, COCA-COLA..." value={formData.nome_cliente} onChange={e => setFormData({...formData, nome_cliente: e.target.value})} />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Tipo de malha SPOT</label>
                    <select
                      className="w-full border rounded p-2 outline-none focus:border-blue-500 font-bold bg-white"
                      value={formData.malha_spot_tipo || 'DIVERSOS'}
                      onChange={(e) => setFormData({ ...formData, malha_spot_tipo: e.target.value })}
                    >
                      <option value="DIVERSOS">DIVERSOS</option>
                      <option value="RENAULT">RENAULT</option>
                      <option value="BOTICARIO">BOTICARIO</option>
                      <option value="CUSTOM">CUSTOM</option>
                    </select>
                    <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                      Define qual “árvore” da planilha será usada para o % base por LAIR/K/L. Use <strong>CUSTOM</strong> se quiser controlar só pelo
                      Markup no banco (sem regra automática).
                    </p>
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
                              <input type="text" className="w-full border rounded p-2 text-sm pr-8" placeholder="0,00" value={formData.seguro_taxa_2}
                                onChange={e => {let v = e.target.value.replace(',', '.'); if (isNaN(v) && v !== '') return; setFormData({...formData, seguro_taxa_2: v}); }}/>
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
                            value={
                              formData.valor_mercadoria_limite === '' ||
                              formData.valor_mercadoria_limite === null ||
                              formData.valor_mercadoria_limite === undefined
                                ? ''
                                : formatarMoedaInput(
                                    String(
                                      Math.round(Number(formData.valor_mercadoria_limite) * 100)
                                    )
                                  )
                            }
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
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">LAIR (%)</label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full border rounded p-2 text-sm pr-8 outline-none focus:border-blue-500 font-bold"
                        placeholder="20,00"
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

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Base (%)</label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full border rounded p-2 text-sm pr-8 outline-none focus:border-blue-500 font-bold"
                        placeholder="1,2010"
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