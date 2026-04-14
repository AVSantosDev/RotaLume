import { useState, useEffect, useRef } from 'react';
import { Save, RotateCcw, FileText, Percent } from 'lucide-react';



const NovaCotacao = () => {
  const inputRef = useRef(null); // Referência para o card de desconto
  const handleBlurOuEnter = () => {
  if (form.percentualDescontoSeguro) {
    // Converte para número e fixa em 2 casas decimais como string
    const valorFormatado = parseFloat(form.percentualDescontoSeguro).toFixed(2);
    setForm({ ...form, percentualDescontoSeguro: valorFormatado });
  }
};

  const [form, setForm] = useState({
    cliente: '', endereco: '', cep: '', fone: '', contato: '', email: '',
    origem: '', destino: '', observacao: '',
    contratacao: 'SPOT',
    tipoVeiculo: 'CAVALO 4X2',
    tipoSemireboque: 'VANDERLEIA',
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

  useEffect(() => {
    const impostoFixo = 0.0975; 
    const aliquotaIcms = 0.12; 
    const taxaSeguroOrcado = 0.001;
    const taxaGrisOrcado = 0.0008;
    const fatorImpostos = 1 - (aliquotaIcms + impostoFixo);

    // 1. Cálculos S/ ICMS (Base)
    let fretePesoBase = Number(form.ctrbOrcado) / (1 - (form.percentualLairDesejada / 100));
    
    const sIcms = {
      fretePeso: fretePesoBase,
      seguro: (form.valorMercadoria * taxaSeguroOrcado),
      gris: (form.valorMercadoria * taxaGrisOrcado),
      pedagio: Number(form.pedagioCusto),
      carga: Number(form.qtdAjudante) * 280,
      adicional: Number(form.taxaAdicionalEntrega),
      total: 0
    };
    sIcms.total = Object.values(sIcms).reduce((a, b) => a + b, 0);

    // 2. Cálculos C/ ICMS
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

    // 3. Cálculos C/ ICMS + Desconto Comercial (FP, SEG e GRIS)
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
          <button className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded font-bold text-xs uppercase transition-all"><RotateCcw size={14}/> Limpar</button>
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
          <div className="col-span-6"><label className="text-[10px] font-bold uppercase text-slate-400">Cliente</label>
            <input type="text" className="w-full border-b border-slate-200 text-sm py-1 outline-none focus:border-blue-500 font-medium" onChange={(e)=>setForm({...form, cliente: e.target.value})}/></div>
          <div className="col-span-6"><label className="text-[10px] font-bold uppercase text-slate-400">Endereço</label>
            <input type="text" className="w-full border-b border-slate-200 text-sm py-1 outline-none focus:border-blue-500" onChange={(e)=>setForm({...form, endereco: e.target.value})}/></div>
          <div className="col-span-3"><label className="text-[10px] font-bold uppercase text-slate-400">CEP</label>
            <input type="text" placeholder="00000-000" className="w-full border-b border-slate-200 text-sm py-1 outline-none" onChange={(e)=>setForm({...form, cep: e.target.value})}/></div>
          <div className="col-span-3"><label className="text-[10px] font-bold uppercase text-slate-400">Fone / Celular</label>
            <input type="text" placeholder="(00) 00000-0000" className="w-full border-b border-slate-200 text-sm py-1 outline-none" onChange={(e)=>setForm({...form, fone: e.target.value})}/></div>
          <div className="col-span-3"><label className="text-[10px] font-bold uppercase text-slate-400">A/C Contato</label>
            <input type="text" className="w-full border-b border-slate-200 text-sm py-1 outline-none" onChange={(e)=>setForm({...form, contato: e.target.value})}/></div>
          <div className="col-span-3"><label className="text-[10px] font-bold uppercase text-slate-400">Email</label>
            <input type="email" className="w-full border-b border-slate-200 text-sm py-1 outline-none" onChange={(e)=>setForm({...form, email: e.target.value})}/></div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* COLUNA ESQUERDA */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          
          {/* DADOS COMPLEMENTARES + OBS */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-700 text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider">Rota e Observações</div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="CIDADE ORIGEM" className="border-b text-sm py-1 outline-none focus:border-blue-500 uppercase font-semibold" onChange={(e)=>setForm({...form, origem: e.target.value})}/>
                <input placeholder="CIDADE DESTINO" className="border-b text-sm py-1 outline-none focus:border-blue-500 uppercase font-semibold" onChange={(e)=>setForm({...form, destino: e.target.value})}/>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1">Observações Gerais</label>
                <textarea rows="2" className="w-full border rounded p-2 text-sm outline-none focus:border-blue-500 bg-slate-50" onChange={(e)=>setForm({...form, observacao: e.target.value})}></textarea>
              </div>
            </div>
          </div>

          {/* FORMAÇÃO DE CUSTO */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-[#845132] text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider">Formação de Custo</div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Contratação</label>
                  <input type="text" value="SPOT" readOnly className="border-b border-slate-200 py-1 text-sm font-bold text-blue-700 outline-none bg-transparent cursor-not-allowed"/>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Veículo</label>
                  <select className="border-b border-slate-300 py-1 text-sm outline-none font-medium bg-transparent" onChange={(e)=>setForm({...form, tipoVeiculo: e.target.value})}>
                    <option value="CAVALO 4X2">CAVALO 4X2</option>
                    <option value="CAVALO 6X2">CAVALO 6X2</option>
                    <option value="CAVALO 6X4">CAVALO 6X4</option>
                    <option value="TRUCK">TRUCK</option>
                    <option value="TOCO">TOCO</option>
                    <option value="VLC">VLC</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo Semireboques</label>
                <select className="border-b border-slate-300 py-1 text-sm outline-none font-medium bg-transparent" onChange={(e)=>setForm({...form, tipoSemireboque: e.target.value})}>
                  <option value="VANDERLEIA">VANDERLEIA</option>
                  <option value="SIDER">SIDER</option>
                  <option value="BAÚ">BAÚ</option>
                  <option value="GRADE BAIXA">GRADE BAIXA</option>
                  <option value="GRANELEIRO">GRANELEIRO</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-[#fdf2e9] p-3 rounded-lg border border-[#f5d9c5]">
                  <label className="block text-[10px] font-black text-[#845132] uppercase mb-1">CTRB Orçado (R$)</label>
                  <input type="number" step="0.01" className="w-full bg-transparent font-black text-xl outline-none" placeholder="000,00" onChange={(e) => setForm({...form, ctrbOrcado: e.target.value})}/>
                </div>
                <div className="bg-[#fdf2e9] p-3 rounded-lg border border-[#f5d9c5]">
                  <label className="block text-[10px] font-black text-[#845132] uppercase mb-1">Pedágio CTRB (R$)</label>
                  <input type="number" step="0.01" className="w-full bg-transparent font-black text-xl outline-none" placeholder="000,00" onChange={(e) => setForm({...form, pedagioCusto: e.target.value})}/>
                </div>
              </div>
            </div>
          </div>

          {/* DADOS ADICIONAIS = Parâmetros de Cálculo*/}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-[#633619] text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider">DADOS ADICIONAIS</div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <label className="block text-[10px] font-bold uppercase text-slate-600">Valor Mercadoria (R$)</label>
                  <input type="number" className="w-full bg-transparent font-bold outline-none" placeholder="000,00" onChange={(e) => setForm({...form, valorMercadoria: e.target.value})}/>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <label className="block text-[10px] font-bold uppercase text-slate-600">Qtde. Ajudantes</label>
                  <input type="number" className="w-full bg-transparent font-bold outline-none" defaultValue="0" onChange={(e) => setForm({...form, qtdAjudante: e.target.value})}/>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <label className="block text-[10px] font-bold uppercase text-red-700 leading-tight italic">Tx. 2ª Entrega (R$)</label>
                  <input type="number" className="w-full bg-transparent font-bold outline-none text-red-700" placeholder="000,00" onChange={(e) => setForm({...form, taxaAdicionalEntrega: e.target.value})}/>
                </div>
                <div className="bg-[#e8f5e9] p-2 rounded border border-[#c8e6c9]">
                  <label className="block text-[10px] font-black uppercase text-[#2e7d32]">% LAIR Desejada</label>
                  <input type="number" value={form.percentualLairDesejada} className="w-full bg-transparent font-black text-xl text-[#1b5e20] outline-none" placeholder="00%" onChange={(e) => setForm({...form, percentualLairDesejada: e.target.value})}/>
                </div>
              </div>
            </div>
          </div>

          {/* NEGOCIAÇÃO DE SEGURO */}
          {/* <div className="bg-white rounded-lg border-2 border-green-600 overflow-hidden shadow-md">
            <div className="bg-green-600 text-white px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Percent size={14}/> Ajuste Comercial: % DESCONTO F.P/SEG/GRIS
            </div>


            <div className="p-4 bg-green-50">
              <label className="block text-[11px] font-black text-green-800 uppercase mb-1">
                % Aplicar sobre o Frete peso e Seguro</label>
              <div className="flex items-baseline gap-1">
                <input 
                  type="number" 
                  value={form.percentualDescontoSeguro} 
                  className="w-11 text-4xl font-black text-green-700 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                  placeholder="0" 
                  onChange={(e) => setForm({...form, percentualDescontoSeguro: e.target.value})}
                />
                <span className="text-4xl font-black text-green-700">%</span>
              </div>
              <p className="text-[9px] text-green-600 font-bold mt-1">* Este desconto gera a 3ª coluna da tabela de resultados.</p>
            </div>
          </div> */}

          <div 
            onClick={() => inputRef.current?.focus()}
            className="bg-white rounded-lg border-2 border-green-600 overflow-hidden shadow-md cursor-text hover:bg-green-50/30 transition-all">
            <div className="bg-green-600 text-white px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2 select-none">
              <Percent size={14}/> Ajuste Comercial: % DESCONTO F.P/SEG/GRIS
            </div>
            
            <div className="p-4 bg-green-50">
              <label className="block text-[11px] font-black text-green-800 uppercase mb-1 select-none">
                % Aplicar sobre o Frete peso e Seguro
              </label>
              
              <div className="flex items-baseline justify-start">
                <input 
                  ref={inputRef}
                  type="number"
                  step="0.01"
                  value={form.percentualDescontoSeguro || ''} 
                  className="w-[120px] text-4xl font-black text-green-700 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right" 
                  placeholder="0.00"
                  
                  // Validação em tempo real (impede passar de 99.99 ou mais de 2 decimais ao digitar)
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^\d{0,2}(\.\d{0,2})?$/.test(val)) {
                      setForm({ ...form, percentualDescontoSeguro: val });
                    }
                  }}

                  // Arredonda para 10.00 ao clicar fora do campo
                  onBlur={handleBlurOuEnter}

                  // Arredonda para 10.00 ao apertar ENTER
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleBlurOuEnter();
                      e.currentTarget.blur(); // Tira o foco para mostrar o resultado
                    }
                  }}
                />
                <span className="text-4xl font-black text-green-700 select-none ml-1">%</span>
              </div>
              
              <p className="text-[9px] text-green-600 font-bold mt-1 select-none">
                * Digite o valor e pressione Enter para fixar 00.00%
              </p>
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