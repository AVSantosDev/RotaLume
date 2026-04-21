import { useState, useEffect, useRef } from 'react';
import { Save, RotateCcw, FileText, Percent } from 'lucide-react';

const NovaCotacao = () => {
  const inputRef = useRef(null);

  // --- ESTADOS PARA DADOS DO DJANGO ---
  const [veiculosDoBanco, setVeiculosDoBanco] = useState([]);
  const [reboquesDoBanco, setReboquesDoBanco] = useState([]);
  const [showVeiculos, setShowVeiculos] = useState(false);
  const [showReboques, setShowReboques] = useState(false);

  const [sugestoesClientes, setSugestoesClientes] = useState([]);
  const [listaSolicitantes, setListaSolicitantes] = useState([]);

  // --- ESTADOS DE UI ---
  const [sugestaoOrigem, setSugestaoOrigem] = useState([]);
  const [sugestaoDestino, setSugestaoDestino] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // --- ESTADO DO FORMULÁRIO ---
  const [form, setForm] = useState({
    cliente: '', cliente_id: '', endereco: '', cep: '', fone: '', contato: '', email: '',
    origem: '', uf_origem: '', destino: '', uf_destino: '', observacao: '',
    contratacao: 'SPOT',
    tipoVeiculo: '',
    tipoSemireboque: '',
    ctrbOrcado: 0, pedagioCusto: 0,
    valorMercadoria: 0, qtdAjudante: 0, taxaAdicionalEntrega: 0,
    percentualLairDesejada: 20,
    percentualDescontoSeguro: 0
  });

  const [calculos, setCalculos] = useState({
    sIcms: { fretePeso: 0, seguro: 0, gris: 0, pedagio: 0, carga: 0, adicional: 0, total: 0 },
    cIcms: { fretePeso: 0, seguro: 0, gris: 0, pedagio: 0, carga: 0, adicional: 0, total: 0 },
    descSeguro: { fretePeso: 0, seguro: 0, gris: 0, pedagio: 0, carga: 0, adicional: 0, total: 0 },
    lairReal: 0
  });

  // --- 1. CARREGAMENTO INICIAL (VEÍCULOS E REBOQUES) ---
  useEffect(() => {
    const carregarListas = async () => {
      try {
        const [resV, resS] = await Promise.all([
          fetch('http://localhost:8000/veiculos/'),
          fetch('http://localhost:8000/semireboques/')
        ]);
        const dataV = await resV.json();
        const dataS = await resS.json();
        
        setVeiculosDoBanco(dataV);
        setReboquesDoBanco(dataS);
        
        // Seta o primeiro item como padrão usando as chaves corretas da sua API
        if (dataV.length > 0) {
          setForm(f => ({ ...f, tipoVeiculo: dataV[0].tipo_veiculo }));
        }
        if (dataS.length > 0) {
          setForm(f => ({ ...f, tipoSemireboque: dataS[0].tipo_semireboque }));
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
      const response = await fetch(`http://localhost:8000/clientes/?search=${termo}`);
      const data = await response.json();
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
    
    // Busca os solicitantes vinculados a este cliente específico
    try {
      const response = await fetch(`http://localhost:8000/solicitantes/?cliente=${c.id}`);
      const data = await response.json();
      setListaSolicitantes(data); // Alimenta a lista para o próximo campo
    } catch (error) { console.error("Erro solicitantes:", error); }
  };
  
  // --- FUNÇÕES AUXILIARES (CIDADES) ---
  const removerAcentos = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const buscaCidades = async (termo, setSugestao) => {
    if (termo.length < 3) { setSugestao([]); return; }
    try {
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios`);
      const data = await response.json();
      const filtrados = data.filter(m => removerAcentos(m.nome.toLowerCase()).includes(removerAcentos(termo.toLowerCase())))
        .map(m => ({
          cidade: m.nome,
          uf: m.microrregiao?.mesorregiao?.UF?.sigla || '',
          label: `${m.nome.toUpperCase()} - ${m.microrregiao?.mesorregiao?.UF?.sigla || ''}`
        })).slice(0, 6);
      setSugestao(filtrados);
    } catch (error) { console.error(error); }
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




  // --- LÓGICA DE CÁLCULO (Atualizado para reagir ao form) ---
  useEffect(() => {
    const impostoFixo = 0.0975;
    const aliquotaIcms = 0.12;
    const fatorImpostos = 1 - (aliquotaIcms + impostoFixo);

    let fretePesoBase = Number(form.ctrbOrcado) / (1 - (form.percentualLairDesejada / 100));

    const sIcms = {
      fretePeso: fretePesoBase || 0,
      seguro: (Number(form.valorMercadoria) * 0.001),
      gris: (Number(form.valorMercadoria) * 0.0008),
      pedagio: Number(form.pedagioCusto),
      carga: Number(form.qtdAjudante) * 280,
      adicional: Number(form.taxaAdicionalEntrega),
      total: 0
    };
    sIcms.total = Object.values(sIcms).reduce((a, b) => a + b, 0);

    const cIcms = {
      fretePeso: sIcms.fretePeso / fatorImpostos,
      seguro: sIcms.seguro / fatorImpostos,
      gris: sIcms.gris / fatorImpostos,
      pedagio: sIcms.pedagio,
      carga: sIcms.carga / fatorImpostos,
      adicional: sIcms.adicional / fatorImpostos,
      total: 0
    };
    cIcms.total = Object.values(cIcms).reduce((a, b) => a + b, 0);

    const fatorDesc = 1 - (Number(form.percentualDescontoSeguro) / 100);
    const descSeguro = {
      ...cIcms,
      fretePeso: cIcms.fretePeso * fatorDesc,
      seguro: cIcms.seguro * fatorDesc,
      gris: cIcms.gris * fatorDesc,
      total: 0
    };
    descSeguro.total = Object.values(descSeguro).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0);
    const margemReal = sIcms.total > 0 ? ((sIcms.total - Number(form.ctrbOrcado)) / sIcms.total) * 100 : 0;

    setCalculos({ sIcms, cIcms, descSeguro, lairReal: margemReal.toFixed(2) });
  }, [form]);

  const formatBRL = (val) => Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5 space-y-4">
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
              <textarea rows="2" className="w-full border rounded p-2 text-sm outline-none bg-slate-50" onChange={(e)=>setForm({...form, observacao: e.target.value})} placeholder="Observações..."></textarea>
            </div>
          </div>

         {/* FORMAÇÃO DE CUSTO */}
         <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-[#845132] text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider">Formação de Custo</div>
          <div className="p-4 space-y-4">
          
            {/* GRID 1: CONTRATAÇÃO E VEÍCULO */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Contratação</label>
                <input type="text" value="SPOT" readOnly className="border-b border-slate-200 py-1 text-sm font-bold text-blue-700 bg-transparent outline-none"/>
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
              
              <div className="flex flex-col relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Veículo</label>
                <input 
                  type="text"
                  readOnly
                  placeholder="Selecione..."
                  className="w-full border-b border-slate-300 py-1 text-sm outline-none font-medium bg-transparent uppercase cursor-pointer"
                  value={form.tipoVeiculo || ''}
                  onClick={() => setShowVeiculos(!showVeiculos)}
                  onBlur={() => setTimeout(() => setShowVeiculos(false), 200)}
                />
                {showVeiculos && (
                  <ul className="absolute z-[100] w-full bg-white border border-slate-200 shadow-xl mt-12 rounded-md max-h-48 overflow-y-auto">
                    {veiculosDoBanco.map((v) => (
                      <li 
                        key={v.id} 
                        onClick={() => setForm(prev => ({ ...prev, tipoVeiculo: v.tipo_veiculo }))} 
                        className="px-3 py-2 text-[11px] hover:bg-blue-50 cursor-pointer border-b border-slate-50 uppercase font-bold text-slate-700"
                      > 
                        {v.tipo_veiculo} {/* <--- Chave correta da sua API */}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* TIPO SEMIREBOQUE */}
              <div className="flex flex-col relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo Semireboque</label>
                <input 
                  type="text"
                  readOnly
                  placeholder="Selecione..."
                  className="w-full border-b border-slate-300 py-1 text-sm outline-none font-medium bg-transparent uppercase cursor-pointer"
                  value={form.tipoSemireboque || ''}
                  onClick={() => setShowReboques(!showReboques)}
                  onBlur={() => setTimeout(() => setShowReboques(false), 200)}
                />
                {showReboques && (
                  <ul className="absolute z-[100] w-full bg-white border border-slate-200 shadow-xl mt-12 rounded-md max-h-48 overflow-y-auto">
                    {reboquesDoBanco.map((r) => (
                      <li 
                        key={r.id} 
                        onClick={() => setForm(prev => ({ ...prev, tipoSemireboque: r.tipo_semireboque }))} 
                        className="px-3 py-2 text-[11px] hover:bg-blue-50 cursor-pointer border-b border-slate-50 uppercase font-bold text-slate-700"
                      > 
                        {r.tipo_semireboque} {/* <--- Chave correta da sua API */}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
              
              




              {/* CTRB ORÇADO */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-[#fdf2e9] p-3 rounded-lg border border-[#f5d9c5]">
                  <label className="block text-[10px] font-black text-[#845132] uppercase mb-1">CTRB Orçado (R$)</label>
                  <input type="number" step="0.01" className="w-full bg-transparent font-black text-xl outline-none" onChange={(e) => setForm({...form, ctrbOrcado: e.target.value})}/>
                </div>
                <div className="bg-[#fdf2e9] p-3 rounded-lg border border-[#f5d9c5]">
                  <label className="block text-[10px] font-black text-[#845132] uppercase mb-1">Pedágio CTRB (R$)</label>
                  <input type="number" step="0.01" className="w-full bg-transparent font-black text-xl outline-none" onChange={(e) => setForm({...form, pedagioCusto: e.target.value})}/>
                </div>
              </div>
            </div>
          </div>
          

          {/* DADOS ADICIONAIS */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm p-4 grid grid-cols-2 gap-4">
             <div className="space-y-4">
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <label className="block text-[10px] font-bold uppercase text-slate-600">Valor Mercadoria (R$)</label>
                  <input type="number" className="w-full bg-transparent font-bold outline-none" onChange={(e) => setForm({...form, valorMercadoria: e.target.value})}/>
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
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-[0.3em] mb-1">Performance da Cotação</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-5xl font-black ${Number(calculos.lairReal) < 20 ? 'text-red-600' : 'text-green-700'}`}>
                    {calculos.lairReal}%
                  </span>
                  <span className="text-xs font-bold text-slate-400 uppercase italic">Lair Real Orçado</span>
                </div>
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