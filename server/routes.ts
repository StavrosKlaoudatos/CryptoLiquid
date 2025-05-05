import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { type NormalizedLiquiditySnapshot, type WebSocketMessage, type Trade } from "@shared/schema";
import axios from "axios";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "d081c5hr01qp8st7214gd081c5hr01qp8st72150";
const TWELVE_API_KEY = process.env.TWELVE_API_KEY || "fa7f6bbac1984dbaa825219581529bc0";
const FMP_API_KEY = process.env.FMP_API_KEY || "naDhlZ81fiI56TUuDmeu6OoTFPSY6mxV";
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || "sWPILlpWBraEYLc68f22Lat9qwSwTfQH";

// Keep track of connected clients
const clients = new Set<WebSocket>();

// Cache for API rate limiting
const apiCache = new Map<string, { data: any; timestamp: number }>();

// Function to get cached data or fetch new data
async function getCachedOrFetch(url: string, cacheKey: string, ttlMs = 5000): Promise<any> {
  const now = Date.now();
  const cached = apiCache.get(cacheKey);
  
  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data;
  }
  
  try {
    const response = await axios.get(url);
    const data = response.data;
    apiCache.set(cacheKey, { data, timestamp: now });
    return data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

// Function to broadcast to all connected WebSocket clients
function broadcast(message: WebSocketMessage): void {
  const messageStr = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// Fetch crypto quote from Finnhub
async function fetchFinnhubQuote(symbol: string): Promise<NormalizedLiquiditySnapshot> {
  const formattedSymbol = symbol.replace('/', '');
  const url = `https://finnhub.io/api/v1/quote?symbol=${formattedSymbol}&token=${FINNHUB_API_KEY}`;
  const data = await getCachedOrFetch(url, `finnhub-quote-${symbol}`);
  
  // Normalize the data to our schema
  return {
    symbol,
    timestamp: Date.now(),
    bidPrice: data.c - (data.c * 0.0001), // Approximate bid as slightly below current
    askPrice: data.c + (data.c * 0.0001), // Approximate ask as slightly above current
    bidSize: Math.random() * 10 + 1, // Mock bid size since it's not provided
    askSize: Math.random() * 10 + 1, // Mock ask size since it's not provided
    volume24h: data.v || 0,
    source: 'finnhub'
  };
}

// Fetch crypto data from Twelve Data
async function fetchTwelveData(symbol: string): Promise<NormalizedLiquiditySnapshot> {
  const formattedSymbol = symbol.replace('/', '');
  const url = `https://api.twelvedata.com/quote?symbol=${formattedSymbol}&apikey=${TWELVE_API_KEY}`;
  const data = await getCachedOrFetch(url, `twelvedata-${symbol}`);
  
  return {
    symbol,
    timestamp: Date.now(),
    bidPrice: parseFloat(data.close) - (parseFloat(data.close) * 0.0002),
    askPrice: parseFloat(data.close) + (parseFloat(data.close) * 0.0002),
    bidSize: Math.random() * 15 + 2,
    askSize: Math.random() * 15 + 2,
    volume24h: parseFloat(data.volume) || 0,
    source: 'twelvedata'
  };
}

// Fetch crypto data from Financial Modeling Prep
async function fetchFMPData(symbol: string): Promise<NormalizedLiquiditySnapshot> {
  const formattedSymbol = symbol.split('/')[0]; // Get the base currency
  const url = `https://financialmodelingprep.com/api/v3/quote/${formattedSymbol}USD?apikey=${FMP_API_KEY}`;
  const data = await getCachedOrFetch(url, `fmp-${symbol}`, 10000);
  
  // Data is returned as an array
  const cryptoData = data[0] || {};
  
  return {
    symbol,
    timestamp: Date.now(),
    bidPrice: cryptoData.price * 0.9998,
    askPrice: cryptoData.price * 1.0002,
    bidSize: Math.random() * 20 + 3,
    askSize: Math.random() * 20 + 3,
    volume24h: cryptoData.volume || 0,
    source: 'fmp'
  };
}

// Fetch crypto data from Polygon
async function fetchPolygonData(symbol: string): Promise<NormalizedLiquiditySnapshot> {
  const formattedSymbol = symbol.replace('/', '-');
  const url = `https://api.polygon.io/v2/aggs/ticker/X:${formattedSymbol}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`;
  const data = await getCachedOrFetch(url, `polygon-${symbol}`, 15000);
  
  // The results can be empty if the symbol is not found
  const cryptoData = data.results?.[0] || {};
  
  return {
    symbol,
    timestamp: Date.now(),
    bidPrice: cryptoData.c - (cryptoData.c * 0.0003),
    askPrice: cryptoData.c + (cryptoData.c * 0.0003),
    bidSize: Math.random() * 25 + 5,
    askSize: Math.random() * 25 + 5,
    volume24h: cryptoData.v || 0,
    source: 'polygon'
  };
}

// Fetch order book depth data
async function fetchOrderBookData(symbol: string): Promise<{ bids: any[]; asks: any[] }> {
  const formattedSymbol = symbol.replace('/', '');
  try {
    const url = `https://finnhub.io/api/v1/crypto/orderbook?symbol=BINANCE:${formattedSymbol}&token=${FINNHUB_API_KEY}`;
    const data = await getCachedOrFetch(url, `orderbook-${symbol}`, 5000);
    
    return {
      bids: data.bids || [],
      asks: data.asks || []
    };
  } catch (error) {
    console.error(`Error fetching order book for ${symbol}:`, error);
    // Return empty order book if there's an error
    return { bids: [], asks: [] };
  }
}

// Simulate trades for demo purposes (since trade data might not be available from APIs)
function simulateTrade(symbol: string, currentPrice: number): Trade {
  const isBuy = Math.random() > 0.5;
  const sizeVariation = Math.random() * 2 - 1; // between -1 and 1
  const priceVariation = (Math.random() * 0.002 - 0.001) * currentPrice; // tiny price variation
  
  return {
    symbol,
    timestamp: Date.now(),
    price: currentPrice + priceVariation,
    size: Math.max(0.01, Math.random() * 2 + sizeVariation),
    isBuyerMaker: !isBuy // inverted for maker/taker
  };
}

// Fetch all available data for a symbol
async function fetchAllDataForSymbol(symbol: string): Promise<NormalizedLiquiditySnapshot> {
  try {
    // We'll try multiple sources and use the first one that succeeds
    try {
      const finnhubData = await fetchFinnhubQuote(symbol);
      const orderBook = await fetchOrderBookData(symbol);
      
      // Convert order book to our depth levels format
      const depthLevels = {
        bids: orderBook.bids.map(([price, size]) => ({ price: parseFloat(price), size: parseFloat(size) })),
        asks: orderBook.asks.map(([price, size]) => ({ price: parseFloat(price), size: parseFloat(size) }))
      };
      
      // Add depth levels to the snapshot
      return {
        ...finnhubData,
        depthLevels
      };
    } catch (e) {
      console.log(`Finnhub fetch failed for ${symbol}, trying Twelve Data`);
      try {
        return await fetchTwelveData(symbol);
      } catch (e) {
        console.log(`Twelve Data fetch failed for ${symbol}, trying FMP`);
        try {
          return await fetchFMPData(symbol);
        } catch (e) {
          console.log(`FMP fetch failed for ${symbol}, trying Polygon`);
          return await fetchPolygonData(symbol);
        }
      }
    }
  } catch (error) {
    console.error(`All data sources failed for ${symbol}:`, error);
    // Return a default snapshot with the error
    return {
      symbol,
      timestamp: Date.now(),
      bidPrice: 0,
      askPrice: 0,
      bidSize: 0,
      askSize: 0,
      volume24h: 0,
      source: 'error'
    };
  }
}

// Poll for updates and broadcast them to all clients
async function pollAndBroadcastUpdates() {
  try {
    const symbols = await storage.getSymbols();
    
    for (const symbol of symbols) {
      try {
        const snapshot = await fetchAllDataForSymbol(symbol);
        
        // Save to in-memory storage
        await storage.saveLiquiditySnapshot(snapshot);
        
        // Generate and save a simulated trade
        if (snapshot.bidPrice > 0) {
          const trade = simulateTrade(symbol, snapshot.bidPrice);
          await storage.saveTrade(trade);
          
          // Broadcast trade to all clients
          broadcast({
            type: 'trade',
            data: trade
          });
        }
        
        // Broadcast snapshot to all clients
        broadcast({
          type: 'snapshot',
          data: snapshot
        });
      } catch (error) {
        console.error(`Error processing ${symbol}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in polling updates:", error);
  }
  
  // Schedule next poll (every 5 seconds)
  setTimeout(pollAndBroadcastUpdates, 5000);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  app.get('/api/symbols', async (req, res) => {
    try {
      const symbols = await storage.getSymbols();
      res.json(symbols);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching symbols' });
    }
  });

  app.get('/api/liquidity/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol;
      let snapshot = await storage.getLiquiditySnapshot(symbol);
      
      // If no snapshot is available, fetch it
      if (!snapshot) {
        snapshot = await fetchAllDataForSymbol(symbol);
        await storage.saveLiquiditySnapshot(snapshot);
      }
      
      res.json(snapshot);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching liquidity data' });
    }
  });

  app.get('/api/trades/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol;
      const limit = parseInt(req.query.limit as string || '50', 10);
      const trades = await storage.getRecentTrades(symbol, limit);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching trades' });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup WebSocket server on a distinct path
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('Client connected');
    clients.add(ws);
    
    // Send initial data for all symbols
    storage.getSymbols().then(async (symbols) => {
      for (const symbol of symbols) {
        const snapshot = await storage.getLiquiditySnapshot(symbol);
        if (snapshot) {
          ws.send(JSON.stringify({
            type: 'snapshot',
            data: snapshot
          }));
        }
      }
    }).catch(error => {
      console.error('Error sending initial data:', error);
    });
    
    ws.on('close', () => {
      console.log('Client disconnected');
      clients.delete(ws);
    });
  });
  
  // Start polling for updates
  pollAndBroadcastUpdates();
  
  return httpServer;
}
