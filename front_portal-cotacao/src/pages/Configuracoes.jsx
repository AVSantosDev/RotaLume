import { useState } from 'react';
import { Map, Truck, DollarSign, Plus } from 'lucide-react';

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState('icms');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Painel de Configurações Operacionais</h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button onClick={() => setActiveTab('icms')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition ${activeTab === 'icms' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Map size={18} /> Matriz ICMS
          </button>
          <button onClick={() => setActiveTab('veiculos')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition ${activeTab === 'veiculos' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Truck size={18} /> Veículos/Custo
          </button>
          <button onClick={() => setActiveTab('taxas')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition ${activeTab === 'taxas' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}>
            <DollarSign size={18} /> Impostos e Taxas
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'icms' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-slate-700 text-lg">Alíquotas Interestaduais</h2>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700">
                  <Plus size={16} /> Nova Alíquota
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Exemplo de itens da matriz */}
                {['SP-RJ: 12%', 'SP-MG: 12%', 'PR-SP: 7%', 'SP-SC: 12%'].map((item) => (
                  <div key={item} className="p-3 border rounded-lg bg-slate-50 flex justify-between items-center">
                    <span className="font-mono text-sm font-bold">{item}</span>
                    <button className="text-blue-500 hover:underline text-xs">Editar</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'veiculos' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-700 text-lg">Tipos de Frota e Implementos</h2>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <th className="p-3 border-b">Descrição</th>
                    <th className="p-3 border-b">Eixos</th>
                    <th className="p-3 border-b">Custo Base</th>
                    <th className="p-3 border-b">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-sm border-b hover:bg-slate-50">
                    <td className="p-3 font-medium">Cavalo 6x2 + Vanderleia</td>
                    <td className="p-3">6</td>
                    <td className="p-3">R$ 4,50/km</td>
                    <td className="p-3"><button className="text-blue-600">Editar</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;