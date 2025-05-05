import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { useWebSocket } from "@/lib/hooks";

export default function Home() {
  const setWebsocketState = useStore((state) => state.setWebsocketState);
  const { readyState, READY_STATE } = useWebSocket();

  // Update the websocket state in the store
  useEffect(() => {
    setWebsocketState(readyState);
  }, [readyState, setWebsocketState]);
  
  // Fetch initial symbols from API
  const { data: symbols } = useQuery({
    queryKey: ['/api/symbols'],
  });
  
  // Update store with fetched symbols
  const setSymbols = useStore((state) => state.setSymbols);
  useEffect(() => {
    if (symbols) {
      setSymbols(symbols);
    }
  }, [symbols, setSymbols]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex" />
      
      {/* Mobile sidebar toggle */}
      <div className="md:hidden fixed bottom-4 left-4 z-50">
        <button className="bg-primary text-primary-foreground p-3 rounded-full shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-background">
        <Header />
        <Dashboard />
      </main>
    </div>
  );
}
