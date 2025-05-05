import { useStore } from "@/lib/store";
import { formatPrice } from "@/lib/apis";
import { SymbolSelector } from "./SymbolSelector";

export function Header() {
  const selectedSymbol = useStore((state) => state.selectedSymbol);
  const snapshots = useStore((state) => state.snapshots);
  const snapshot = snapshots[selectedSymbol];
  
  // Calculate percentage change (simulated as we don't have historical data)
  const priceChangePercent = snapshot ? (Math.random() * 2 - 1).toFixed(2) : '0.00';
  const isPriceUp = parseFloat(priceChangePercent) >= 0;

  return (
    <header className="bg-card border-b border-border sticky top-0 z-10">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center space-x-4">
          <SymbolSelector />

          <div className="flex items-center">
            <span className="font-mono font-semibold text-xl">
              {snapshot ? formatPrice(snapshot.bidPrice) : '-'}
            </span>
            <span className={`ml-2 flex items-center ${isPriceUp ? 'text-green-500' : 'text-red-500'}`}>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 mr-1" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d={isPriceUp 
                    ? "M5 15l7-7 7 7" 
                    : "M19 9l-7 7-7-7"} 
                />
              </svg>
              <span className="text-sm">{isPriceUp ? '+' : ''}{priceChangePercent}%</span>
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search symbols..." 
              className="bg-muted py-2 pl-10 pr-4 rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex space-x-2">
            <button 
              className="p-2 rounded-full hover:bg-muted text-muted-foreground" 
              title="Refresh data"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button 
              className="p-2 rounded-full hover:bg-muted text-muted-foreground" 
              title="Notifications"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="w-px h-6 bg-border"></div>
            <button 
              className="p-2 rounded-full hover:bg-muted text-muted-foreground" 
              title="User settings"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
