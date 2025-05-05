import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { type NormalizedLiquiditySnapshot, type WebSocketMessage, type Trade, type DepthLevel } from "@shared/schema";
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

/**
 * Calculate liquidity score and market metrics
 * 
 * @param price - Current price of the asset
 * @param bidPrice - Current bid price
 * @param askPrice - Current ask price
 * @param bidSize - Current bid size
 * @param askSize - Current ask size
 * @param volume24h - 24 hour volume
 * @param marketCap - Market cap of the asset (if available)
 * @param depthLevels - Order book depth levels
 */
function calculateLiquidityMetrics(
  price: number,
  bidPrice: number,
  askPrice: number,
  bidSize: number,
  askSize: number,
  volume24h: number,
  marketCap: number | undefined,
  depthLevels?: { bids: DepthLevel[]; asks: DepthLevel[] }
) {
  // Calculate spread percentage
  const spread = askPrice - bidPrice;
  const spreadPercentage = price > 0 ? (spread / price) * 100 : 0;
  
  // Calculate market depth ratio (bid depth vs ask depth)
  const marketDepthRatio = askSize > 0 ? bidSize / askSize : 1;
  
  // Calculate volume to market cap ratio (if market cap is available)
  const volumeToMcapRatio = marketCap && marketCap > 0 ? (volume24h / marketCap) * 100 : undefined;
  
  // Calculate slippage impact for different order sizes
  let slippageImpact = {
    small: 0,
    medium: 0,
    large: 0
  };
  
  // If we have depth levels, calculate more accurate slippage
  if (depthLevels && depthLevels.bids.length > 0 && depthLevels.asks.length > 0) {
    // Small order = 0.1% of daily volume
    // Medium order = 0.5% of daily volume
    // Large order = 1% of daily volume
    const smallOrderSize = volume24h * 0.001;
    const mediumOrderSize = volume24h * 0.005;
    const largeOrderSize = volume24h * 0.01;
    
    // Calculate slippage for buy orders (using ask side)
    const calculateBuySlippage = (orderSize: number): number => {
      let remainingSize = orderSize;
      let totalCost = 0;
      
      for (let i = 0; i < depthLevels.asks.length && remainingSize > 0; i++) {
        const level = depthLevels.asks[i];
        const levelPrice = level.price;
        const levelSize = level.size;
        
        const sizeToTake = Math.min(remainingSize, levelSize);
        totalCost += sizeToTake * levelPrice;
        remainingSize -= sizeToTake;
      }
      
      // If all the levels aren't enough, use the last price for remaining size
      if (remainingSize > 0 && depthLevels.asks.length > 0) {
        const lastPrice = depthLevels.asks[depthLevels.asks.length - 1].price;
        totalCost += remainingSize * lastPrice;
      }
      
      const averagePrice = totalCost / orderSize;
      // Calculate slippage as percentage above current ask price
      return askPrice > 0 ? ((averagePrice / askPrice) - 1) * 100 : 0;
    };
    
    // Calculate slippage
    slippageImpact = {
      small: calculateBuySlippage(smallOrderSize),
      medium: calculateBuySlippage(mediumOrderSize),
      large: calculateBuySlippage(largeOrderSize)
    };
  } else {
    // Simple estimation based on spread and volume
    slippageImpact = {
      small: spreadPercentage * 0.5,
      medium: spreadPercentage * 1.5,
      large: spreadPercentage * 3
    };
  }
  
  // Calculate final liquidity score (0-100)
  // Lower spread, higher volume, and balanced depth are better
  let liquidityScore = 0;
  
  // Spread component (lower is better) - max 40 points
  const spreadScore = Math.max(0, 40 - (spreadPercentage * 100));
  
  // Volume component (higher is better) - max 40 points
  let volumeScore = 0;
  if (marketCap && marketCap > 0) {
    // Use volume to market cap ratio if available
    volumeScore = Math.min(40, (volume24h / marketCap) * 40000);
  } else {
    // Fallback scoring based on absolute volume
    volumeScore = Math.min(40, Math.log10(volume24h) * 4);
  }
  
  // Depth balance component (closer to 1.0 is better) - max 20 points
  const depthBalanceScore = 20 - (Math.abs(1 - marketDepthRatio) * 10);
  
  // Final score calculation
  liquidityScore = Math.round(
    Math.max(0, Math.min(100, spreadScore + volumeScore + depthBalanceScore))
  );
  
  return {
    liquidityScore,
    marketDepthRatio,
    volumeToMcapRatio,
    spreadPercentage,
    slippageImpact
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
    let quoteData;
    try {
      quoteData = await yahooFinance.quote(yahooSymbol);
    } catch (error: any) {
      // Handle schema validation errors from Yahoo Finance
      if (error && error.name === 'TransformDecodeCheckError') {
        console.warn(`Yahoo Finance schema validation error for ${symbol}, attempting to extract data from raw response`);
        
        // Try to get the raw response data even if validation failed
        if (error.value && Array.isArray(error.value) && error.value.length > 0) {
          quoteData = error.value[0];
        } else {
          throw new Error(`Unable to extract data from Yahoo Finance response for ${symbol}`);
        }
      } else {
        throw error;
      }
    }
    
    if (!quoteData) {
      throw new Error(`No data available from Yahoo Finance for ${symbol}`);
    }
    
    // Get relevant data from the response
    const regularMarketPrice = quoteData.regularMarketPrice || 0;
    const regularMarketVolume = quoteData.regularMarketVolume || 0;
    const dayVolume = regularMarketVolume;
    const marketCap = quoteData.marketCap ? Number(quoteData.marketCap) : undefined;
    
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
    const avgPrice = (yahooData.bidPrice + yahooData.askPrice) / 2;
    
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
    
    // Get market cap from yahoo data or estimate it
    let marketCap: number | undefined = undefined;
    
    // Try to fetch quote data to get market cap if available
    try {
      const yahooSymbol = symbol.replace('/', '-');
      let quoteData;
      try {
        quoteData = await yahooFinance.quote(yahooSymbol);
      } catch (error: any) {
        // Handle schema validation errors from Yahoo Finance
        if (error && error.name === 'TransformDecodeCheckError') {
          if (error.value && Array.isArray(error.value) && error.value.length > 0) {
            quoteData = error.value[0];
          }
        } else {
          throw error;
        }
      }
      if (quoteData && quoteData.marketCap) {
        marketCap = Number(quoteData.marketCap);
      }
    } catch (e) {
      console.warn(`Could not fetch market cap data for ${symbol}:`, e);
    }
    
    // Calculate liquidity metrics
    const metrics = calculateLiquidityMetrics(
      avgPrice,
      yahooData.bidPrice,
      yahooData.askPrice,
      yahooData.bidSize,
      yahooData.askSize,
      yahooData.volume24h,
      marketCap,
      depthLevels
    );
    
    // Add depth levels and metrics to the snapshot
    return {
      ...yahooData,
      depthLevels,
      liquidityScore: metrics.liquidityScore,
      marketDepthRatio: metrics.marketDepthRatio,
      volumeToMcapRatio: metrics.volumeToMcapRatio,
      spreadPercentage: metrics.spreadPercentage,
      slippageImpact: metrics.slippageImpact
    };
  } catch (error) {
    console.error(`Yahoo Finance data source failed for ${symbol}:`, error);
    
    try {
      // Fall back to Alpha Vantage if Yahoo Finance fails
      console.log(`Falling back to Alpha Vantage for ${symbol}`);
      const dailyData = await fetchAlphaVantageDailyData(symbol);
      const avgPrice = (dailyData.bidPrice + dailyData.askPrice) / 2;
      
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
      
      // Calculate liquidity metrics
      const metrics = calculateLiquidityMetrics(
        avgPrice,
        dailyData.bidPrice,
        dailyData.askPrice,
        dailyData.bidSize,
        dailyData.askSize,
        dailyData.volume24h,
        undefined, // No market cap data available from Alpha Vantage
        depthLevels
      );
      
      // Add depth levels and metrics to the snapshot
      return {
        ...dailyData,
        depthLevels,
        liquidityScore: metrics.liquidityScore,
        marketDepthRatio: metrics.marketDepthRatio,
        volumeToMcapRatio: metrics.volumeToMcapRatio,
        spreadPercentage: metrics.spreadPercentage,
        slippageImpact: metrics.slippageImpact
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
        source: 'error',
        liquidityScore: 0,
        marketDepthRatio: 1,
        spreadPercentage: 0,
        slippageImpact: {
          small: 0,
          medium: 0,
          large: 0
        }
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
  
  // Endpoint for getting market liquidity comparison
  app.get('/api/market/comparison', async (req, res) => {
    try {
      const symbols = await storage.getSymbols();
      const allSnapshots: NormalizedLiquiditySnapshot[] = [];
      
      // Fetch data for all symbols
      for (const symbol of symbols) {
        let snapshot = await storage.getLiquiditySnapshot(symbol);
        
        // If no snapshot is available, skip this symbol
        if (!snapshot || snapshot.source === 'error') {
          continue;
        }
        
        allSnapshots.push(snapshot);
      }
      
      // Sort snapshots by liquidity score (if available)
      const sortedSnapshots = allSnapshots
        .filter(s => s.liquidityScore !== undefined)
        .sort((a, b) => {
          // Default to 0 if liquidityScore is undefined
          const scoreA = a.liquidityScore || 0;
          const scoreB = b.liquidityScore || 0;
          return scoreB - scoreA; // Descending order
        });
      
      // Create summary data
      const comparisonData = sortedSnapshots.map(snapshot => {
        return {
          symbol: snapshot.symbol,
          currentPrice: (snapshot.bidPrice + snapshot.askPrice) / 2,
          liquidityScore: snapshot.liquidityScore,
          bidPrice: snapshot.bidPrice,
          askPrice: snapshot.askPrice,
          volume24h: snapshot.volume24h,
          spreadPercentage: snapshot.spreadPercentage,
          marketDepthRatio: snapshot.marketDepthRatio,
          slippageImpact: snapshot.slippageImpact
        };
      });
      
      res.json(comparisonData);
    } catch (error) {
      console.error('Error generating market comparison:', error);
      res.status(500).json({ message: 'Error generating market comparison' });
    }
  });
  
  // Endpoint for getting market depth analysis for a specific symbol
  app.get('/api/market/depth/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol;
      let snapshot = await storage.getLiquiditySnapshot(symbol);
      
      // If no snapshot is available, fetch it
      if (!snapshot) {
        snapshot = await fetchAllDataForSymbol(symbol);
        await storage.saveLiquiditySnapshot(snapshot);
      }
      
      // Check if we have depth levels
      if (!snapshot.depthLevels) {
        return res.status(404).json({ message: 'No market depth data available for this symbol' });
      }
      
      // Calculate cumulative totals for bid and ask sides
      const bids = snapshot.depthLevels.bids.map((level, index, array) => {
        // Calculate the running total to this level
        const total = array
          .slice(0, index + 1)
          .reduce((sum, l) => sum + l.size, 0);
        
        return {
          ...level,
          total,
          value: level.price * level.size
        };
      });
      
      const asks = snapshot.depthLevels.asks.map((level, index, array) => {
        // Calculate the running total to this level
        const total = array
          .slice(0, index + 1)
          .reduce((sum, l) => sum + l.size, 0);
        
        return {
          ...level,
          total,
          value: level.price * level.size
        };
      });
      
      // Calculate statistical measures
      const bidSum = bids.reduce((sum, level) => sum + level.size, 0);
      const askSum = asks.reduce((sum, level) => sum + level.size, 0);
      const totalDepth = bidSum + askSum;
      
      const depthAnalysis = {
        symbol,
        timestamp: snapshot.timestamp,
        currentPrice: (snapshot.bidPrice + snapshot.askPrice) / 2,
        spreadPercentage: snapshot.spreadPercentage,
        bidSum,
        askSum,
        totalDepth,
        bidToAskRatio: bidSum / askSum,
        valueImbalance: bids.reduce((sum, level) => sum + level.value, 0) / 
                      asks.reduce((sum, level) => sum + level.value, 0),
        slippageImpact: snapshot.slippageImpact,
        bids,
        asks
      };
      
      res.json(depthAnalysis);
    } catch (error) {
      console.error(`Error generating market depth analysis for ${req.params.symbol}:`, error);
      res.status(500).json({ message: 'Error generating market depth analysis' });
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
