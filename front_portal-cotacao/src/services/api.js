import { getApiBase } from '../config/api';

const base = () => getApiBase();

export const apiService = {
  getVeiculos: async () => {
    const response = await fetch(`${base()}/veiculos/`);
    if (!response.ok) throw new Error('Erro ao buscar veículos');
    return await response.json();
  },

  getSemireboques: async () => {
    const response = await fetch(`${base()}/semireboques/`);
    if (!response.ok) throw new Error('Erro ao buscar semireboques');
    return await response.json();
  },

  getClientes: async (termo) => {
    const response = await fetch(`${base()}/clientes/?search=${encodeURIComponent(termo)}`);
    if (!response.ok) throw new Error('Erro ao buscar clientes');
    return await response.json();
  }
};
