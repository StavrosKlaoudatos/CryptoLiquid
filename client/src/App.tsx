import { Switch, Route } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import { useEffect } from "react";
import { useWebSocket } from "@/lib/hooks";
import { useStore } from "@/lib/store";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const addSnapshot = useStore((state) => state.addSnapshot);
  const addTrade = useStore((state) => state.addTrade);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    if (lastMessage) {
      try {
        const parsed = JSON.parse(lastMessage);
        
        if (parsed.type === 'snapshot' && parsed.data) {
          addSnapshot(parsed.data);
        } else if (parsed.type === 'trade' && parsed.data) {
          addTrade(parsed.data);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    }
  }, [lastMessage, addSnapshot, addTrade]);

  return (
    <TooltipProvider>
      <Toaster />
      <Router />
    </TooltipProvider>
  );
}

export default App;
