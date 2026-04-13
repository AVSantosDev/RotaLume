import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import "./App.css";
import Login from "./components/Login/Login";
import TruckIcon from "./components/TruckIcon";
import TruckIconTruck from "./components/TruckIconTruck";
import Layout from "./components/Layout";

// 1. Criamos um componente apenas para a tela de Login (com a animação)
const LoginView = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-slate-50 font-sans p-4 pt-10">
      
      {/* Título e Subtítulo */}
      <div className="text-center mb-10 w-full max-w-sm">
        <h1 className="text-4xl font-black text-slate-800 tracking-tighter">
          Rota<span className="text-blue-600">Lume</span>
        </h1>
        <p className="text-slate-500 mt-1 text-xs font-semibold uppercase tracking-[0.2em]">Cotação Inteligente Spot</p>
      </div>

      {/* Contêiner da animação */}
      <div className="relative w-full max-w-sm h-32 mb-10 overflow-hidden mask-[linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
        
        {/* Estrada suave */}
        <div className="absolute bottom-2 left-0 w-full h-1 bg-slate-200"></div>

        {/* Caminhão Principal */}
        <div className="absolute bottom-0 left-0 animate-truck-fast">
          <TruckIcon className="w-24 h-auto text-blue-600" wheelClass="wheel-fast" />
        </div>

        {/* Caminhão Seguidor (Cinza) - Agora usando as classes 'slow' */}
        <div className="absolute bottom-0 left-0 animate-truck-slow" style={{ animationDelay: '-0s' }}>
          <TruckIconTruck className="w-16 h-auto text-slate-400 opacity-70" wheelClass="wheel-slow" />
        </div>
              </div>

      {/* Componente de Login */}
      <Login />
    </div>
  );
};

// 2. O componente App agora gerencia apenas as Rotas
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota da tela inicial (Login + Animação) */}
        <Route path="/" element={<LoginView />} />

        {/* Rotas protegidas (Com a Navbar Lateral do Layout) */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<h1 className="text-2xl font-bold">Indicadores de Performance</h1>} />
          <Route path="/cotacao" element={<h1 className="text-2xl font-bold">Nova Cotação de Frete</h1>} />
          
          {/* ADICIONE ESTAS DUAS LINHAS ABAIXO */}
          <Route path="/consultar" element={<h1 className="text-2xl font-bold">Histórico de Cotações</h1>} />
          <Route path="/relatorios" element={<h1 className="text-2xl font-bold">Relatórios Operacionais</h1>} />
          
          <Route path="/configuracao" element={<h1 className="text-2xl font-bold">Configurações</h1>} />
        </Route>

        {/* Redireciona qualquer rota inexistente para o login */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}




export default App;

