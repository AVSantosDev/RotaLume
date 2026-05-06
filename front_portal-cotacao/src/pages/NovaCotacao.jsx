import { useState, useEffect, useRef } from 'react';
import { Save, RotateCcw, FileText, Percent } from 'lucide-react';
import { DIVERSOS_LAIR_DIVISORES_PADRAO } from '../lib/markupSpotLookup';
import { fetchJsonList, getApiBase } from '../config/api';
import { buscarMunicipiosPorTermo } from '../lib/cidadesIbge';

const NovaCotacao = () => {
  const inputRef = useRef(null);
  const ultimoMarkupSalvoRef = useRef('');

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

  const clienteTaxasSelecionado = useRef(null);

  // --- ESTADOS DE UI ---
  const [sugestaoOrigem, setSugestaoOrigem] = useState([]);
  const [sugestaoDestino, setSugestaoDestino] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // --- ESTADO DO FORMULÁRIO ---
  const [form, setForm] = useState({
    cliente: '', cliente_id: '', endereco: '', cep: '', fone: '', contato: '', email: '',
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
    aliquotaIcmsReduzida: null
  });

  const [calculos, setCalculos] = useState({
    sIcms: { fretePeso: 0, seguro: 0, gris: 0, pedagio: 0, carga: 0, adicional: 0, total: 0 },
    cIcms: { fretePeso: 0, seguro: 0, gris: 0, pedagio: 0, carga: 0, adicional: 0, total: 0 },
    descSeguro: { fretePeso: 0, seguro: 0, gris: 0, pedagio: 0, carga: 0, adicional: 0, total: 0 },
    /** % LAIR = LAIR / ROL (DRE — BASE LUCRO), não margem sobre All In S/ICMS. */
    lairReal: '0.00',
    dre: null
  });

  // --- 1. CARREGAMENTO INICIAL (VEÍCULOS E REBOQUES) ---
  useEffect(() => {
    const carregarListas = async () => {
      try {
        const [dataV, dataS, dataCT, dataImp, dataSeg, dataGris, dataDesp, dataMk] = await Promise.all([
          fetchJsonList('/veiculos/'),
          fetchJsonList('/semireboques/'),
          fetchJsonList('/cliente-taxas-config/'),
          fetchJsonList('/impostos/'),
          fetchJsonList('/seguros/'),
          fetchJsonList('/gris/'),
          fetchJsonList('/despesas-operacionais/'),
          fetchJsonList('/markup-config/')
        ]);

        setVeiculosDoBanco(dataV);
        setReboquesDoBanco(dataS);
        setListaClienteTaxas(dataCT);
        setListaImpostos(dataImp);
        setListaSeguros(dataSeg);
        setListaGris(dataGris);
        setListaDespesas(dataDesp);
        setListaMarkupConfig(dataMk);

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

    const sIcms = {
      fretePeso: fretePesoSIcms,
      seguro: seguroSIcms,
      gris: grisSIcms,
      pedagio: pedagioSIcms,
      carga: cargaSIcms,
      adicional: adicionalSIcms,
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

    const f28 = normalizarNumero(form.percentualDescontoSeguro) / 100;
    /** Desconto só em frete peso, seguro e GRIS (texto vermelho da planilha). */
    const descSeguro = {
      fretePeso: sIcms.fretePeso - sIcms.fretePeso * f28,
      seguro: sIcms.seguro - sIcms.seguro * f28,
      gris: sIcms.gris - sIcms.gris * f28,
      pedagio: sIcms.pedagio,
      carga: sIcms.carga,
      adicional: sIcms.adicional,
      total: 0
    };
    descSeguro.total =
      descSeguro.fretePeso +
      descSeguro.seguro +
      descSeguro.gris +
      descSeguro.pedagio +
      descSeguro.carga +
      descSeguro.adicional;

    /** --- DRE BASE LUCRO (planilha): ROB=G17+G18+G19; LAIR% = O26/O20 --- */
    const reduzidaDrePct =
      form.aliquotaIcmsReduzida != null && form.aliquotaIcmsReduzida !== ''
        ? normalizarNumero(form.aliquotaIcmsReduzida)
        : reduzidaParaK > 0
          ? reduzidaParaK
          : k11Pct;
    const Kdec = reduzidaDrePct / 100;
    const Ldec = brutaPct > 0 ? brutaPct / 100 : L11;

    const rob = cIcms.fretePeso + cIcms.seguro + cIcms.gris;
    const pisSep = impostosMap.get('PIS') || 0;
    const cofSep = impostosMap.get('COFINS') || 0;
    const pisCofUm = impostosMap.get('PIS/COFINS') || 0;
    const b5b6Pct = pisSep > 0 || cofSep > 0 ? pisSep + cofSep : pisCofUm;
    const b5b6 = b5b6Pct / 100;
    const d5 = (impostosMap.get('CPRB') || 0) / 100;
    const creditoPct = (impostosMap.get('CREDITO') || impostosMap.get('CREDITO PIS') || 6.9375) / 100;

    const somaDespPerc = (pred) => {
      let s = 0;
      for (const d of listaDespesas || []) {
        if ((d?.unidade || '').toUpperCase() !== 'PERCENTUAL') continue;
        const nm = (d?.nome || '').toUpperCase();
        if (pred(nm)) s += normalizarNumero(d.valor) / 100;
      }
      return s;
    };
    const n5cgo = somaDespPerc((nm) => nm.includes('CGO') || nm.includes('EGD')) || 0.056;
    let n67fin = somaDespPerc((nm) => nm.includes('FINANCEIRO') || nm.includes('FINAN') || nm.includes('PAMCARD'));
    /** Planilha ~11% sobre ROL; se o cadastro somar pouco, mantém o consolidado típico. */
    if (n67fin < 0.08) n67fin = 0.11;

    let dre = null;
    let lairPctStr = '0.00';
    if (rob > 0 && ctrb > 0 && brutaPct > 0) {
      const H25 = rob * Kdec;
      const icmsIss = -(
        Math.abs(reduzidaDrePct - brutaPct) < 0.015 ? rob * Ldec : rob * Kdec
      );
      /** (-) IMP.FED = ((O16-H25)*(B5+B6)+(O16*D5))*-1 — use PIS/COFINS (e linhas PIS+COFINS separadas) em B5+B6 e CPRB em D5. */
      const impFed = -((rob - H25) * b5b6 + rob * d5);
      const credito = ctrb * creditoPct;
      const rol = rob + impFed + icmsIss + credito;
      const cv = -ctrb;
      const cf = -(rol * n5cgo);
      const csp = cv + cf;
      const lo = rol + csp;
      const despFin = -(rol * n67fin);
      const lairValor = lo + despFin;
      const lairPct = rol > 0 ? (lairValor / rol) * 100 : 0;
      lairPctStr = lairPct.toFixed(2);
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
        lairPct
      };
    }



    setCalculos({ sIcms, cIcms, descSeguro, lairReal: lairPctStr, dre });
  }, [form, listaImpostos, listaMarkupConfig, listaDespesas]);

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
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.location.reload()} className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded font-bold text-xs uppercase transition-all"><RotateCcw size={14}/> Limpar</button>
          <button className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold text-xs uppercase shadow-md transition-all"><Save size={14}/> Salvar Cotação</button>
        </div>
      </div>

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
                {/* Campo: CTRB Orçado */}
                <div className="bg-[#fdf2e9] p-3 rounded-lg border border-[#f5d9c5]">
                  <label className="block text-[10px] font-black text-[#845132] uppercase mb-1">
                    CTRB Orçado (R$)
                  </label>
                  <input 
                    type="text" 
                    className="w-full bg-transparent font-black text-xl outline-none text-[#845132]"
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
                </div>
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
            <div className="bg-slate-50 p-2 rounded border border-slate-100">
              <label className="block text-[10px] font-bold uppercase text-slate-500">% K11 planilha SPOT (opcional)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Vazio = alíq. reduzida ICMS ou % repasse (D9)"
                className="w-full bg-transparent font-bold outline-none text-sm"
                value={form.spotK11Pct || ''}
                onChange={(e) => setForm({ ...form, spotK11Pct: e.target.value })}
              />
              <p className="text-[9px] text-slate-400 mt-1">Matriz Bases: L11 = alíq. bruta; K11 vazio = alíq. reduzida da rota (ex. 9,6 com L 12 → 59,23%).</p>
            </div>
          </div>
          
          {/* AJUSTE COMERCIAL */}
          <div onClick={() => inputRef.current?.focus()} className="bg-white rounded-lg border-2 border-green-600 overflow-hidden shadow-md cursor-text p-4 bg-green-50">
              <div className="flex items-center gap-2 text-green-700 font-black uppercase text-xs mb-2"><Percent size={14}/> Ajuste Comercial</div>
              <div className="flex items-baseline">
                <input 
                  ref={inputRef} type="number" step="0.01" 
                  value={form.percentualDescontoSeguro || ''} 
                  className="w-[120px] text-4xl font-black text-green-700 bg-transparent outline-none"
                  onChange={(e) => setForm({ ...form, percentualDescontoSeguro: e.target.value })}
                />
                <span className="text-4xl font-black text-green-700">%</span>
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
            
            <div className="flex-1 p-8 flex justify-between items-center bg-slate-50 border-t border-slate-200">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-[0.3em] mb-1">DRE — LAIR (sobre ROL)</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-5xl font-black ${Number(calculos.lairReal) < Number(form.percentualLairDesejada || 0) ? 'text-red-600' : 'text-green-700'}`}>
                    {calculos.lairReal}%
                  </span>
                  <span className="text-xs font-bold text-slate-400 uppercase italic">LAIR / ROL</span>
                </div>
                {calculos.dre && (
                  <p className="text-[10px] text-slate-500 font-mono mt-2 leading-relaxed">
                    {`ROB R$ ${formatBRL(calculos.dre.rob)} · ROL R$ ${formatBRL(calculos.dre.rol)} · LAIR R$ ${formatBRL(calculos.dre.lairValor)}`}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <button className="bg-green-600 hover:bg-green-700 text-white px-10 py-4 rounded-xl font-black uppercase text-sm tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95">
                  Gerar Proposta PDF
                </button>
                <p className="text-[9px] text-center text-slate-400 font-bold uppercase italic">Válido por 30 dias</p>
              </div>
            </div>
          </div>
          </div>
          </div>
          );
          };

export default NovaCotacao;