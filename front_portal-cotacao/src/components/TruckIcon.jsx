const TruckIcon = () => (
  <svg
    viewBox="0 0 100 40"
    className="w-24 h-auto text-blue-600"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Carreta (Sider/Baú longo) */}
    <rect x="2" y="10" width="55" height="18" rx="1" fill="currentColor" fillOpacity="0.1" />
    
    {/* Conexão (Quinta roda) */}
    <line x1="57" y1="24" x2="61" y2="24" opacity="0.6" />

    {/* Cavalo (Cabine) */}
    <path d="M61 15 h10 l6 6 v7 h-16 z" fill="currentColor" fillOpacity="0.2" />
    <rect x="65" y="17" width="5" height="4" rx="1" />

    {/* Rodas (Mesmo estilo do TruckIconTruck) */}
    <circle cx="10" cy="32" r="3" fill="currentColor" />
    <circle cx="20" cy="32" r="3" fill="currentColor" />
    <circle cx="50" cy="32" r="3" fill="currentColor" />
    <circle cx="68" cy="32" r="3" fill="currentColor" />
    {/* <circle cx="78" cy="32" r="3" fill="currentColor" /> */}
    
    {/* Linhas de movimento atrás */}
    <line x1="-5" y1="15" x2="-2" y2="15" opacity="0.4" />
    <line x1="-8" y1="20" x2="-3" y2="20" opacity="0.4" />
  </svg>
);

export default TruckIcon;