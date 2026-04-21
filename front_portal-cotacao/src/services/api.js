const BASE_URL = 'http://localhost:8000/api';

export const apiService = {
  // Busca Veículos (Viewset de Veículos)
  getVeiculos: async () => {
    const response = await fetch(`${BASE_URL}/veiculos/`);
    if (!response.ok) throw new Error('Erro ao buscar veículos');
    return await response.json();
  },

  // Busca Semireboques (Viewset de Semireboques)
  getSemireboques: async () => {
    const response = await fetch(`${BASE_URL}/semireboques/`);
    if (!response.ok) throw new Error('Erro ao buscar semireboques');
    return await response.json();
  },

  // Busca Clientes (Viewset de Clientes com filtro ?search=)
  getClientes: async (termo) => {
    const response = await fetch(`${BASE_URL}/clientes/?search=${termo}`);
    if (!response.ok) throw new Error('Erro ao buscar clientes');
    return await response.json();
  }
};