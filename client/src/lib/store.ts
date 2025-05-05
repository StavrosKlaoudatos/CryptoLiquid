import { create } from 'zustand';
import { NormalizedLiquiditySnapshot, Trade } from '@shared/schema';

// Define the store state
interface StoreState {
  selectedSymbol: string;
  snapshots: Record<string, NormalizedLiquiditySnapshot>;
  trades: Record<string, Trade[]>;
  symbols: string[];
  websocketState: number;
  lastUpdated: number | null;
  
  // Actions
  setSelectedSymbol: (symbol: string) => void;
  addSnapshot: (snapshot: NormalizedLiquiditySnapshot) => void;
  addTrade: (trade: Trade) => void;
  setSymbols: (symbols: string[]) => void;
  setWebsocketState: (state: number) => void;
}

// Create the store
export const useStore = create<StoreState>((set, get) => ({
  selectedSymbol: 'BTC/USD',
  snapshots: {},
  trades: {},
  symbols: [],
  websocketState: WebSocket.CONNECTING,
  lastUpdated: null,
  
  setSelectedSymbol: (symbol) => set({ selectedSymbol }),
  
  addSnapshot: (snapshot) => {
    set((state) => {
      // Keep only the most recent snapshot per symbol
      const updatedSnapshots = {
        ...state.snapshots,
        [snapshot.symbol]: snapshot
      };
      
      return {
        snapshots: updatedSnapshots,
        lastUpdated: Date.now()
      };
    });
  },
  
  addTrade: (trade) => {
    set((state) => {
      const symbol = trade.symbol;
      const currentTrades = state.trades[symbol] || [];
      
      // Add the new trade and keep only the last 100 trades
      const updatedTrades = [trade, ...currentTrades].slice(0, 100);
      
      return {
        trades: {
          ...state.trades,
          [symbol]: updatedTrades
        }
      };
    });
  },
  
  setSymbols: (symbols) => set({ symbols }),
  
  setWebsocketState: (websocketState) => set({ websocketState })
}));
