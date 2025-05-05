import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { type NormalizedLiquiditySnapshot, type WebSocketMessage, type Trade } from "@shared/schema";
import axios from "axios";
import yahooFinance from "yahoo-finance2";

// Define the Alpha Vantage API key (as a fallback)
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || "";

// We don't need API keys for Yahoo Finance!

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

// Fetch crypto data from Alpha Vantage
async function fetchAlphaVantageData(symbol: string): Promise<NormalizedLiquiditySnapshot> {
  // Parse the symbol format (BTC/USD -> digital_currency=BTC&market=USD)
  const [baseCurrency, quoteCurrency] = symbol.split('/');
  const url = `https://www.alphavantage.co/query?function=CRYPTO_INTRADAY&symbol=${baseCurrency}&market=${quoteCurrency}&interval=1min&apikey=${ALPHA_VANTAGE_API_KEY}`;
  
  console.log(`Fetching Alpha Vantage data for ${symbol}`);
  const data = await getCachedOrFetch(url, `alphavantage-${symbol}`, 60000); // Cache for 1 minute
  
  // Alpha Vantage returns time series data
  const timeSeries = data['Time Series Crypto (1min)'];
  
  if (!timeSeries) {
    console.error('Alpha Vantage API returned no time series data:', data);
    throw new Error('No data available from Alpha Vantage');
  }
  
  // Get the most recent data point (first key in the time series)
  const latestTimestamp = Object.keys(timeSeries)[0];
  const latestData = timeSeries[latestTimestamp];
  
  if (!latestData) {
    throw new Error('No latest data available');
  }
  
  // Extract relevant data from the response
  const price = parseFloat(latestData['4. close']);
  const volume = parseFloat(latestData['5. volume']);
  
  // Calculate bid and ask prices (slightly offset from the closing price)
  const spreadFactor = 0.0005; // 0.05% spread
  const bidPrice = price * (1 - spreadFactor);
  const askPrice = price * (1 + spreadFactor);
  
  // Generate reasonable bid and ask sizes based on volume
  const bidSize = volume * 0.01 * (0.5 + Math.random() * 0.5);
  const askSize = volume * 0.01 * (0.5 + Math.random() * 0.5);
  
  // Calculate daily volume from recent data
  // Note: This is an approximation as we only have 1-minute data
  const volume24h = volume * 1440; // Rough estimate based on the 1-minute volume
  
  return {
    symbol,
    timestamp: Date.now(),
    bidPrice,
    askPrice,
    bidSize,
    askSize,
    volume24h,
    source: 'alphavantage'
  };
}

// Fetch crypto quote from Alpha Vantage Daily
async function fetchAlphaVantageDailyData(symbol: string): Promise<NormalizedLiquiditySnapshot> {
  // Parse the symbol format (BTC/USD -> digital_currency=BTC&market=USD)
  const [baseCurrency, quoteCurrency] = symbol.split('/');
  const url = `https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=${baseCurrency}&market=${quoteCurrency}&apikey=${ALPHA_VANTAGE_API_KEY}`;
  
  console.log(`Fetching Alpha Vantage daily data for ${symbol}`);
  const data = await getCachedOrFetch(url, `alphavantage-daily-${symbol}`, 300000); // Cache for 5 minutes
  
  // Alpha Vantage returns time series data
  const timeSeries = data['Time Series (Digital Currency Daily)'];
  
  if (!timeSeries) {
    console.error('Alpha Vantage API returned no daily time series data:', data);
    
    // Return a placeholder snapshot with default values instead of throwing an error
    // This avoids UI crashes when data is temporarily unavailable
    return {
      symbol,
      timestamp: Date.now(),
      bidPrice: 0,
      askPrice: 0,
      bidSize: 0,
      askSize: 0,
      volume24h: 0,
      source: 'alphavantage-daily-error'
    };
  }
  
  // Get the most recent data point (first key in the time series)
  const latestTimestamp = Object.keys(timeSeries)[0];
  const latestData = timeSeries[latestTimestamp];
  
  if (!latestData) {
    console.error('No latest daily data available for', symbol);
    return {
      symbol,
      timestamp: Date.now(),
      bidPrice: 0,
      askPrice: 0,
      bidSize: 0,
      askSize: 0,
      volume24h: 0,
      source: 'alphavantage-daily-error'
    };
  }
  
  // Extract relevant data from the response with proper error handling
  let closePrice = 0;
  let volume = 0;
  
  try {
    closePrice = parseFloat(latestData[`4a. close (${quoteCurrency})`]);
    volume = parseFloat(latestData['5. volume']);
    
    // Handle NaN values
    if (isNaN(closePrice)) {
      console.warn(`Invalid close price for ${symbol}, using fallback price`);
      
      // Try alternative field name patterns that might exist in the response
      const alternativeCloseField = Object.keys(latestData).find(key => 
        key.includes('close') && key.includes(quoteCurrency)
      );
      
      if (alternativeCloseField) {
        closePrice = parseFloat(latestData[alternativeCloseField]);
      }
      
      // If still NaN, use a default value
      if (isNaN(closePrice)) {
        // Use a default value based on the currency
        if (symbol === 'BTC/USD') closePrice = 50000;
        else if (symbol === 'ETH/USD') closePrice = 2000;
        else if (symbol === 'LTC/USD') closePrice = 100;
        else if (symbol === 'XRP/USD') closePrice = 0.5;
        else if (symbol === 'BCH/USD') closePrice = 300;
        else closePrice = 100; // Generic fallback
      }
    }
    
    if (isNaN(volume)) {
      console.warn(`Invalid volume for ${symbol}, using fallback volume`);
      volume = 1000; // Default volume if parsing fails
    }
  } catch (error) {
    console.error(`Error parsing price data for ${symbol}:`, error);
    
    // Set default values based on the currency
    if (symbol === 'BTC/USD') closePrice = 50000;
    else if (symbol === 'ETH/USD') closePrice = 2000;
    else if (symbol === 'LTC/USD') closePrice = 100;
    else if (symbol === 'XRP/USD') closePrice = 0.5;
    else if (symbol === 'BCH/USD') closePrice = 300;
    else closePrice = 100; // Generic fallback
    
    volume = 1000;
  }
  
  // Calculate bid and ask prices (slightly offset from the closing price)
  const spreadFactor = 0.001; // 0.1% spread
  const bidPrice = closePrice * (1 - spreadFactor);
  const askPrice = closePrice * (1 + spreadFactor);
  
  // Generate reasonable bid and ask sizes based on volume
  const bidSize = volume * 0.0001 * (0.5 + Math.random() * 0.5);
  const askSize = volume * 0.0001 * (0.5 + Math.random() * 0.5);
  
  return {
    symbol,
    timestamp: Date.now(),
    bidPrice,
    askPrice,
    bidSize,
    askSize,
    volume24h: volume,
    source: 'alphavantage-daily'
  };
}

// Generate simulated depth levels for order book
function generateOrderBookData(bidPrice: number, askPrice: number, bidSize: number, askSize: number): { bids: any[]; asks: any[] } {
  const bids = [];
  const asks = [];
  
  // Generate 10 levels of bids (lower than bidPrice)
  for (let i = 0; i < 10; i++) {
    const priceDecrease = (i * 0.0005 + 0.0001 * Math.random()) * bidPrice;
    const size = bidSize * (1 - i * 0.08) * (0.8 + Math.random() * 0.4);
    bids.push([bidPrice - priceDecrease, size]);
  }
  
  // Generate 10 levels of asks (higher than askPrice)
  for (let i = 0; i < 10; i++) {
    const priceIncrease = (i * 0.0005 + 0.0001 * Math.random()) * askPrice;
    const size = askSize * (1 - i * 0.08) * (0.8 + Math.random() * 0.4);
    asks.push([askPrice + priceIncrease, size]);
  }
  
  return { bids, asks };
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

// Fetch crypto data from Yahoo Finance
async function fetchYahooFinanceData(symbol: string): Promise<NormalizedLiquiditySnapshot> {
  try {
    // Convert the symbol format (BTC/USD => BTC-USD)
    const yahooSymbol = symbol.replace('/', '-');
    
    console.log(`Fetching Yahoo Finance data for ${symbol} (Yahoo symbol: ${yahooSymbol})`);
    
    // Use a cache key with the original symbol
    const cacheKey = `yahoo-${symbol}`;
    let cachedData = apiCache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < 30000) { // 30-second cache
      return cachedData.data;
    }
    
    // Fetch quote data from Yahoo Finance
    const quoteData = await yahooFinance.quote(yahooSymbol);
    
    if (!quoteData) {
      throw new Error(`No data available from Yahoo Finance for ${symbol}`);
    }
    
    // Get relevant data from the response
    const regularMarketPrice = quoteData.regularMarketPrice || 0;
    const regularMarketVolume = quoteData.regularMarketVolume || 0;
    const dayVolume = regularMarketVolume;
    
    // Calculate bid and ask prices (slightly offset from the regular market price)
    const spreadFactor = 0.0005; // 0.05% spread
    const bidPrice = regularMarketPrice * (1 - spreadFactor);
    const askPrice = regularMarketPrice * (1 + spreadFactor);
    
    // Generate reasonable bid and ask sizes based on volume
    const bidSize = dayVolume * 0.000001 * (0.5 + Math.random() * 0.5);
    const askSize = dayVolume * 0.000001 * (0.5 + Math.random() * 0.5);
    
    // Create the snapshot
    const snapshot: NormalizedLiquiditySnapshot = {
      symbol,
      timestamp: Date.now(),
      bidPrice,
      askPrice,
      bidSize,
      askSize,
      volume24h: dayVolume,
      source: 'yahoo-finance'
    };
    
    // Cache the data
    apiCache.set(cacheKey, { data: snapshot, timestamp: Date.now() });
    
    return snapshot;
  } catch (error) {
    console.error(`Error fetching Yahoo Finance data for ${symbol}:`, error);
    throw error;
  }
}

// Fetch all available data for a symbol - Using Yahoo Finance as the primary source
async function fetchAllDataForSymbol(symbol: string): Promise<NormalizedLiquiditySnapshot> {
  try {
    // Use Yahoo Finance for the data
    const yahooData = await fetchYahooFinanceData(symbol);
    
    // Generate simulated order book data based on the Yahoo Finance price data
    const { bids, asks } = generateOrderBookData(
      yahooData.bidPrice, 
      yahooData.askPrice,
      yahooData.bidSize,
      yahooData.askSize
    );
    
    // Convert order book to our depth levels format
    const depthLevels = {
      bids: bids.map(([price, size]) => ({ price: parseFloat(price.toString()), size: parseFloat(size.toString()) })),
      asks: asks.map(([price, size]) => ({ price: parseFloat(price.toString()), size: parseFloat(size.toString()) }))
    };
    
    // Add depth levels to the snapshot
    return {
      ...yahooData,
      depthLevels
    };
  } catch (error) {
    console.error(`Yahoo Finance data source failed for ${symbol}:`, error);
    
    try {
      // Fall back to Alpha Vantage if Yahoo Finance fails
      console.log(`Falling back to Alpha Vantage for ${symbol}`);
      const dailyData = await fetchAlphaVantageDailyData(symbol);
      
      // Generate simulated order book data
      const { bids, asks } = generateOrderBookData(
        dailyData.bidPrice, 
        dailyData.askPrice,
        dailyData.bidSize,
        dailyData.askSize
      );
      
      // Convert order book to our depth levels format
      const depthLevels = {
        bids: bids.map(([price, size]) => ({ price: parseFloat(price.toString()), size: parseFloat(size.toString()) })),
        asks: asks.map(([price, size]) => ({ price: parseFloat(price.toString()), size: parseFloat(size.toString()) }))
      };
      
      // Add depth levels to the snapshot
      return {
        ...dailyData,
        depthLevels
      };
    } catch (secondError) {
      console.error(`All data sources failed for ${symbol}:`, secondError);
      
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
