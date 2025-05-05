import { NormalizedLiquiditySnapshot, Trade } from "@shared/schema";
import { apiRequest } from "./queryClient";

// API functions for fetching data
export async function fetchSymbols(): Promise<string[]> {
  const response = await apiRequest("GET", "/api/symbols");
  return response.json();
}

export async function fetchLiquiditySnapshot(symbol: string): Promise<NormalizedLiquiditySnapshot> {
  const response = await apiRequest("GET", `/api/liquidity/${encodeURIComponent(symbol)}`);
  return response.json();
}

export async function fetchTrades(symbol: string, limit: number = 50): Promise<Trade[]> {
  const response = await apiRequest("GET", `/api/trades/${encodeURIComponent(symbol)}?limit=${limit}`);
  return response.json();
}

// Helper functions for data formatting
export function formatPrice(price: number, precision: number = 2): string {
  // For crypto, we need different precision based on price magnitude
  if (price >= 1000) {
    // For BTC-like, format with commas and 2 decimal places
    return price.toLocaleString('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    });
  } else if (price >= 1) {
    // For mid-range like ETH, show more precision
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    });
  } else {
    // For low-value coins, show even more precision
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6
    });
  }
}

export function formatCryptoAmount(amount: number, symbol: string): string {
  // Extract the base currency from symbol (e.g., BTC from BTC/USD)
  const baseCurrency = symbol.split('/')[0];
  
  return `${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  })} ${baseCurrency}`;
}

export function formatUsdAmount(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

export function calculateSpread(bidPrice: number, askPrice: number): { spread: number, spreadPct: number } {
  const spread = askPrice - bidPrice;
  const spreadPct = (spread / bidPrice) * 100;
  
  return {
    spread,
    spreadPct
  };
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
