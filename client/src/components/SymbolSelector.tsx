import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useSymbols } from "@/lib/hooks";

export function SymbolSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedSymbol = useStore((state) => state.selectedSymbol);
  const setSelectedSymbol = useStore((state) => state.setSelectedSymbol);
  
  const { data: symbols, isLoading } = useSymbols();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle symbol selection
  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        className="flex items-center space-x-2 bg-muted px-3 py-2 rounded-md hover:bg-muted/80 focus:outline-none transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">{selectedSymbol}</span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen ? "transform rotate-180" : ""
          )} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute left-0 mt-1 w-48 rounded-md shadow-lg bg-popover border border-border z-20">
          <div className="max-h-60 overflow-y-auto py-1">
            {isLoading ? (
              <div className="px-4 py-2 text-center">
                <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : (
              symbols?.map((symbol) => (
                <div
                  key={symbol}
                  className={cn(
                    "px-4 py-2 text-sm cursor-pointer hover:bg-muted",
                    selectedSymbol === symbol ? "bg-primary/10 text-primary" : ""
                  )}
                  onClick={() => handleSelectSymbol(symbol)}
                >
                  {symbol}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
