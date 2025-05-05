import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { formatPrice } from "@/lib/apis";
import { useEffect } from "react";
import { useSymbols } from "@/lib/hooks";
import { ConnectionStatus } from "./ConnectionStatus";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const selectedSymbol = useStore((state) => state.selectedSymbol);
  const setSelectedSymbol = useStore((state) => state.setSelectedSymbol);
  const snapshots = useStore((state) => state.snapshots);
  const setSymbols = useStore((state) => state.setSymbols);
  
  const { data: symbolsData, isLoading } = useSymbols();
  
  // When symbols are loaded, update the store
  useEffect(() => {
    if (symbolsData) {
      setSymbols(symbolsData);
    }
  }, [symbolsData, setSymbols]);

  return (
    <aside className={cn(
      "w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0 hidden md:flex flex-col h-screen",
      className
    )}>
      <div className="px-6 py-4 border-b border-sidebar-border flex items-center justify-between">
        <h1 className="text-xl font-bold text-sidebar-primary flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
          CryptoLiquid
        </h1>
        <ThemeToggle />
      </div>

      {/* Watchlist */}
      <div className="p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Watchlist</h2>
        <div className="flex flex-col space-y-1 mb-4">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
              <span className="text-sm text-muted-foreground mt-2">Loading...</span>
            </div>
          ) : (
            symbolsData?.map((symbol) => (
              <div 
                key={symbol}
                className={cn(
                  "flex items-center p-2 rounded cursor-pointer",
                  selectedSymbol === symbol 
                    ? "bg-primary/10 border-l-4 border-primary" 
                    : "hover:bg-muted border-l-4 border-transparent"
                )}
                onClick={() => setSelectedSymbol(symbol)}
              >
                <span className="font-medium flex-1">{symbol}</span>
                <span className="text-sm font-mono">
                  {snapshots[symbol] 
                    ? formatPrice(snapshots[symbol].bidPrice) 
                    : "-"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-4 py-2 flex-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Navigation</h2>
        <ul className="space-y-1">
          <li>
            <a href="#" className="flex items-center p-2 rounded text-primary bg-primary/10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="ml-2">Dashboard</span>
            </a>
          </li>
          <li>
            <a href="#" className="flex items-center p-2 rounded hover:bg-muted">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="ml-2">Market Depth</span>
            </a>
          </li>
          <li>
            <a href="#" className="flex items-center p-2 rounded hover:bg-muted">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="ml-2">Comparisons</span>
            </a>
          </li>
          <li>
            <a href="#" className="flex items-center p-2 rounded hover:bg-muted">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="ml-2">Alerts</span>
            </a>
          </li>
          <li>
            <a href="#" className="flex items-center p-2 rounded hover:bg-muted">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="ml-2">Settings</span>
            </a>
          </li>
        </ul>
      </nav>

      {/* Connection Status */}
      <ConnectionStatus />
    </aside>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <button 
      className="p-2 rounded-full hover:bg-muted transition-colors"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

// Import at the top with other imports
import { useTheme } from "./ThemeProvider";
