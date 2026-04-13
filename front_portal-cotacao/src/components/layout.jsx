
import { Link, useLocation, Outlet } from "react-router-dom";
import PropTypes from "prop-types";
import { LayoutDashboard, Truck, Settings, LogOut, FileText, Search } from "lucide-react"; // Adicionei Search e FileText

const SidebarItem = ({ icon: Icon, label, path, active }) => (
  <Link
    to={path}
    className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 group
      ${active 
        ? "bg-blue-600 text-white shadow-lg" 
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
  >
    <Icon
      size={20}
      className={active ? "text-white" : "group-hover:text-blue-400"}
    />
    <span className="font-medium">{label}</span>
  </Link>
);

SidebarItem.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  active: PropTypes.bool,
};

const Layout = () => {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <aside className="w-64 bg-slate-900 flex flex-col p-4 shadow-xl z-20">
        
        <div className="px-2 py-6 mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Truck size={18} className="text-white" />
            </div>
            <span className="tracking-tight italic">
              Rota<span className="text-blue-400">Lume</span>
            </span>
          </h2>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem
            icon={LayoutDashboard}
            label="Indicadores"
            path="/dashboard"
            active={location.pathname === "/dashboard"}
          />
          <SidebarItem
            icon={Truck}
            label="Nova Cotação"
            path="/cotacao"
            active={location.pathname === "/cotacao"}
          />
          {/* Nova Aba: Consultar */}
          <SidebarItem
            icon={Search}
            label="Consultar Cotações"
            path="/consultar"
            active={location.pathname === "/consultar"}
          />
          {/* Nova Aba: Relatórios */}
          <SidebarItem
            icon={FileText}
            label="Relatórios"
            path="/relatorios"
            active={location.pathname === "/relatorios"}
          />
          
          <SidebarItem
            icon={Settings}
            label="Configuração"
            path="/configuracao"
            active={location.pathname === "/configuracao"}
          />
        </nav>

        <div className="pt-4 border-t border-slate-800">
          <Link
            to="/"
            className="flex items-center space-x-3 p-3 text-slate-400 hover:text-red-400 transition-colors group"
          >
            <LogOut size={20} className="group-hover:animate-pulse" />
            <span>Sair</span>
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 relative">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;