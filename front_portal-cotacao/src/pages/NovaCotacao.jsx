import { useState, useEffect, useRef, useMemo } from 'react';
import { Save, RotateCcw, FileText, Percent, ChevronDown } from 'lucide-react';
import { DIVERSOS_LAIR_DIVISORES_PADRAO } from '../lib/markupSpotLookup';
import { fetchJsonList, fetchJsonPost, getApiBase } from '../config/api';
import { buscarMunicipiosPorTermo } from '../lib/cidadesIbge';
import { useSearchParams } from 'react-router-dom';
import { gerarPropostaTecnicaPdf } from '../lib/propostaPdf';

const ANTT_LOAD_TYPES = [
  { value: 'granel_solido', label: 'Granel sólido' },
  { value: 'granel_liquido', label: 'Granel líquido' },
  { value: 'frigorificada', label: 'Frigorificada' },
  { value: 'conteineirizada', label: 'Conteinerizada' },
  { value: 'geral', label: 'Geral' },
  { value: 'neogranel', label: 'Neogranel' },
  { value: 'perigosa_granel_solido', label: 'Perigosa granel sólido' },
  { value: 'perigosa_granel_liquido', label: 'Perigosa granel líquido' },
  { value: 'perigosa_frigorificada', label: 'Perigosa frigorificada' },
  { value: 'perigosa_conteineirizada', label: 'Perigosa conteinerizada' },
  { value: 'perigosa_geral', label: 'Perigosa geral' },
  { value: 'granel_pressurizada', label: 'Granel pressurizada' },
];

/** Converte texto da distância QualP (ex.: "403" ou "403,5") em km. */
function parseKmQualp(str) {
  if (str == null || str === '') return null;
  let s = String(str).trim();
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Tarifa R$/km (ou valor da faixa) do cadastro de veículo conforme distância total. */
function tarifaFaixaPorKm(km, v) {
  if (!v || km == null) return null;
  const k = Number(km);
  const pick = (field) => {
    const x = v[field];
    if (x === undefined || x === null || x === '') return 0;
    const n = typeof x === 'number' ? x : parseFloat(String(x).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  if (k <= 50) return pick('tarifa_0_50');
  if (k <= 100) return pick('tarifa_51_100');
  if (k <= 150) return pick('tarifa_101_150');
  if (k <= 200) return pick('tarifa_151_200');
  if (k <= 300) return pick('tarifa_201_300');
  if (k <= 400) return pick('tarifa_301_400');
  if (k <= 500) return pick('tarifa_401_500');
  return pick('tarifa_acima_500');
}

function calcCtrbPorKmEVeiculo(km, v) {
  const rate = tarifaFaixaPorKm(km, v);
  if (rate == null || km == null) return null;
  const k = Number(km);
  let total = k * rate;
  if (k <= 50 && v?.frete_minimo_ate_50km != null && v.frete_minimo_ate_50km !== '') {
    const piso = typeof v.frete_minimo_ate_50km === 'number'
      ? v.frete_minimo_ate_50km
      : parseFloat(String(v.frete_minimo_ate_50km).replace(',', '.'));
    if (Number.isFinite(piso) && piso > 0) total = Math.max(total, piso);
  }
  return total;
}

function buildQualpPayloadFromForm(f, eixos) {
  const payload = {
    origem: String(f.origem ?? '').trim(),
    uf_origem: String(f.uf_origem ?? '').trim(),
    destino: String(f.destino ?? '').trim(),
    uf_destino: String(f.uf_destino ?? '').trim(),
    axis: eixos,
    freight_type: f.anttFreightType || 'A',
    load_type: f.anttLoadType || 'geral',
    is_empty_return: !!f.anttEmptyReturn,
  };
  if ((f.anttRetroactiveDate || '').trim()) {
    payload.retroactive_date = String(f.anttRetroactiveDate).trim();
  }
  return payload;
}

/** Compara cidade origem × cadastro Matriz ISS (maiúsculas, collapse espaços). */
function cidadeIssMatch(origemNome, cidadeCadastro) {
  const a = String(origemNome || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const b = String(cidadeCadastro || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function mergeQualpApiIntoForm(data) {
  const fmtMoedaInput = (v) =>
    typeof v === 'number' && Number.isFinite(v)
      ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '';
  const pedOk = typeof data.pedagio_total === 'number' && Number.isFinite(data.pedagio_total);
  return (prev) => ({
    ...prev,
    qualpKm: data.distancia_km != null ? String(data.distancia_km).replace('.', ',') : '',
    qualpFreteMinimoValor: data.frete_antt_minimo ?? null,
    qualpFreteMinimoVisual: fmtMoedaInput(data.frete_antt_minimo),
    ...(pedOk
      ? {
          pedagioCusto: data.pedagio_total,
          pedagioCustoVisual: fmtMoedaInput(data.pedagio_total),
        }
      : {}),
  });
}

function toDec(v, dp = 2) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** dp;
  return Math.round(n * p) / p;
}

const NovaCotacao = () => {
  const [searchParams] = useSearchParams();
  const viewId = searchParams.get('view');
  const cloneId = searchParams.get('clone');
  const isReadOnly = !!viewId && !cloneId;

  const inputRef = useRef(null);
  const ultimoMarkupSalvoRef = useRef('');
  const qualpAutoFetchSeqRef = useRef(0);

  // --- ESTADOS PARA DADOS DO DJANGO ---
  const [veiculosDoBanco, setVeiculosDoBanco] = useState([]);
  const [reboquesDoBanco, setReboquesDoBanco] = useState([]);
  const [showVeiculos, setShowVeiculos] = useState(false);
  const [showReboques, setShowReboques] = useState(false);
  const [showTabelaClienteList, setShowTabelaClienteList] = useState(false);

  const [sugestoesClientes, setSugestoesClientes] = useState([]);
  const [listaSolicitantes, setListaSolicitantes] = useState([]);
  const [listaClienteTaxas, setListaClienteTaxas] = useState([]);
  const [listaImpostos, setListaImpostos] = useState([]);
  const [listaSeguros, setListaSeguros] = useState([]);
  const [listaGris, setListaGris] = useState([]);
  const [listaDespesas, setListaDespesas] = useState([]);
  const [listaMarkupConfig, setListaMarkupConfig] = useState([]);
  const [listaMatrizIss, setListaMatrizIss] = useState([]);

  const clienteTaxasSelecionado = useRef(null);

  // --- ESTADOS DE UI ---
  const [sugestaoOrigem, setSugestaoOrigem] = useState([]);
  const [sugestaoDestino, setSugestaoDestino] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [qualpBuscando, setQualpBuscando] = useState(false);
  const [qualpErro, setQualpErro] = useState('');
  const [qualpEixosFallback, setQualpEixosFallback] = useState(5);
  /** DRE — Base lucro: recolhida por padrão; cabeçalho expande/recolhe. */
  const [dreLucroExpanded, setDreLucroExpanded] = useState(false);
  const [cotacaoSalvando, setCotacaoSalvando] = useState(false);
  const [cotacaoSalvarErro, setCotacaoSalvarErro] = useState('');
  const [cotacaoSalvaOk, setCotacaoSalvaOk] = useState('');
  const [cotacaoCarregando, setCotacaoCarregando] = useState(false);
  const [cotacaoNumero, setCotacaoNumero] = useState(null);

  // --- ESTADO DO FORMULÁRIO ---
  const [form, setForm] = useState({
    cliente: '', cliente_id: '', cliente_cnpj: '', endereco: '', cep: '', fone: '', contato: '', email: '',
    origem: '', uf_origem: '', destino: '', uf_destino: '', observacao: '',
    contratacao: 'SPOT',
    tabelaCliente: '',
    tipoVeiculo: '',
    tipoSemireboque: '',
    ctrbOrcado: 0, pedagioCusto: 0,
    valorMercadoria: 0, qtdAjudante: 0, taxaAdicionalEntrega: 0,
    percentualLairDesejada: 20,
    percentualDescontoSeguro: 0,
    /** Opcional: % K11 da planilha SPOT (ex.: 12). Se 0, usa o % de repasse D9. */
    spotK11Pct: 0,
    /** Tab.ICMS.23 via API: alíquota bruta (L11 / ALIQ.BRUTA), % sobre operação. */
    aliquotaIcms: null,
    aliquotaIcmsBruta: null,
    /** ALIQ.AREDEN: com origem em SP/PR/MG/SC/BA = bruta × 80% (planilha). */
    aliquotaIcmsReduzida: null,
    /** QualP / tabela ANTT (referência + pedágio CTRB preenchido pela consulta) */
    anttFreightType: 'A',
    anttLoadType: 'geral',
    anttEmptyReturn: false,
    anttRetroactiveDate: '',
    qualpKm: '',
    qualpFreteMinimoValor: null,
    qualpFreteMinimoVisual: '',
  });

  const [calculos, setCalculos] = useState({
    sIcms: { fretePeso: 0, seguro: 0, gris: 0, pedagio: 0, carga: 0, adicional: 0, total: 0 },
    cIcms: { fretePeso: 0, seguro: 0, gris: 0, pedagio: 0, carga: 0, adicional: 0, total: 0 },
    descSeguro: { fretePeso: 0, seguro: 0, gris: 0, pedagio: 0, carga: 0, adicional: 0, total: 0 },
    /** % LAIR = LAIR / ROL (DRE — BASE LUCRO), não margem sobre All In S/ICMS. */
    lairReal: '0.00',
    dre: null
  });

  // --- CARREGAR COTAÇÃO PARA VISUALIZAR / CLONAR ---
  useEffect(() => {
    const id = viewId || cloneId;
    if (!id) return;

    const carregarCotacao = async () => {
      setCotacaoCarregando(true);
      setCotacaoSalvarErro('');
      setCotacaoSalvaOk('');
      try {
        const base = getApiBase();
        const res = await fetch(`${base}/cotacoes/${encodeURIComponent(id)}/`);
        const text = await res.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { error: text.slice(0, 400) };
        }
        if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
        if (viewId) setCotacaoNumero(data?.id ?? Number(viewId) ?? null);
        if (cloneId) setCotacaoNumero(null);

        setForm((f) => ({
          ...f,
          cliente_id: data.cliente_id ?? '',
          cliente: data.cliente_nome ?? '',
          cliente_cnpj: data.cliente_cnpj ?? '',
          contato: data.solicitante_nome ?? '',
          email: data.solicitante_email ?? '',
          fone: data.solicitante_telefone ?? '',
          origem: data.origem ?? '',
          uf_origem: data.uf_origem ?? '',
          destino: data.destino ?? '',
          uf_destino: data.uf_destino ?? '',
          observacao: data.observacao ?? '',
          contratacao: data.contratacao ?? data.tipo ?? 'SPOT',
          tabelaCliente: data.tabela_cliente ?? f.tabelaCliente,
          tipoVeiculo: data.tipo_veiculo ?? '',
          tipoSemireboque: data.tipo_semireboque ?? '',
          ctrbOrcado: Number(data.ctrb_orcado ?? 0) || 0,
          pedagioCusto: Number(data.pedagio_utilizado ?? 0) || 0,
          valorMercadoria: Number(data.valor_mercadoria ?? 0) || 0,
          qtdAjudante: Number(data.qtd_ajudante ?? 0) || 0,
          taxaAdicionalEntrega: Number(data.taxa_adicional_entrega ?? 0) || 0,
          percentualLairDesejada: Number(data.lair_desejada ?? f.percentualLairDesejada ?? 20) || 20,
          percentualDescontoSeguro: Number(data.ajuste_comercial_pct ?? 0) || 0,
          spotK11Pct: Number(data.spot_k11_pct ?? 0) || 0,
          aliquotaIcmsBruta: data.aliquota_bruta ?? f.aliquotaIcmsBruta,
          aliquotaIcmsReduzida: data.aliquota_reduzida ?? f.aliquotaIcmsReduzida,
          anttFreightType: data.antt_freight_type ?? 'A',
          anttLoadType: data.antt_load_type ?? 'geral',
          anttEmptyReturn: !!data.antt_empty_return,
          anttRetroactiveDate: data.antt_retroactive_date ?? '',
          qualpKm: data.distancia_km != null ? String(data.distancia_km).replace('.', ',') : '',
          qualpFreteMinimoValor: data.frete_minimo_antt ?? null,
          qualpFreteMinimoVisual: data.frete_minimo_antt != null ? String(data.frete_minimo_antt) : '',
        }));

        setCalculos((c) => ({
          ...c,
          sIcms: {
            ...c.sIcms,
            fretePeso: Number(data.frete_peso_sicms ?? 0) || 0,
            seguro: Number(data.seguro_sicms ?? 0) || 0,
            gris: Number(data.gris_sicms ?? 0) || 0,
            pedagio: Number(data.pedagio_sicms ?? 0) || 0,
            carga: 0,
            adicional: Number(data.outros_sicms ?? 0) || 0,
            total: Number(data.frete_all_in_sicms ?? 0) || 0,
          },
          cIcms: {
            ...c.cIcms,
            fretePeso: Number(data.frete_peso_cicms ?? 0) || 0,
            seguro: Number(data.seguro_cicms ?? 0) || 0,
            gris: Number(data.gris_cicms ?? 0) || 0,
            pedagio: Number(data.pedagio_cicms ?? 0) || 0,
            carga: 0,
            adicional: Number(data.outros_cicms ?? 0) || 0,
            total: Number(data.frete_all_in_cicms ?? 0) || 0,
          },
        }));
      } catch (e) {
        setCotacaoSalvarErro(e.message || String(e));
      } finally {
        setCotacaoCarregando(false);
      }
    };

    carregarCotacao();
  }, [viewId, cloneId]);

  // --- 1. CARREGAMENTO INICIAL (VEÍCULOS E REBOQUES) ---
  useEffect(() => {
    const carregarListas = async () => {
      try {
        const [dataV, dataS, dataCT, dataImp, dataSeg, dataGris, dataDesp, dataMk, dataIss] =
          await Promise.all([
            fetchJsonList('/veiculos/'),
            fetchJsonList('/semireboques/'),
            fetchJsonList('/cliente-taxas-config/'),
            fetchJsonList('/impostos/'),
            fetchJsonList('/seguros/'),
            fetchJsonList('/gris/'),
            fetchJsonList('/despesas-operacionais/'),
            fetchJsonList('/markup-config/'),
            fetchJsonList('/matriz-iss/'),
          ]);

        setVeiculosDoBanco(dataV);
        setReboquesDoBanco(dataS);
        setListaClienteTaxas(dataCT);
        setListaImpostos(dataImp);
        setListaSeguros(dataSeg);
        setListaGris(dataGris);
        setListaDespesas(dataDesp);
        setListaMarkupConfig(dataMk);
        setListaMatrizIss(Array.isArray(dataIss) ? dataIss : []);

        if (dataCT.length > 0) {
          setForm(f => ({ ...f, tabelaCliente: dataCT[0].nome_cliente }));
          clienteTaxasSelecionado.current = dataCT[0];
        }
      } catch (error) {
        console.error("Erro ao carregar dados do Django:", error);
      }
    };
    carregarListas();
  }, []);

  /** Padrões QualP (Configuração sistema). */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/qualp-config/`);
        const c = await res.json();
        if (!res.ok) return;
        if (typeof c.eixos_padrao === 'number' && Number.isFinite(c.eixos_padrao)) {
          setQualpEixosFallback(c.eixos_padrao);
        }
        setForm((f) => ({
          ...f,
          anttLoadType: c.tipo_carga_padrao || f.anttLoadType,
          anttFreightType: c.tipo_tabela_frete_padrao || f.anttFreightType,
          anttEmptyReturn: c.retorno_vazio_padrao ?? f.anttEmptyReturn,
        }));
      } catch {
        /* ignorar se API off-line */
      }
    })();
  }, []);


// Busca Clientes (Nome ou CNPJ)
  const buscaClientesPelaApi = async (termo) => {
    if (termo.length < 3) { setSugestoesClientes([]); return; }
    try {
      const data = await fetchJsonList(`/clientes/?search=${encodeURIComponent(termo)}`);
      setSugestoesClientes(data);
    } catch (error) { console.error("Erro clientes:", error); }
  };
  
  // Quando seleciona o cliente, já buscamos os solicitantes dele
  const selecionarCliente = async (c) => {
    setForm({
      ...form,
      cliente: c.nome_empresa,
      cliente_id: c.id,
      cliente_cnpj: c.cnpj || '',
      endereco: c.endereco || '',
      cep: c.cep || '',
      fone: c.telefone || '',
      email: c.email || ''
    });
    setSugestoesClientes([]);

    // tenta aplicar automaticamente a tabela do cliente (ClienteTaxasConfig)
    const nome = (c?.nome_empresa || '').toUpperCase().trim();
    const cfg = listaClienteTaxas.find(x => (x?.nome_cliente || '').toUpperCase().trim() === nome);
    if (cfg) {
      clienteTaxasSelecionado.current = cfg;
      setForm(prev => ({ ...prev, tabelaCliente: cfg.nome_cliente }));
    }
    
    // Busca os solicitantes vinculados a este cliente específico
    try {
      const data = await fetchJsonList(`/solicitantes/?cliente=${encodeURIComponent(c.id)}`);
      setListaSolicitantes(data);
    } catch (error) { console.error("Erro solicitantes:", error); }
  };
  
  const buscaCidades = async (termo, setSugestao) => {
    if (termo.length < 3) {
      setSugestao([]);
      return;
    }
    try {
      const filtrados = await buscarMunicipiosPorTermo(termo, 6);
      setSugestao(filtrados);
    } catch (error) {
      console.error(error);
    }
  };

  const selecionarCidade = (item, tipo) => {
    if (tipo === 'origem') {
      setForm({ ...form, origem: item.cidade, uf_origem: item.uf });
      setSugestaoOrigem([]);
    } else {
      setForm({ ...form, destino: item.cidade, uf_destino: item.uf });
      setSugestaoDestino([]);
    }
  };

  /**
   * ALIQ.BRUTA: PROCV na tabela ICMS (API /icms/) — espelha Tab.ICMS.23 com I11/J11 = UF origem/destino.
   * ALIQ.AREDEN: se origem ∈ {SP,PR,MG,SC,BA}, alíquota da tabela × 80%; senão igual à bruta.
   * Planilha: vazio se C11/D11 vazios → aqui exige cidade origem, cidade destino e ambas as UFs.
   */
  useEffect(() => {
    const origemUf = (form.uf_origem || '').toUpperCase().trim();
    const destUf = (form.uf_destino || '').toUpperCase().trim();
    const cidadeOrigem = (form.origem || '').trim();
    const cidadeDestino = (form.destino || '').trim();

    if (!cidadeOrigem || !cidadeDestino || !origemUf || !destUf) {
      setForm((prev) => ({
        ...prev,
        aliquotaIcms: null,
        aliquotaIcmsBruta: null,
        aliquotaIcmsReduzida: null
      }));
      return;
    }

    const carregarIcms = async () => {
      try {
        const data = await fetchJsonList(`/icms/?origem=${encodeURIComponent(origemUf)}`);
        const achou = (data || []).find((r) => (r.destino || '').toUpperCase() === destUf);
        /** Bruta = célula da matriz (mesmo bloco A2:AB28; faixa “interna” A32:AB58 não existe na API — usa a mesma alíquota). */
        const bruta = achou ? Number(achou.aliquota) : 12;
        const UFsOrigemReduz80 = new Set(['SP', 'PR', 'MG', 'SC', 'BA']);
        const reduzida = UFsOrigemReduz80.has(origemUf)
          ? Math.round(bruta * 0.8 * 100) / 100
          : bruta;

        setForm((prev) => ({
          ...prev,
          aliquotaIcms: bruta,
          aliquotaIcmsBruta: bruta,
          aliquotaIcmsReduzida: reduzida
        }));
      } catch (e) {
        console.error('Erro ICMS:', e);
      }
    };

    carregarIcms();
  }, [form.uf_origem, form.uf_destino, form.origem, form.destino]);

  // Salva (idempotente) BASE + LAIR no cadastro de Markup (por cliente)
  useEffect(() => {
    const nomeCliente = (form.tabelaCliente || '').toString().trim().toUpperCase();
    const brutaPct = form.aliquotaIcmsBruta;
    if (!nomeCliente || brutaPct == null || brutaPct === '') return;

    const lairDesejada = Number(form.percentualLairDesejada);
    if (!Number.isFinite(lairDesejada) || lairDesejada <= 0) return;

    const reduzidaPct = Number(form.aliquotaIcmsReduzida ?? 0);
    if (!Number.isFinite(reduzidaPct)) return;

    const almostEq = (a, b, eps = 0.02) => Math.abs(Number(a) - Number(b)) <= eps;

    // Funil dinâmico (bruta/reduzida) => percentual base (em %)
    const basePctFromAliquotas = (kPct, lPct) => {
      const k = Number(kPct);
      const l = Number(lPct);
      // pares casados
      if (almostEq(k, 20) && almostEq(l, 20)) return 59.19;
      if (almostEq(k, 18) && almostEq(l, 18)) return 57.42;
      if (almostEq(k, 3) && almostEq(l, 3)) return 57.55;
      if (almostEq(k, 7) && almostEq(l, 7)) return 57.53;
      if (almostEq(k, 12) && almostEq(l, 12)) return 57.48;
      // fallback só por L (bruta)
      if (almostEq(l, 17)) return 57.43;
      if (almostEq(l, 12)) return 59.23;
      if (almostEq(l, 7)) return 58.50;
      if (almostEq(l, 0)) return 57.59;
      if (almostEq(l, 5)) return 57.55;
      return null;
    };

    const basePct = basePctFromAliquotas(reduzidaPct, Number(brutaPct));
    if (basePct == null) return;

    const chave = `${nomeCliente}||${lairDesejada.toFixed(2)}||${Number(brutaPct).toFixed(2)}||${reduzidaPct.toFixed(2)}||${basePct.toFixed(2)}`;
    if (ultimoMarkupSalvoRef.current === chave) return;

    const salvar = async () => {
      try {
        const base = getApiBase();
        const res = await fetch(`${base}/markup-config/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome_cliente: nomeCliente,
            percentual_markup: lairDesejada,
            percentual_base: basePct,
            aliquota_bruta: Number(brutaPct),
            aliquota_reduzida: reduzidaPct,
          }),
        });
        if (res.ok) {
          ultimoMarkupSalvoRef.current = chave;
        } else {
          // Mesmo se falhar, evita loop frenético; libera em mudanças futuras.
          ultimoMarkupSalvoRef.current = chave;
          // console para depuração
          try {
            const t = await res.text();
            console.error('[MARKUP] erro ao salvar', res.status, t);
          } catch {}
        }
      } catch (e) {
        console.error('[MARKUP] falha rede', e);
      }
    };

    salvar();
  }, [form.tabelaCliente, form.aliquotaIcmsBruta, form.aliquotaIcmsReduzida, form.percentualLairDesejada]);




  // --- LÓGICA DE CÁLCULO (espelho das fórmulas da planilha "Bases" / SPOT) ---
  useEffect(() => {
    const normalizarNumero = (v) => {
      if (v === null || v === undefined || v === '') return 0;
      if (typeof v === 'string') {
        const n = parseFloat(v.toString().replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
      }
      return Number.isFinite(Number(v)) ? Number(v) : 0;
    };

    const cfg = clienteTaxasSelecionado.current;

    const impostosMap = new Map(
      (listaImpostos || [])
        .filter(i => i?.nome)
        .map(i => [i.nome.toUpperCase().trim(), normalizarNumero(i.aliquota)])
    );

    /** Bases!$D$9 — alíquota total sobre repasse de pedágio (só PIS/COFINS + IR + CPRB, sem ICMS). */
    const taxaRepassePedagioD9 = () => {
      const nomesTotal = ['PIS/COFINS/CPRB/TX', 'PIS/COFINS/CPRB', 'TOTAL PIS/COFINS/CPRB/TX'];
      for (const n of nomesTotal) {
        const v = impostosMap.get(n);
        if (v > 0) return v / 100;
      }
      const pisCofSum = (impostosMap.get('PIS') || 0) + (impostosMap.get('COFINS') || 0);
      const pis = pisCofSum > 0 ? pisCofSum : impostosMap.get('PIS/COFINS') || 0;
      const ir = impostosMap.get('IR/CSLL') || 0;
      const cprb = impostosMap.get('CPRB') || 0;
      return (pis + ir + cprb) / 100;
    };

    let d9 = taxaRepassePedagioD9();
    /** Zera ou muito abaixo do consolidado da planilha (~9,75%) → usa Bases!D9 típico para pedágio. */
    if (d9 < 0.0001 || (d9 > 0 && d9 < 0.065)) d9 = 0.0975;

    /** C/ICMS na planilha usa ALIQ.BRUTA (L11), não a reduzida. */
    const brutaPct =
      form.aliquotaIcms != null && form.aliquotaIcms !== ''
        ? normalizarNumero(form.aliquotaIcms)
        : 0;
    const aliquotaIcmsFrac = brutaPct / 100;
    const L11 = aliquotaIcmsFrac;
    /** K11 = ALIQ.RED na planilha; manual override ou alíquota reduzida da rota, senão % repasse D9. */
    const k11PctManual = normalizarNumero(form.spotK11Pct);
    const reduzidaParaK =
      form.aliquotaIcmsReduzida != null && form.aliquotaIcmsReduzida !== ''
        ? normalizarNumero(form.aliquotaIcmsReduzida)
        : 0;
    const k11Pct =
      k11PctManual > 0 ? k11PctManual : reduzidaParaK > 0 ? reduzidaParaK : Math.round(d9 * 10000) / 100;
    const l11Pct = brutaPct;

    const grossUpIcms = (valorSIcms) => {
      if (valorSIcms === 0) return 0;
      if (L11 <= 0) return valorSIcms;
      return valorSIcms / (1 - L11);
    };

    const mercadoria = normalizarNumero(form.valorMercadoria);
    const limiteMercadoria = normalizarNumero(cfg?.valor_mercadoria_limite);
    const seguroTx1 = normalizarNumero(cfg?.seguro_taxa_1);
    const seguroTx2 = normalizarNumero(cfg?.seguro_taxa_2);

    const taxasSeguroPositivas = [seguroTx1, seguroTx2].filter((x) => x > 0);
    const pisoMinTaxas = taxasSeguroPositivas.length ? Math.min(...taxasSeguroPositivas) : 0;

    /** Seguro S/ICMS: SE(C23=0;0;SE(C28<Bases!C35;C23*C35;C23*C28)) ≡ max(C28, C35) em % sobre a mercadoria. */
    const pctSeguroAplicada = limiteMercadoria > 0 && mercadoria > limiteMercadoria ? seguroTx2 : seguroTx1;
    const pctSeguroFinal = mercadoria === 0 ? 0 : Math.max(pctSeguroAplicada, pisoMinTaxas);
    const seguroSIcms = mercadoria === 0 ? 0 : (mercadoria * pctSeguroFinal) / 100;

    /** GRIS S/ICMS: SE(C23=0;0;SE(C29<Bases!D35;C23*D35;C23*C29)) — C29 = taxa 2, piso = min das taxas cadastradas. */
    const pctGrisAplicada = seguroTx2;
    const pctGrisFinal = mercadoria === 0 ? 0 : Math.max(pctGrisAplicada, pisoMinTaxas);
    const grisSIcms = mercadoria === 0 ? 0 : (mercadoria * pctGrisFinal) / 100;

    const pedagioCusto = normalizarNumero(form.pedagioCusto);
    /** Pedágio S/ICMS: C21/(1-Bases!$D$9) */
    const pedagioSIcms =
      pedagioCusto === 0 ? 0 : d9 >= 1 ? pedagioCusto : pedagioCusto / (1 - d9);

    /**
     * Pedágio C/ICMS (planilha):
     * =SE(C21=0;0;SE(L11=0;H20;SE(I11="PR";H20;H20/(1-L11))))
     * Onde:
     * - C21 = pedágio custo (entrada)
     * - H20 = pedágio S/ICMS (já calculado acima)
     * - L11 = alíquota bruta (fração)
     * - I11 = UF origem
     */
    const origemUf = (form.uf_origem || '').toUpperCase().trim();
    const pedagioCIcms =
      pedagioCusto === 0
        ? 0
        : L11 <= 0 || origemUf === 'PR'
          ? pedagioSIcms
          : pedagioSIcms / (1 - L11);

    const ajudanteUnit = cfg ? normalizarNumero(cfg.valor_ajudante) : 280;
    const qtdAjud = normalizarNumero(form.qtdAjudante);
    /** Carga/descarga: C24 * Bases!$S$5 */
    const cargaSIcms = qtdAjud === 0 ? 0 : qtdAjud * ajudanteUnit;

    const tipoV = (form.tipoVeiculo || '').toUpperCase();
    let taxaEntregaI22 = 0;
    if (cfg) {
      if (tipoV.includes('UTIL')) taxaEntregaI22 = normalizarNumero(cfg.taxa_utilitarios);
      else if (tipoV.includes('3/4')) taxaEntregaI22 = normalizarNumero(cfg.taxa_3_4);
      else if (tipoV.includes('TOCO')) taxaEntregaI22 = normalizarNumero(cfg.taxa_toco);
      else if (tipoV.includes('TRUCK')) taxaEntregaI22 = normalizarNumero(cfg.taxa_truck);
      else if (tipoV.includes('4X2')) taxaEntregaI22 = normalizarNumero(cfg.taxa_cavalo_4x2);
      else if (tipoV.includes('6X2')) taxaEntregaI22 = normalizarNumero(cfg.taxa_cavalo_6x2);
    }
    const fatorAdicionalC25 = normalizarNumero(form.taxaAdicionalEntrega);
    /** Adicional entrega: I22*C25 (C25 = 0 zera; use 1 para aplicar só a taxa do veículo). */
    const adicionalSIcms = fatorAdicionalC25 === 0 ? 0 : taxaEntregaI22 * fatorAdicionalC25;

    const ctrb = normalizarNumero(form.ctrbOrcado);
    const lairDesejada = normalizarNumero(form.percentualLairDesejada);
    const nomeTabela = (form.tabelaCliente || cfg?.nome_cliente || '').toString().trim().toUpperCase();

    /**
     * FRETE PESO S/ICMS (igual Excel):
     * =SE(C26=20%; I17/Bases!U5; SE(C26=18%; I17/Bases!U6; ...))
     *
     * - C26 = % LAIR Desejada (form.percentualLairDesejada)
     * - I17 = CTRB Orçado (form.ctrbOrcado)
     * - U (U5..U9) vem do cadastro por cliente/faixa (tabela Markup em Configurações)
     *
     * Observação: valor da mercadoria NÃO entra no frete peso.
     */
    const markupRows = (listaMarkupConfig || []).filter(
      (m) => (m?.nome_cliente || '').toString().trim().toUpperCase() === nomeTabela && nomeTabela !== ''
    );

    const reduzidaPctAtual =
      form.aliquotaIcmsReduzida != null && form.aliquotaIcmsReduzida !== ''
        ? normalizarNumero(form.aliquotaIcmsReduzida)
        : k11Pct;

    const almostEq = (a, b, eps = 0.02) => Math.abs(normalizarNumero(a) - normalizarNumero(b)) <= eps;

    const faixaMatch = markupRows.find((m) => {
      const lairOk = almostEq(m?.percentual_markup, lairDesejada);
      const brutaOk = almostEq(m?.aliquota_bruta, brutaPct);
      const redOk = almostEq(m?.aliquota_reduzida, reduzidaPctAtual);
      return lairOk && brutaOk && redOk;
    });

    // 1) Preferência: percentual operacional (U5..U9 da planilha) vindo do banco em percentual_base
    //    Pode estar como % (ex.: 59.19) ou como fração (ex.: 0.5919)
    const baseDb = normalizarNumero(faixaMatch?.percentual_base);
    let pctOperFrac =
      Number.isFinite(baseDb) && baseDb > 1 && baseDb <= 100
        ? baseDb / 100
        : Number.isFinite(baseDb) && baseDb > 0 && baseDb <= 1
          ? baseDb
          : 0;

    // 2) Se não tiver no banco: calcula pelo "funil" (bruta/reduzida)
    if (!(pctOperFrac > 0)) {
      const basePctFromAliquotas = (kPct, lPct) => {
        const k = normalizarNumero(kPct);
        const l = normalizarNumero(lPct);
        if (almostEq(k, 20) && almostEq(l, 20)) return 59.19;
        if (almostEq(k, 18) && almostEq(l, 18)) return 57.42;
        if (almostEq(k, 3) && almostEq(l, 3)) return 57.55;
        if (almostEq(k, 7) && almostEq(l, 7)) return 57.53;
        if (almostEq(k, 12) && almostEq(l, 12)) return 57.48;
        if (almostEq(l, 17)) return 57.43;
        if (almostEq(l, 12)) return 59.23;
        if (almostEq(l, 7)) return 58.50;
        if (almostEq(l, 0)) return 57.59;
        if (almostEq(l, 5)) return 57.55;
        return 0;
      };

      const basePct = basePctFromAliquotas(reduzidaPctAtual, brutaPct);
      pctOperFrac = basePct > 1 ? basePct / 100 : basePct > 0 ? basePct : 0;
    }

    // 3) Fallback final: mapa padrão por LAIR (se você cadastrar esses valores como % em Config, isso vira desnecessário)
    if (!(pctOperFrac > 0)) {
      const keys = [20, 18, 15, 12, 10];
      const k = keys.find((x) => Math.abs(x - lairDesejada) < 0.02);
      const fallbackW = k != null ? DIVERSOS_LAIR_DIVISORES_PADRAO[k] : DIVERSOS_LAIR_DIVISORES_PADRAO[20];
      // compat: se ainda estiver na tabela antiga (1.201...), não tenta usar como divisor de percentual
      pctOperFrac = 0;
    }

    // Excel: I17 / U$X (U é percentual operacional em fração)
    const fretePesoSIcms = ctrb === 0 ? 0 : pctOperFrac > 0 ? ctrb / pctOperFrac : 0;

    const sIcmsBase = {
      fretePeso: fretePesoSIcms,
      seguro: seguroSIcms,
      gris: grisSIcms,
      pedagio: pedagioSIcms,
      carga: cargaSIcms,
      adicional: adicionalSIcms,
      total: 0
    };
    sIcmsBase.total =
      sIcmsBase.fretePeso +
      sIcmsBase.seguro +
      sIcmsBase.gris +
      sIcmsBase.pedagio +
      sIcmsBase.carga +
      sIcmsBase.adicional;

    const f28 = normalizarNumero(form.percentualDescontoSeguro) / 100;
    const fatorDesc = Math.max(0, 1 - f28);

    /** Ajuste comercial: desconto em frete peso, seguro e GRIS (impacta S/ICMS, C/ICMS e proposta). */
    const sIcms = {
      fretePeso: sIcmsBase.fretePeso * fatorDesc,
      seguro: sIcmsBase.seguro * fatorDesc,
      gris: sIcmsBase.gris * fatorDesc,
      pedagio: sIcmsBase.pedagio,
      carga: sIcmsBase.carga,
      adicional: sIcmsBase.adicional,
      total: 0
    };
    sIcms.total = sIcms.fretePeso + sIcms.seguro + sIcms.gris + sIcms.pedagio + sIcms.carga + sIcms.adicional;

    const cIcms = {
      fretePeso: grossUpIcms(sIcms.fretePeso),
      seguro: grossUpIcms(sIcms.seguro),
      gris: grossUpIcms(sIcms.gris),
      pedagio: pedagioCIcms,
      carga: grossUpIcms(sIcms.carga),
      adicional: grossUpIcms(sIcms.adicional),
      total: 0
    };
    cIcms.total = cIcms.fretePeso + cIcms.seguro + cIcms.gris + cIcms.pedagio + cIcms.carga + cIcms.adicional;

    /** Coluna proposta (3): igual S/ICMS já ajustado. */
    const descSeguro = { ...sIcms };

    /** --- DRE BASE LUCRO (regras novas / espelho do Excel) --- */
    const rob = cIcms.fretePeso + cIcms.seguro + cIcms.gris;

    const pis = impostosMap.get('PIS') || 0;
    const cofins = impostosMap.get('COFINS') || 0;
    const pisCofinsPct = pis > 0 || cofins > 0 ? pis + cofins : impostosMap.get('PIS/COFINS') || 0;
    const cprbPct = impostosMap.get('CPRB') || 0;

    const despPctByNome = (nomeExato) => {
      const alvo = String(nomeExato || '').toUpperCase().trim();
      for (const d of listaDespesas || []) {
        if ((d?.unidade || '').toUpperCase() !== 'PERCENTUAL') continue;
        const nm = String(d?.nome || '').toUpperCase().trim();
        if (nm === alvo) return normalizarNumero(d.valor);
      }
      return 0;
    };
    const cgoPct = despPctByNome('CGO'); // % sobre ROL
    const despAdmPct = despPctByNome('DESP.ADM'); // %
    const financeiroPct = despPctByNome('FINANCEIRO'); // %

    // ICMS do Frete All In (referência do card ICMS/ISS)
    const origemUfDre = (form.uf_origem || '').toUpperCase().trim();
    const baseIcmsAllIn =
      origemUfDre === 'PR'
        ? Math.max(0, (Number(cIcms.total) || 0) - (Number(cIcms.pedagio) || 0))
        : Math.max(0, Number(sIcms.total) || 0);
    const aliqBrutaPct = brutaPct > 0 ? brutaPct : 0;
    const icmsAllInValor = aliqBrutaPct > 0 ? baseIcmsAllIn * (aliqBrutaPct / 100) : 0;

    // (-) ICMS/ISS (DRE): ROB × alíquota reduzida (fica negativo e em vermelho)
    const reduzidaDrePct =
      form.aliquotaIcmsReduzida != null && form.aliquotaIcmsReduzida !== ''
        ? normalizarNumero(form.aliquotaIcmsReduzida)
        : 0;
    const icmsIss = -(rob * (reduzidaDrePct / 100));

    // (-) IMP.FED = ((ROB - ICMS_AllIn) * (PIS+COFINS) + (ROB * CPRB)) * -1
    const impFed =
      -(
        (rob - icmsAllInValor) * (pisCofinsPct / 100) +
        rob * (cprbPct / 100)
      );

    // % (+) CREDITO = (PIS+COFINS) * 75%
    const creditoPct = pisCofinsPct * 0.75;
    const credito = ctrb * (creditoPct / 100);

    // ROL = ROB + (-ICMS/ISS) + (-IMP.FED) + (+) CREDITO
    // (ICMS/ISS e IMP.FED já estão negativos)
    const rol = rob + icmsIss + impFed + credito;

    // C.V = CTRB * -1
    const cv = -ctrb;
    // C.F = (ROL * CGO) * -1
    const cf = -(rol * (cgoPct / 100));
    // CSP = C.V + C.F
    const csp = cv + cf;

    // L.O = ROL + CSP  (CSP já é negativo)
    const lo = rol + csp;

    // % DESP./FIN. = (DESP.ADM + FINANCEIRO) * -1
    const despFinPct = -((despAdmPct + financeiroPct) / 100);
    const despFin = rol * despFinPct; // já negativo

    // LAIR = L.O - DESP./FIN.  (despFin já vem negativo)
    const lairValor = lo + despFin;
    const lairPct = rol !== 0 ? (lairValor / rol) * 100 : 0;

    let dre = null;
    let lairPctStr = '0.00';
    if (rob > 0 && ctrb > 0) {
      lairPctStr = Number.isFinite(lairPct) ? lairPct.toFixed(2) : '0.00';
      dre = {
        rob,
        icmsIss,
        impFed,
        credito,
        rol,
        cv,
        cf,
        csp,
        lo,
        despFin,
        lairValor,
        lairPct,
        // extras p/ exibir percentuais “não relativos”
        creditoPct,
        despFinPct: despFinPct * 100,
        reduzidaDrePct,
      };
    }



    setCalculos({ sIcms, cIcms, descSeguro, lairReal: lairPctStr, dre });
  }, [form, listaImpostos, listaMarkupConfig, listaDespesas]);

  /** Eixos QualP = `eixos_veiculo` do cadastro Veiculo (novacotacao.Veiculo); senão padrão da config. sistema */
  const eixosConsultaQualp = useMemo(() => {
    const clamp = (n) => {
      const x = Math.round(Number(n));
      const fb = qualpEixosFallback;
      if (!Number.isFinite(x)) return Math.min(9, Math.max(2, fb));
      return Math.min(9, Math.max(2, x));
    };
    const tv = String(form.tipoVeiculo || '').trim();
    const vRow = veiculosDoBanco.find((x) => String(x.tipo_veiculo || '').trim() === tv);
    if (vRow != null && Number(vRow.eixos_veiculo) >= 2) {
      return clamp(vRow.eixos_veiculo);
    }
    return clamp(qualpEixosFallback);
  }, [form.tipoVeiculo, veiculosDoBanco, qualpEixosFallback]);

  /**
   * Ao selecionar o tipo de veículo, consulta a QualP (km, frete mín. ANTT, pedágio) se a rota já estiver preenchida.
   * Só reage a `tipoVeiculo` para não disparar a API a cada tecla em origem/destino; use o botão "Buscar" nesses casos.
   */
  useEffect(() => {
    const tv = String(form.tipoVeiculo || '').trim();
    if (!tv) return;
    if (!(form.origem || '').trim() || !(form.uf_origem || '').trim()) return;
    if (!(form.destino || '').trim() || !(form.uf_destino || '').trim()) return;

    const seq = ++qualpAutoFetchSeqRef.current;
    setQualpErro('');
    setQualpBuscando(true);
    const payload = buildQualpPayloadFromForm(form, eixosConsultaQualp);

    (async () => {
      try {
        const data = await fetchJsonPost('/qualp/consulta/', payload);
        if (seq !== qualpAutoFetchSeqRef.current) return;
        setForm(mergeQualpApiIntoForm(data));
      } catch (e) {
        if (seq !== qualpAutoFetchSeqRef.current) return;
        setQualpErro(e.message || String(e));
      } finally {
        if (seq === qualpAutoFetchSeqRef.current) setQualpBuscando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- disparo intencional só na troca de veículo
  }, [form.tipoVeiculo]);

  /** CTRB orçado = distância rota × tarifa da faixa (cadastro do veículo selecionado). */
  useEffect(() => {
    const km = parseKmQualp(form.qualpKm);
    const tv = String(form.tipoVeiculo || '').trim();
    const v = veiculosDoBanco.find((x) => String(x.tipo_veiculo || '').trim() === tv);
    if (km == null || !v) return;
    const ctrb = calcCtrbPorKmEVeiculo(km, v);
    if (ctrb == null || !Number.isFinite(ctrb)) return;
    const visual = ctrb.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    setForm((prev) => {
      if (prev.ctrbOrcado === ctrb && prev.ctrbOrcadoVisual === visual) return prev;
      return { ...prev, ctrbOrcado: ctrb, ctrbOrcadoVisual: visual };
    });
  }, [form.qualpKm, form.tipoVeiculo, veiculosDoBanco]);

  const ctrbCardAlerta = useMemo(() => {
    const ctrb = Number(form.ctrbOrcado);
    const minimo = form.qualpFreteMinimoValor;
    if (minimo == null || minimo === '' || !Number.isFinite(Number(minimo))) return 'neutral';
    const c = Number.isFinite(ctrb) ? ctrb : 0;
    const m = Number(minimo);
    if (!Number.isFinite(m)) return 'neutral';
    if (c < m) return 'below';
    return 'above';
  }, [form.ctrbOrcado, form.qualpFreteMinimoValor]);

  const ctrbTarifaUsada = useMemo(() => {
    const km = parseKmQualp(form.qualpKm);
    if (km == null) return null;
    const v = (veiculosDoBanco || []).find((x) => String(x?.tipo_veiculo || '') === String(form.tipoVeiculo || ''));
    if (!v) return null;
    const rate = tarifaFaixaPorKm(km, v);
    return rate == null || !Number.isFinite(Number(rate)) ? null : Number(rate);
  }, [form.qualpKm, form.tipoVeiculo, veiculosDoBanco]);

  /**
   * Base tributável (ICMS): PR → (Frete All In C/ICMS − pedágio C/ICMS); demais UF → Frete All In col. proposta (3).
   * ICMS = base × alíquota bruta. ISS = mesma base × alíquota da cidade (Matriz ISS), se houver cadastro.
   */
  const icmsIssOrcamento = useMemo(() => {
    const pctNum = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };
    const origemUf = (form.uf_origem || '').toUpperCase().trim();
    const brutaPct = pctNum(form.aliquotaIcmsBruta ?? form.aliquotaIcms);
    const allInSIcmsTot = Number(calculos.sIcms.total) || 0;
    const allInCIcmsTot = Number(calculos.cIcms.total) || 0;
    const pedCIcms = Number(calculos.cIcms.pedagio) || 0;

    /** PR: (All In C/ICMS − pedágio C/ICMS); demais UF: All In S/ICMS (col. 1) × L11 inteiro sobre esse total. */
    const base =
      origemUf === 'PR'
        ? Math.max(0, allInCIcmsTot - pedCIcms)
        : Math.max(0, allInSIcmsTot);

    let issPct = null;
    let issRegistro = null;
    const origNome = form.origem;
    if (listaMatrizIss?.length && String(origNome || '').trim()) {
      issRegistro = listaMatrizIss.find((row) =>
        cidadeIssMatch(origNome, row.cidade)
      );
      if (issRegistro?.aliquota != null && issRegistro?.aliquota !== '') {
        issPct = pctNum(issRegistro.aliquota);
      }
    }

    const icmsValor =
      brutaPct != null && brutaPct > 0 ? base * (brutaPct / 100) : null;
    const issValor =
      issPct != null && issPct > 0 ? base * (issPct / 100) : null;

    return {
      origemUf,
      base,
      regra: origemUf === 'PR' ? 'PR' : 'outra_uf',
      brutaPct,
      icmsValor,
      issPct,
      issValor,
      issCidadeCadastro: issRegistro?.cidade || null,
    };
  }, [form.uf_origem, form.origem, form.aliquotaIcms, form.aliquotaIcmsBruta, calculos, listaMatrizIss]);

  const consultarQualp = async () => {
    setQualpErro('');
    if (!(form.origem || '').trim() || !(form.uf_origem || '').trim()) {
      setQualpErro('Informe cidade e UF de origem para consultar a QualP.');
      return;
    }
    if (!(form.destino || '').trim() || !(form.uf_destino || '').trim()) {
      setQualpErro('Informe cidade e UF de destino para consultar a QualP.');
      return;
    }
    if (!String(form.tipoVeiculo || '').trim()) {
      setQualpErro('Selecione o tipo de veículo (eixos vêm do cadastro de veículo).');
      return;
    }
    const seq = ++qualpAutoFetchSeqRef.current;
    setQualpBuscando(true);
    try {
      const payload = buildQualpPayloadFromForm(form, eixosConsultaQualp);
      const data = await fetchJsonPost('/qualp/consulta/', payload);
      if (seq !== qualpAutoFetchSeqRef.current) return;
      setForm(mergeQualpApiIntoForm(data));
    } catch (e) {
      if (seq !== qualpAutoFetchSeqRef.current) return;
      setQualpErro(e.message || String(e));
    } finally {
      if (seq === qualpAutoFetchSeqRef.current) setQualpBuscando(false);
    }
  };

  const salvarCotacao = async () => {
    setCotacaoSalvarErro('');
    setCotacaoSalvaOk('');

    // validação mínima
    if (!String(form.cliente || '').trim()) {
      setCotacaoSalvarErro('Informe o cliente antes de salvar.');
      return;
    }
    if (!String(form.contato || '').trim()) {
      setCotacaoSalvarErro('Selecione/Confirme o solicitante antes de salvar.');
      return;
    }
    if (!String(form.origem || '').trim() || !String(form.destino || '').trim()) {
      setCotacaoSalvarErro('Informe origem e destino antes de salvar.');
      return;
    }

    setCotacaoSalvando(true);
    try {
      const payload = {
        tipo: String(form.contratacao || 'SPOT').toUpperCase() === 'DEDICADO'
          ? 'DEDICADO'
          : String(form.contratacao || 'SPOT').toUpperCase() === 'FAIXA_KM'
            ? 'FAIXA_KM'
            : 'SPOT',
        cliente_id: form.cliente_id || null,
        cliente_nome: form.cliente || '',
        cliente_cnpj: form.cliente_cnpj || '',
        solicitante_nome: form.contato || '',
        solicitante_email: form.email || '',
        solicitante_telefone: form.fone || '',
        origem: form.origem || '',
        uf_origem: form.uf_origem || '',
        destino: form.destino || '',
        uf_destino: form.uf_destino || '',
        ctrb_orcado: toDec(form.ctrbOrcado),
        frete_all_in_sicms: toDec(calculos.sIcms?.total),
        frete_all_in_cicms: toDec(calculos.cIcms?.total),
        frete_all_in_desc: toDec(calculos.descSeguro?.total),
        lair_pct: toDec(calculos?.dre?.lairPct ?? calculos?.lairReal ?? 0),
        lair_valor: toDec(calculos?.dre?.lairValor ?? 0),
        observacao: form.observacao || '',
        contratacao: form.contratacao || 'SPOT',
        tabela_cliente: form.tabelaCliente || '',
        tipo_veiculo: form.tipoVeiculo || '',
        tipo_semireboque: form.tipoSemireboque || '',
        pedagio_utilizado: toDec(form.pedagioCusto),
        distancia_km: (() => {
          const km = parseKmQualp(form.qualpKm);
          return km != null ? km : 0;
        })(),
        frete_minimo_antt: toDec(form.qualpFreteMinimoValor),
        valor_mercadoria: toDec(form.valorMercadoria),
        taxa_adicional_entrega: toDec(form.taxaAdicionalEntrega),
        qtd_ajudante: toDec(form.qtdAjudante),
        lair_desejada: toDec(form.percentualLairDesejada),
        ajuste_comercial_pct: toDec(form.percentualDescontoSeguro),
        aliquota_bruta: toDec(form.aliquotaIcmsBruta ?? form.aliquotaIcms ?? 0),
        aliquota_reduzida: toDec(form.aliquotaIcmsReduzida ?? 0),
        spot_k11_pct: toDec(form.spotK11Pct ?? 0),
        antt_freight_type: form.anttFreightType || 'A',
        antt_load_type: form.anttLoadType || 'geral',
        antt_empty_return: !!form.anttEmptyReturn,
        antt_retroactive_date: form.anttRetroactiveDate || '',

        frete_peso_sicms: toDec(calculos.sIcms?.fretePeso),
        seguro_sicms: toDec(calculos.sIcms?.seguro),
        gris_sicms: toDec(calculos.sIcms?.gris),
        pedagio_sicms: toDec(calculos.sIcms?.pedagio),
        outros_sicms: toDec((calculos.sIcms?.carga || 0) + (calculos.sIcms?.adicional || 0)),

        frete_peso_cicms: toDec(calculos.cIcms?.fretePeso),
        seguro_cicms: toDec(calculos.cIcms?.seguro),
        gris_cicms: toDec(calculos.cIcms?.gris),
        pedagio_cicms: toDec(calculos.cIcms?.pedagio),
        outros_cicms: toDec((calculos.cIcms?.carga || 0) + (calculos.cIcms?.adicional || 0)),

        dre_rob: toDec(calculos?.dre?.rob ?? 0),
        dre_icms_iss: toDec(calculos?.dre?.icmsIss ?? 0),
        dre_imp_fed: toDec(calculos?.dre?.impFed ?? 0),
        dre_credito: toDec(calculos?.dre?.credito ?? 0),
        dre_rol: toDec(calculos?.dre?.rol ?? 0),
        dre_cv: toDec(calculos?.dre?.cv ?? 0),
        dre_cf: toDec(calculos?.dre?.cf ?? 0),
        dre_csp: toDec(calculos?.dre?.csp ?? 0),
        dre_lo: toDec(calculos?.dre?.lo ?? 0),
        dre_desp_fin: toDec(calculos?.dre?.despFin ?? 0),
        dre_lair: toDec(calculos?.dre?.lairValor ?? 0),
      };

      const res = await fetchJsonPost('/cotacoes/', payload);
      setCotacaoNumero(res?.id ?? null);
      setCotacaoSalvaOk(`Cotação salva (#${res?.id ?? '—'}) — validade 30 dias.`);
    } catch (e) {
      setCotacaoSalvarErro(e.message || String(e));
    } finally {
      setCotacaoSalvando(false);
    }
  };

  const gerarPdfProposta = async () => {
    try {
      const base = getApiBase();
      let template = null;
      try {
        const res = await fetch(`${base}/proposta-template/`);
        const data = await res.json();
        if (res.ok) template = data;
      } catch {
        template = null;
      }
      await gerarPropostaTecnicaPdf({
        numeroCotacao: cotacaoNumero ?? (viewId ? Number(viewId) : null),
        cliente_nome: form.cliente,
        cliente_cnpj: form.cliente_cnpj,
        contato: form.contato,
        email: form.email,
        origem: form.origem,
        uf_origem: form.uf_origem,
        destino: form.destino,
        uf_destino: form.uf_destino,
        tipoVeiculo: form.tipoVeiculo,
        qtdAjudante: form.qtdAjudante,
        taxaAdicionalEntrega: form.taxaAdicionalEntrega,
        valorMercadoria: form.valorMercadoria,
        sIcms: calculos.sIcms,
        cIcms: calculos.cIcms,
        frete_all_in_sicms: calculos.sIcms?.total,
        frete_all_in_cicms: calculos.cIcms?.total,
        template,
      });
    } catch (e) {
      setCotacaoSalvarErro(e.message || String(e));
    }
  };

  const formatBRL = (val) => Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatarMoeda = (valor) => {
    const v = valor.replace(/\D/g, '');
    return (Number(v) / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  return (
    <div className="max-w-full mx-auto space-y-4 pb-10 text-slate-800 bg-slate-50 p-4">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg"><FileText className="text-white" size={20}/></div>
          <h1 className="text-xl font-black uppercase italic text-blue-900">Rota<span className="text-blue-600">Lume</span></h1>
          {(isReadOnly || cotacaoCarregando) && (
            <span className="ml-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase text-slate-700">
              {cotacaoCarregando ? 'Carregando…' : 'Somente visualização'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.location.reload()} className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded font-bold text-xs uppercase transition-all"><RotateCcw size={14}/> Limpar</button>
          {!isReadOnly && (
            <button
              disabled={cotacaoSalvando}
              onClick={salvarCotacao}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded font-bold text-xs uppercase shadow-md transition-all"
            >
              <Save size={14}/> {cotacaoSalvando ? 'Salvando…' : 'Salvar Cotação'}
            </button>
          )}
        </div>
      </div>

      {(cotacaoSalvarErro || cotacaoSalvaOk) && (
        <div className="mt-3">
          {cotacaoSalvarErro && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[11px] font-semibold text-red-800">
              {cotacaoSalvarErro}
            </div>
          )}
          {cotacaoSalvaOk && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-semibold text-emerald-800">
              {cotacaoSalvaOk}
            </div>
          )}
        </div>
      )}

      <fieldset disabled={isReadOnly} className={isReadOnly ? 'opacity-95' : ''}>
      {/* IDENTIFICAÇÃO DO CLIENTE */}
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
      <div className="bg-blue-800 text-white px-4 py-1.5 text-[10px] font-bold uppercase flex justify-between tracking-widest">
        <span>Identificação do Cliente</span>
        <span>Emissão: {new Date().toLocaleDateString()}</span>
      </div>
      
      <div className="p-4 grid grid-cols-12 gap-x-6 gap-y-3">
        {/* Campo de Cliente com Dropdown de Sugestões */}
        <div className="col-span-6 relative">
          <label className="text-[10px] font-bold uppercase text-slate-400">Cliente (Nome ou CNPJ)</label>
          <input 
            type="text" 
            value={form.cliente} 
            autoComplete="off"
            className="w-full border-b border-slate-200 text-sm py-1 outline-none focus:border-blue-500 font-medium"
            onChange={(e) => {
              setForm({...form, cliente: e.target.value});
              buscaClientesPelaApi(e.target.value);
            }}
          />
          {/* Dropdown de Sugestões Estilizado */}
          {sugestoesClientes.length > 0 && (
            <ul className="absolute z-50 w-full bg-white border border-slate-200 shadow-xl max-h-48 overflow-y-auto rounded-b-md mt-1">
              {sugestoesClientes.map(c => (
                <li 
                  key={c.id} 
                  onClick={() => selecionarCliente(c)} 
                  className="p-3 hover:bg-blue-50 cursor-pointer text-xs border-b border-slate-50 last:border-none flex flex-col"
                >
                  <span className="font-bold text-slate-700">{c.nome_empresa}</span>
                  <span className="text-slate-400 text-[10px]">{c.cnpj}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-span-6">
          <label className="text-[10px] font-bold uppercase text-slate-400">Endereço</label>
          <input type="text" value={form.endereco} readOnly className="w-full border-b border-slate-200 text-sm py-1 outline-none bg-slate-50 text-slate-500"/>
        </div>

        <div className="col-span-3">
          <label className="text-[10px] font-bold uppercase text-slate-400">CEP</label>
          <input type="text" value={form.cep} readOnly className="w-full border-b border-slate-200 text-sm py-1 outline-none bg-slate-50 text-slate-500"/>
        </div>

        <div className="col-span-3">
          <label className="text-[10px] font-bold uppercase text-slate-400">Fone / Celular</label>
          <input type="text" value={form.fone} readOnly className="w-full border-b border-slate-200 text-sm py-1 outline-none bg-slate-50 text-slate-500"/>
        </div>

        {/* Select de Solicitante Estilizado */}
        <div className="col-span-3">
          <label className="text-[10px] font-bold uppercase text-slate-400">Confirmar Solicitante</label>
          <select 
            className="w-full border-b border-slate-200 text-sm py-1 outline-none bg-transparent font-medium focus:border-blue-500"
            value={form.contato}
            onChange={(e) => {
              const sol = listaSolicitantes.find(s => s.nome === e.target.value);
              if(sol) setForm({ ...form, contato: sol.nome, email: sol.email, fone: sol.telefone });
            }}
          >
            <option value="">Selecione o contato...</option>
            {listaSolicitantes.map((s) => (
              <option key={s.id} value={s.nome}>{s.nome}</option>
            ))}
          </select>
        </div>

        <div className="col-span-3">
          <label className="text-[10px] font-bold uppercase text-slate-400">Email</label>
          <input type="email" value={form.email} readOnly className="w-full border-b border-slate-200 text-sm py-1 outline-none bg-slate-50 text-slate-500"/>
        </div>
      </div>
    </div>

      <div className="grid grid-cols-12 gap-4 overflow-visible">
        <div className="col-span-12 space-y-4 overflow-visible lg:col-span-5">
          {/* ROTA */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-700 text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider">Rota e Observações</div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input 
                    placeholder="CIDADE ORIGEM" 
                    value={form.uf_origem ? `${form.origem} - ${form.uf_origem}` : form.origem}
                    className="w-full border-b text-sm py-1 outline-none focus:border-blue-500 uppercase font-semibold" 
                    onChange={(e) => { setForm({...form, origem: e.target.value, uf_origem: ''}); buscaCidades(e.target.value, setSugestaoOrigem); }}
                  />
                  {sugestaoOrigem.length > 0 && (
                    <ul className="absolute z-50 w-full bg-white border shadow-lg mt-1 rounded-b-md">
                      {sugestaoOrigem.map((item, i) => (
                        <li key={i} onClick={() => selecionarCidade(item, 'origem')} className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer border-b"> {item.label} </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="relative">
                  <input 
                    placeholder="CIDADE DESTINO" 
                    value={form.uf_destino ? `${form.destino} - ${form.uf_destino}` : form.destino}
                    className="w-full border-b text-sm py-1 outline-none focus:border-blue-500 uppercase font-semibold" 
                    onChange={(e) => { setForm({...form, destino: e.target.value, uf_destino: ''}); buscaCidades(e.target.value, setSugestaoDestino); }}
                  />
                  {sugestaoDestino.length > 0 && (
                    <ul className="absolute z-50 w-full bg-white border shadow-lg mt-1 rounded-b-md">
                      {sugestaoDestino.map((item, i) => (
                        <li key={i} onClick={() => selecionarCidade(item, 'destino')} className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer border-b"> {item.label} </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {form.aliquotaIcmsBruta != null && form.aliquotaIcmsBruta !== '' && (
                <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase text-slate-600 bg-slate-100 border border-slate-200 rounded px-3 py-2">
                  <span>
                    Alíq. bruta (L11 / tab. ICMS):{' '}
                    <span className="text-blue-700">{Number(form.aliquotaIcmsBruta).toFixed(2).replace('.', ',')}%</span>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>
                    Alíq. reduzida (ICMS/ISS DRE):{' '}
                    <span className="text-emerald-700">
                      {form.aliquotaIcmsReduzida != null
                        ? `${Number(form.aliquotaIcmsReduzida).toFixed(2).replace('.', ',')}%`
                        : '—'}
                    </span>
                  </span>
                </div>
              )}
              <textarea rows="2" className="w-full border rounded p-2 text-sm outline-none bg-slate-50" onChange={(e)=>setForm({...form, observacao: e.target.value})} placeholder="Observações..."></textarea>
            </div>
          </div>

         {/* FORMAÇÃO DE CUSTO — overflow-visible para listas absolutas não serem cortadas */}
         <div className="bg-white rounded-lg border border-slate-200 overflow-visible shadow-sm">
          <div className="bg-[#845132] text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-t-lg">
            Formação de Custo
          </div>
          <div className="p-4 space-y-4 overflow-visible rounded-b-lg">
          
            {/* Contratação em linha cheia; veículo | semirreboque na linha de baixo (evita dropdown sobreposto + z-index) */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 overflow-visible">
              <div
                className={`relative col-span-2 flex flex-col ${showTabelaClienteList ? 'z-[80]' : 'z-20'}`}
              >
                <label className="text-[10px] font-bold text-slate-500 uppercase">Contratação (tabela)</label>
                <input
                  type="text"
                  readOnly
                  placeholder="Selecione a tabela..."
                  className="w-full border-b border-slate-200 py-1.5 text-sm font-bold text-blue-700 bg-white outline-none cursor-pointer min-h-[2.25rem] leading-snug"
                  value={form.tabelaCliente || ''}
                  onClick={() => {
                    setShowTabelaClienteList((o) => !o);
                    setShowVeiculos(false);
                    setShowReboques(false);
                  }}
                  onBlur={() => setTimeout(() => setShowTabelaClienteList(false), 220)}
                />
                {showTabelaClienteList && listaClienteTaxas.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-[90] mt-1 max-h-52 overflow-y-auto rounded-md border border-slate-300 bg-white shadow-xl ring-1 ring-black/10">
                    {listaClienteTaxas.map((c) => (
                      <li
                        key={c.id}
                        className="cursor-pointer border-b border-slate-100 bg-white px-3 py-2.5 text-left text-[11px] font-semibold leading-snug text-slate-800 last:border-0 hover:bg-blue-50"
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          clienteTaxasSelecionado.current = c;
                          setForm((prev) => ({ ...prev, tabelaCliente: c.nome_cliente }));
                          setShowTabelaClienteList(false);
                        }}
                      >
                        {c.nome_cliente}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Tipo de Veículo
                </label>

                <select
                  className="border-b border-slate-300 py-1 text-sm outline-none bg-transparent font-medium"
                  value={form.tipoVeiculo || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, tipoVeiculo: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {veiculosDoBanco.map((v) => (
                    <option key={v.id} value={v.nome}>
                      {v.nome}
                    </option>
                  ))}
                </select>
              </div>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Tipo Semireboque
                </label>

                <select
                  className="border-b border-slate-300 py-1 text-sm outline-none bg-transparent font-medium"
                  value={form.tipoSemireboque || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, tipoSemireboque: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {reboquesDoBanco.map((r) => (
                    <option key={r.id} value={r.nome}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </div> */}
              {/* TIPO DE VEÍCULO */}
              
              <div className={`relative flex flex-col ${showVeiculos ? 'z-[70]' : 'z-10'}`}>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Veículo</label>
                <input 
                  type="text"
                  readOnly
                  placeholder="Selecione..."
                  className="w-full cursor-pointer border-b border-slate-300 bg-transparent py-1.5 text-sm font-medium uppercase outline-none min-h-[2.25rem] leading-snug"
                  value={form.tipoVeiculo || ''}
                  onClick={() => {
                    setShowVeiculos((o) => !o);
                    setShowReboques(false);
                    setShowTabelaClienteList(false);
                  }}
                  onBlur={() => setTimeout(() => setShowVeiculos(false), 220)}
                />
                {showVeiculos && (
                  <ul className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-52 overflow-y-auto rounded-md border border-slate-300 bg-white shadow-xl ring-1 ring-black/10">
                    {veiculosDoBanco.map((v) => (
                      <li 
                        key={v.id} 
                        className="cursor-pointer border-b border-slate-50 bg-white px-3 py-2.5 text-left text-[11px] font-bold uppercase leading-snug text-slate-800 last:border-0 hover:bg-blue-50"
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          setForm((prev) => ({ ...prev, tipoVeiculo: v.tipo_veiculo }));
                          setShowVeiculos(false);
                        }}
                      > 
                        {v.tipo_veiculo}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* TIPO SEMIREBOQUE */}
              <div className={`relative flex flex-col ${showReboques ? 'z-[70]' : 'z-10'}`}>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo Semireboque</label>
                <input 
                  type="text"
                  readOnly
                  placeholder="Selecione..."
                  className="w-full cursor-pointer border-b border-slate-300 bg-transparent py-1.5 text-sm font-medium uppercase outline-none min-h-[2.25rem] leading-snug"
                  value={form.tipoSemireboque || ''}
                  onClick={() => {
                    setShowReboques((o) => !o);
                    setShowVeiculos(false);
                    setShowTabelaClienteList(false);
                  }}
                  onBlur={() => setTimeout(() => setShowReboques(false), 220)}
                />
                {showReboques && (
                  <ul className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-52 overflow-y-auto rounded-md border border-slate-300 bg-white shadow-xl ring-1 ring-black/10">
                    {reboquesDoBanco.map((r) => (
                      <li 
                        key={r.id} 
                        className="cursor-pointer border-b border-slate-50 bg-white px-3 py-2.5 text-left text-[11px] font-bold uppercase leading-snug text-slate-800 last:border-0 hover:bg-blue-50"
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          setForm((prev) => ({ ...prev, tipoSemireboque: r.tipo_semireboque }));
                          setShowReboques(false);
                        }}
                      > 
                        {r.tipo_semireboque}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
              
              




              {/* CTRB ORÇADO */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                {/* Campo: CTRB Orçado — calculado por km × tarifa da faixa (cadastro); vermelho se &lt; frete mín. ANTT */}
                <div
                  className={`p-3 rounded-lg border transition-colors ${
                    ctrbCardAlerta === 'below'
                      ? 'border-red-500 bg-red-50 ring-1 ring-red-200/80'
                      : ctrbCardAlerta === 'above'
                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200/80'
                        : 'border-[#f5d9c5] bg-[#fdf2e9]'
                  }`}
                >
                  <label
                    className={`block text-[10px] font-black uppercase mb-1 ${
                      ctrbCardAlerta === 'below'
                        ? 'text-red-800'
                        : ctrbCardAlerta === 'above'
                          ? 'text-emerald-900'
                          : 'text-[#845132]'
                    }`}
                  >
                    CTRB Orçado (R$)
                  </label>
                  <input 
                    type="text" 
                    className={`w-full bg-transparent font-black text-xl outline-none ${
                      ctrbCardAlerta === 'below'
                        ? 'text-red-900'
                        : ctrbCardAlerta === 'above'
                          ? 'text-emerald-900'
                          : 'text-[#845132]'
                    }`}
                    placeholder="R$ 0,00"
                    value={form.ctrbOrcadoVisual || ''}
                    onChange={(e) => {
                      const formatado = formatarMoeda(e.target.value);
                      const numerico = Number(e.target.value.replace(/\D/g, '')) / 100;
                      setForm({
                        ...form, 
                        ctrbOrcado: numerico, 
                        ctrbOrcadoVisual: formatado 
                      });
                    }}
                  />
                  <p
                    className={`mt-1.5 text-[9px] font-medium leading-snug ${
                      ctrbCardAlerta === 'below'
                        ? 'text-red-800/90'
                        : ctrbCardAlerta === 'above'
                          ? 'text-emerald-900/90'
                          : 'text-[#845132]/90'
                    }`}
                  >
                    {ctrbTarifaUsada != null && (
                      <span className="block">
                        Tarifa usada (R$/km):{' '}
                        <span className="font-black">
                          {ctrbTarifaUsada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </span>
                    )}
                    {ctrbCardAlerta === 'below' && form.qualpFreteMinimoVisual && (
                      <span className="block font-bold mt-0.5">
                        Abaixo do frete mín. ANTT (ref.): {form.qualpFreteMinimoVisual}
                      </span>
                    )}
                    {ctrbCardAlerta === 'above' && form.qualpFreteMinimoVisual && (
                      <span className="block font-bold mt-0.5 text-emerald-800">
                        Acima ou igual ao frete mín. ANTT (ref.).
                      </span>
                    )}
                  </p>
                </div>

                {/* Campo: Pedágio CTRB */}
                <div className="bg-[#fdf2e9] p-3 rounded-lg border border-[#f5d9c5]">
                  <label className="block text-[10px] font-black text-[#845132] uppercase mb-1">
                    Pedágio CTRB (R$)
                  </label>
                  <input 
                    type="text" 
                    className="w-full bg-transparent font-black text-xl outline-none text-[#845132]"
                    placeholder="R$ 0,00"
                    value={form.pedagioCustoVisual || ''}
                    onChange={(e) => {
                      const formatado = formatarMoeda(e.target.value);
                      const numerico = Number(e.target.value.replace(/\D/g, '')) / 100;
                      setForm({
                        ...form, 
                        pedagioCusto: numerico, 
                        pedagioCustoVisual: formatado 
                      });
                    }}
                  />
                  <p className="mt-1.5 text-[9px] font-medium leading-snug text-[#845132]/90">
                    Preenche com o pedágio da QualP após &quot;Buscar&quot;; pode ajustar manualmente.
                  </p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#f5d9c5] bg-[#fffaf5] px-3 py-2.5 shadow-sm">
                  <span className="block text-[10px] font-black uppercase text-[#845132]">Distância rota (origem → destino)</span>
                  <span className="text-lg font-black tabular-nums text-[#845132]">
                    {form.qualpKm ? `${form.qualpKm} km` : '—'}
                  </span>
                </div>
                <div className="rounded-lg border border-[#f5d9c5] bg-[#fffaf5] px-3 py-2.5 shadow-sm">
                  <span className="block text-[10px] font-black uppercase text-[#845132]">Frete mín. ANTT (ref.)</span>
                  <span className="text-lg font-black tabular-nums text-[#845132]">
                    {form.qualpFreteMinimoVisual || '—'}
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase text-blue-900">QualP — parâmetros</span>
                  <span className="text-[9px] font-semibold uppercase text-blue-600">
                    Tabela:&nbsp;<span className="text-blue-900">{form.anttFreightType || '—'}</span>
                  </span>
                </div>
                

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-500">Tabela ANTT</label>
                    <select
                      className="mt-0.5 w-full rounded border border-slate-200 bg-white py-1.5 text-[11px] font-semibold"
                      value={form.anttFreightType}
                      onChange={(e) => setForm({ ...form, anttFreightType: e.target.value })}
                    >
                      {['A', 'B', 'C', 'D'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <label className="block text-[9px] font-bold uppercase text-slate-500">Tipo de carga</label>
                    <select
                      className="mt-0.5 w-full rounded border border-slate-200 bg-white py-1.5 text-[11px] font-semibold"
                      value={form.anttLoadType}
                      onChange={(e) => setForm({ ...form, anttLoadType: e.target.value })}
                    >
                      {ANTT_LOAD_TYPES.map((x) => (
                        <option key={x.value} value={x.value}>{x.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!form.anttEmptyReturn}
                      onChange={(e) => setForm({ ...form, anttEmptyReturn: e.target.checked })}
                    />
                    Retorno vazio
                  </label>
                  <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[140px]">
                    <label className="text-[9px] font-bold uppercase text-slate-500 whitespace-nowrap">Data ANTT</label>
                    <input
                      type="date"
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px]"
                      value={form.anttRetroactiveDate || ''}
                      onChange={(e) => setForm({ ...form, anttRetroactiveDate: e.target.value })}
                    />
                  </div>
                </div>

                {qualpErro && (
                  <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] font-semibold text-red-800">{qualpErro}</p>
                )}

                <button
                  type="button"
                  disabled={qualpBuscando}
                  onClick={consultarQualp}
                  className="w-full rounded-lg bg-blue-700 py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow hover:bg-blue-800 disabled:opacity-55"
                >
                  {qualpBuscando ? 'Consultando QualP…' : 'Buscar km, pedágio e frete mín. ANTT'}
                </button>
              </div>

            </div>
          </div>
          

          {/* DADOS ADICIONAIS */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <label className="block text-[10px] font-bold uppercase text-slate-600">
                  Valor Mercadoria (R$)
                </label>
                <input 
                  type="text" // Mudamos para text para aceitar a máscara
                  className="w-full bg-transparent font-bold outline-none"
                  value={form.valorMercadoriaVisual || ''} // Valor com máscara: R$ 1.000,00
                  onChange={(e) => {
                    const valorFormatado = formatarMoeda(e.target.value);
                    
                    // Converte o valor formatado de volta para número limpo para o banco de dados
                    // Ex: "R$ 1.000,00" vira 1000.00
                    const valorNumerico = Number(e.target.value.replace(/\D/g, '')) / 100;

                    setForm({
                      ...form, 
                      valorMercadoria: valorNumerico,        // O que você envia para o backend
                      valorMercadoriaVisual: valorFormatado // O que o usuário vê
                    });
                  }}
                />
              </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <label className="block text-[10px] font-bold uppercase text-slate-600">Qtde. Ajudantes</label>
                  <input type="number" className="w-full bg-transparent font-bold outline-none" onChange={(e) => setForm({...form, qtdAjudante: e.target.value})}/>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <label className="block text-[10px] font-bold uppercase text-red-700 leading-tight italic">Tx. 2ª Entrega (R$)</label>
                  <input type="number" className="w-full bg-transparent font-bold outline-none text-red-700" onChange={(e) => setForm({...form, taxaAdicionalEntrega: e.target.value})}/>
                </div>
                <div className="bg-[#e8f5e9] p-2 rounded border border-[#c8e6c9]">
                  <label className="block text-[10px] font-black uppercase text-[#2e7d32]">% LAIR Desejada</label>
                  <input type="number" value={form.percentualLairDesejada} className="w-full bg-transparent font-black text-xl text-[#1b5e20] outline-none" onChange={(e) => setForm({...form, percentualLairDesejada: e.target.value})}/>
                </div>
              </div>
            </div>
            
          </div>
          
          {/* AJUSTE COMERCIAL */}
          <div
            onClick={() => inputRef.current?.focus()}
            className="cursor-text overflow-hidden rounded-xl border border-amber-300 bg-amber-50/60 shadow-sm"
          >
            <div className="grid grid-cols-12">
              {/* Lado esquerdo (itens em branco) */}
              <div className="col-span-12 sm:col-span-5 bg-white px-4 py-4 border-b sm:border-b-0 sm:border-r border-amber-200">
                <div className="flex items-center gap-2 text-amber-900 font-black uppercase text-[11px] tracking-wide">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-200/70 text-amber-900">
                    <Percent size={14} />
                  </span>
                  Ajuste Comercial
                </div>
                <p className="mt-2 text-[10px] leading-snug text-amber-900/70 font-semibold">
                  Desconto aplicado em <span className="font-black">frete peso</span>, <span className="font-black">seguro</span> e{' '}
                  <span className="font-black">GRIS</span> (S/ICMS e C/ICMS).
                </p>
              </div>

              {/* Lado direito (percentual centralizado) */}
              <div className="col-span-12 sm:col-span-7 px-4 py-4 flex flex-col items-center justify-center text-center">
                <div className="text-[9px] font-black uppercase tracking-widest text-amber-900/70">Percentual</div>
                <div className="mt-1 flex items-baseline justify-center gap-2">
                  <input
                    ref={inputRef}
                    type="number"
                    step="0.01"
                    value={form.percentualDescontoSeguro || ''}
                    className="w-[140px] bg-transparent text-5xl font-black text-amber-900 outline-none tabular-nums text-center"
                    onChange={(e) => setForm({ ...form, percentualDescontoSeguro: e.target.value })}
                  />
                  <span className="text-4xl font-black text-amber-900">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        

          {/* COLUNA DIREITA (TABELA COMPLETA) */}
          <div className="col-span-12 lg:col-span-7 bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden flex flex-col">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white text-[9px] uppercase tracking-wider">
                  <th className="p-4 border-r border-slate-700">Composição do Frete</th>
                  <th className="p-4 text-center border-r border-slate-700 bg-blue-900/50">1. S/ ICMS</th>
                  <th className="p-4 text-center border-r border-slate-700 bg-slate-700">2. C/ ICMS</th>
                  <th className="p-4 text-center bg-green-800 font-black">3. FRETE S/ICMS R$.</th>
                </tr>
              </thead>
              <tbody className="text-[13px] font-medium">
                <tr className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-blue-900 font-bold border-r">FRETE PESO</td>
                  <td className="p-4 text-center font-mono border-r">R$ {formatBRL(calculos.sIcms.fretePeso)}</td>
                  <td className="p-4 text-center font-mono border-r">R$ {formatBRL(calculos.cIcms.fretePeso)}</td>
                  <td className="p-4 text-center font-mono bg-green-50/30">R$ {formatBRL(calculos.descSeguro.fretePeso)}</td>
                </tr>
                <tr className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-semibold border-r">SEGURO (0,10%)</td>
                  <td className="p-4 text-center font-mono border-r text-slate-500">R$ {formatBRL(calculos.sIcms.seguro)}</td>
                  <td className="p-4 text-center font-mono border-r text-slate-500">R$ {formatBRL(calculos.cIcms.seguro)}</td>
                  <td className="p-4 text-center font-mono font-black text-green-700 bg-green-50/50 underline">R$ {formatBRL(calculos.descSeguro.seguro)}</td>
                </tr>
                <tr className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-semibold border-r">GRIS (0,08%)</td>
                  <td className="p-4 text-center font-mono border-r text-slate-500">R$ {formatBRL(calculos.sIcms.gris)}</td>
                  <td className="p-4 text-center font-mono border-r text-slate-500">R$ {formatBRL(calculos.cIcms.gris)}</td>
                  <td className="p-4 text-center font-mono bg-green-50/30">R$ {formatBRL(calculos.descSeguro.gris)}</td>
                </tr>
                <tr className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-semibold border-r text-orange-700 italic">PEDÁGIO (Repasse)</td>
                  <td className="p-4 text-center font-mono border-r text-orange-700">R$ {formatBRL(calculos.sIcms.pedagio)}</td>
                  <td className="p-4 text-center font-mono border-r text-orange-700 font-bold">R$ {formatBRL(calculos.cIcms.pedagio)}</td>
                  <td className="p-4 text-center font-mono text-orange-700 bg-green-50/30">R$ {formatBRL(calculos.descSeguro.pedagio)}</td>
                </tr>
                <tr className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-semibold border-r text-slate-500">OUTROS (Ajud./Taxas)</td>
                  <td className="p-4 text-center font-mono border-r text-slate-500">R$ {formatBRL(calculos.sIcms.carga + calculos.sIcms.adicional)}</td>
                  <td className="p-4 text-center font-mono border-r text-slate-500">R$ {formatBRL(calculos.cIcms.carga + calculos.cIcms.adicional)}</td>
                  <td className="p-4 text-center font-mono bg-green-50/30 text-slate-500">R$ {formatBRL(calculos.descSeguro.carga + calculos.descSeguro.adicional)}</td>
                </tr>
                
                {/* TOTAL ALL IN */}
                <tr className="bg-slate-900 text-white">
                  <td className="p-5 font-black text-blue-400 text-base uppercase border-r border-slate-700">Frete All In</td>
                  <td className="p-5 text-center font-black text-lg border-r border-slate-700">R$ {formatBRL(calculos.sIcms.total)}</td>
                  <td className="p-5 text-center font-black text-lg border-r border-slate-700">R$ {formatBRL(calculos.cIcms.total)}</td>
                  <td className="p-5 text-center font-black text-2xl text-green-400 bg-slate-800">R$ {formatBRL(calculos.descSeguro.total)}</td>
                </tr>
              </tbody>
            </table>

            {/* ICMS / ISS — faixa 3 colunas (referência visual: label marinho | ICMS marinho | ISS verde) */}
            <div className="border-t border-black bg-black">
              <div className="grid min-h-[4.25rem] grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)] border border-black">
                <div className="flex items-center justify-center border-r border-black bg-[#0c1929] px-3 py-4 sm:px-6">
                  <span className="text-center text-sm font-black uppercase tracking-wide text-white sm:text-base">
                    ICMS / ISS
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center border-r border-black bg-[#0c1929] px-2 py-3">
                  <span className="mb-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    ICMS
                  </span>
                  <span className="text-base font-black tabular-nums text-white sm:text-lg">
                    R${' '}
                    {formatBRL(icmsIssOrcamento.icmsValor != null ? icmsIssOrcamento.icmsValor : 0)}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center bg-green-900 px-2 py-3">
                  <span className="mb-0.5 text-[8px] font-bold uppercase tracking-wider text-green-200/90">
                    ISS
                  </span>
                  <span className="text-base font-black tabular-nums text-white sm:text-lg">
                    R${' '}
                    {formatBRL(icmsIssOrcamento.issValor != null ? icmsIssOrcamento.issValor : 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* DRE — Base lucro (acordeão: fica fora do fieldset para funcionar em visualização) */}
            <div className="border-t border-slate-200 bg-slate-50">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDreLucroExpanded((prev) => !prev)}
                aria-expanded={dreLucroExpanded}
                className="flex w-full items-center justify-between gap-3 px-3 py-3 sm:px-4 text-left transition-colors hover:bg-slate-100/90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDreLucroExpanded((prev) => !prev);
                  }
                }}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-700">
                  DRE — Base lucro
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="hidden text-[9px] font-semibold uppercase text-slate-500 sm:inline">
                    {dreLucroExpanded ? 'Encolher' : 'Expandir'}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-600 transition-transform duration-200 ${dreLucroExpanded ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </span>
              </div>
              {dreLucroExpanded && (
                <div className="border-t border-slate-200 px-3 pb-4 pt-2 sm:px-4">
                  <div className="mx-auto max-w-full overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse border border-slate-400 bg-white text-[12px]">
                      <thead>
                        <tr className="bg-slate-300 text-slate-900">
                          <th className="border border-slate-400 px-3 py-2 text-left font-black uppercase">DRE - BASE LUCRO</th>
                          <th className="border border-slate-400 px-3 py-2 text-right font-black uppercase tabular-nums">Valor</th>
                          <th className="border border-slate-400 px-3 py-2 text-right font-black uppercase tabular-nums">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const dre = calculos.dre;
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
                            { key: 'icmsiss', label: '(-) ICMS/ISS', value: dre ? dre.icmsIss : 0, pct: dre ? pctFrom(dre.icmsIss, dre.rob) : '—', negative: true },
                            { key: 'impfed', label: '(-) IMP.FED', value: dre ? dre.impFed : 0, pct: dre ? pctFrom(dre.impFed, dre.rob) : '—', negative: true },
                            { key: 'cred', label: '(+) CREDITO', value: dre ? dre.credito : 0, pct: dre ? (dre.creditoPct != null ? `${Number(dre.creditoPct).toFixed(2).replace('.', ',')}%` : '—') : '—', negative: false },
                            { key: 'rol', label: 'ROL', value: dre ? dre.rol : 0, pct: dre ? pctFrom(dre.rol, dre.rob) : '—', negative: false },
                            { key: 'csp', label: 'CSP', value: dre ? dre.csp : 0, pct: dre ? pctFromRol(dre.csp, dre.rol) : '—', negative: true },
                            { key: 'cv', label: 'C.V', value: dre ? dre.cv : 0, pct: dre ? pctFromRol(dre.cv, dre.rol) : '—', negative: true },
                            { key: 'cf', label: 'C.F', value: dre ? dre.cf : 0, pct: dre ? pctFromRol(dre.cf, dre.rol) : '—', negative: true },
                            { key: 'lo', label: 'L.O', value: dre ? dre.lo : 0, pct: dre ? pctFromRol(dre.lo, dre.rol) : '—', negative: false },
                            { key: 'despfin', label: 'DESP./FIN.', value: dre ? dre.despFin : 0, pct: dre ? (dre.despFinPct != null ? `${Number(dre.despFinPct).toFixed(2).replace('.', ',')}%` : '—') : '—', negative: true },
                            { key: 'lair', label: 'LAIR', value: dre ? dre.lairValor : 0, pct: dre ? pctFromRol(dre.lairValor, dre.rol) : '—', negative: false, isTotal: true },
                          ];

                          return rows.map((r) => {
                            const valueIsNeg = Number(r.value) < 0 || r.negative;
                            const valorBg = valueIsNeg ? 'bg-red-100' : 'bg-green-100';
                            const valorText = valueIsNeg ? 'text-red-700' : 'text-green-800';
                            const pctBg = valueIsNeg ? 'bg-red-100' : 'bg-green-100';
                            const pctText = valueIsNeg ? 'text-red-700' : 'text-green-800';
                            const leftBg = r.isTotal ? 'bg-slate-300' : 'bg-slate-200';
                            const rowFont = r.isTotal ? 'font-black' : 'font-semibold';
                            return (
                              <tr key={r.key}>
                                <td className={`border border-slate-400 px-3 py-2 ${leftBg} ${rowFont} text-slate-900`}>
                                  {r.label}
                                </td>
                                <td className={`border border-slate-400 px-3 py-2 text-right font-black tabular-nums ${valorBg} ${valorText}`}>
                                  {dre ? fmtSigned(r.value) : `R$ ${fmtAbs(0)}`}
                                </td>
                                <td className={`border border-slate-400 px-3 py-2 text-right font-black tabular-nums ${pctBg} ${pctText}`}>
                                  {r.pct}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                    {!calculos.dre && (
                      <p className="mt-2 text-center text-[10px] italic text-slate-500">
                        Exemplo (valores zerados). Preencha CTRB e alíquotas para calcular.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
          </div>
          </div>

        </fieldset>

        <div className="flex-1 p-8 flex justify-between items-center bg-slate-50 border-t border-slate-200">
          <div>
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-black ${Number(calculos.lairReal) < Number(form.percentualLairDesejada || 0) ? 'text-red-600' : 'text-green-700'}`}>
                {calculos.lairReal}%
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase italic">LAIR </span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={gerarPdfProposta}
              className="bg-green-600 hover:bg-green-700 text-white px-10 py-4 rounded-xl font-black uppercase text-sm tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              Gerar Proposta PDF
            </button>
            <p className="text-[9px] text-center text-slate-400 font-bold uppercase italic">Válido por 30 dias</p>
          </div>
        </div>
    </div>
  );
};

export default NovaCotacao;