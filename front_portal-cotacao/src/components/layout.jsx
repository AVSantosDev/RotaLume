
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import PropTypes from "prop-types";
import { LayoutDashboard, Truck, Settings, LogOut, FileText, Search, ChevronDown, ChevronRight, ChevronLeft, Shield, MapPin, Ruler } from "lucide-react";

const SidebarItem = ({ icon: Icon, label, path, active, collapsed }) => (
  <Link
    to={path}
    className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 group
      ${active 
        ? "bg-blue-600 text-white shadow-lg" 
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    title={collapsed ? label : undefined}
  >
    <Icon
      size={20}
      className={active ? "text-white" : "group-hover:text-blue-400"}
    />
    {!collapsed && <span className="font-medium">{label}</span>}
  </Link>
);

SidebarItem.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  active: PropTypes.bool,
  collapsed: PropTypes.bool,
};

const Layout = () => {
  const location = useLocation();
  const [configMenuOpen, setConfigMenuOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [configPopoverOpen, setConfigPopoverOpen] = useState(false);

  const isConfigOperacional = location.pathname === "/configuracao";
  const isConfigSistema = location.pathname.startsWith("/configuracao/sistema");
  const isConfigArea = isConfigOperacional || isConfigSistema;

  useEffect(() => {
    if (isConfigArea) setConfigMenuOpen(true);
  }, [isConfigArea]);

  useEffect(() => {
    setConfigPopoverOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sidebarCollapsed");
      if (raw === "1") setSidebarCollapsed(true);
      if (raw === "0") setSidebarCollapsed(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sidebarCollapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!sidebarCollapsed || !configPopoverOpen) return;

    const onDocPointerDown = (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      // fecha se clicar fora do container do popover/botão
      if (!target.closest("[data-config-popover-root='1']")) {
        setConfigPopoverOpen(false);
      }
    };

    const onKeyDown = (ev) => {
      if (ev.key === "Escape") setConfigPopoverOpen(false);
    };

    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarCollapsed, configPopoverOpen]);

  const collapseToggleLabel = useMemo(
    () => (sidebarCollapsed ? "Expandir menu" : "Recolher menu"),
    [sidebarCollapsed],
  );

  const subLinkClass = (active) =>
    `flex items-center rounded-lg py-2 pl-3 pr-2 text-xs font-medium transition-colors border-l-2 ml-1
    ${active
      ? "border-blue-500 bg-slate-800 text-white"
      : "border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-white"
    }`;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <aside
        className={`${sidebarCollapsed ? "w-20 p-3" : "w-64 p-4"} bg-slate-900 flex flex-col shadow-xl z-20 transition-[width,padding] duration-200`}
      >
        
        <div className={`${sidebarCollapsed ? "px-0 py-4" : "px-2 py-6"} mb-3`}>
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"} gap-2`}>
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Truck size={18} className="text-white" />
              </div>
              {!sidebarCollapsed && (
                <span className="tracking-tight italic">
                  Rota<span className="text-blue-400">Lume</span>
                </span>
              )}
            </h2>

            {!sidebarCollapsed && (
              <button
                type="button"
                title={collapseToggleLabel}
                onClick={() => setSidebarCollapsed(true)}
                className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
          </div>

          {sidebarCollapsed && (
            <button
              type="button"
              title={collapseToggleLabel}
              onClick={() => setSidebarCollapsed(false)}
              className="mt-3 flex w-full items-center justify-center rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem
            icon={LayoutDashboard}
            label="Indicadores"
            path="/dashboard"
            active={location.pathname === "/dashboard"}
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            icon={Truck}
            label="Nova Cotação SPOT"
            path="/cotacao"
            active={location.pathname === "/cotacao"}
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            icon={MapPin}
            label="Cotações Dedicado"
            path="/cotacao/dedicado"
            active={location.pathname === "/cotacao/dedicado"}
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            icon={Ruler}
            label="Cotações - Faixa de KM"
            path="/cotacao/faixa-km"
            active={location.pathname === "/cotacao/faixa-km"}
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            icon={Search}
            label="Consultar Cotações"
            path="/consultar"
            active={location.pathname === "/consultar"}
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            icon={FileText}
            label="Relatórios"
            path="/relatorios"
            active={location.pathname === "/relatorios"}
            collapsed={sidebarCollapsed}
          />

          <div className="space-y-1 pt-1 relative" data-config-popover-root="1">
            <button
              type="button"
              onClick={() => {
                if (sidebarCollapsed) setConfigPopoverOpen((o) => !o);
                else setConfigMenuOpen((o) => !o);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors
                ${isConfigArea ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}
              `}
              title={sidebarCollapsed ? "Configuração" : undefined}
            >
              <span className="flex items-center gap-3 font-medium">
                <Settings size={20} />
                {!sidebarCollapsed && "Configuração"}
              </span>
              {!sidebarCollapsed && (configMenuOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />)}
            </button>

            {sidebarCollapsed && configPopoverOpen && (
              <div
                className="absolute left-full top-0 ml-2 w-64 rounded-xl border border-slate-700/60 bg-slate-900 shadow-2xl ring-1 ring-black/30 overflow-hidden"
                role="menu"
              >
                <div className="px-3 py-2 border-b border-slate-800">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    Configuração
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Selecione uma opção
                  </div>
                </div>
                <div className="p-2 space-y-1">
                  <Link
                    to="/configuracao"
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
                      isConfigOperacional
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                    role="menuitem"
                    onClick={() => setConfigPopoverOpen(false)}
                  >
                    <Settings size={16} className="opacity-90" />
                    <span>Configuração operacional</span>
                  </Link>
                  <Link
                    to="/configuracao/sistema"
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
                      isConfigSistema
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                    role="menuitem"
                    onClick={() => setConfigPopoverOpen(false)}
                  >
                    <Shield size={16} className="opacity-90" />
                    <span>Configuração sistema</span>
                  </Link>
                </div>
              </div>
            )}

            {!sidebarCollapsed && configMenuOpen && (
              <div className="space-y-0.5 pb-1 pl-1 pt-1">
                <Link to="/configuracao" className={subLinkClass(isConfigOperacional)}>
                  <Settings size={14} className="mr-2 shrink-0 opacity-80" />
                  <span className="leading-tight">Configuração operacional</span>
                </Link>
                <Link to="/configuracao/sistema" className={subLinkClass(isConfigSistema)}>
                  <Shield size={14} className="mr-2 shrink-0 opacity-80" />
                  <span className="leading-tight">Configuração sistema</span>
                </Link>
              </div>
            )}
          </div>
        </nav>

        <div className="pt-4 border-t border-slate-800">
          <Link
            to="/"
            className="flex items-center space-x-3 p-3 text-slate-400 hover:text-red-400 transition-colors group rounded-lg hover:bg-slate-800"
            title={sidebarCollapsed ? "Sair" : undefined}
          >
            <LogOut size={20} className="group-hover:animate-pulse" />
            {!sidebarCollapsed && <span>Sair</span>}
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
