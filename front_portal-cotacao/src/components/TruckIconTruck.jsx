const TruckIconTruck = () => (
  <svg
    viewBox="0 0 70 40"
    className="w-16 h-auto text-gray-500"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Baú */}
    <rect x="2" y="10" width="40" height="18" rx="1" fill="currentColor" fillOpacity="0.1" />
    
    {/* Cabine */}
    <path d="M42 15 h10 l6 6 v7 h-16 z" fill="currentColor" fillOpacity="0.2" />
    <rect x="46" y="17" width="5" height="4" rx="1" />

    {/* Rodas */}
    <circle cx="10" cy="32" r="3" fill="currentColor" />
    <circle cx="34" cy="32" r="3" fill="currentColor" />
    <circle cx="52" cy="32" r="3" fill="currentColor" />
    
    {/* Linhas de movimento atrás */}
    <line x1="-5" y1="15" x2="-2" y2="15" opacity="0.5" />
    <line x1="-8" y1="20" x2="-3" y2="20" opacity="0.5" />
  </svg>
);

export default TruckIconTruck;