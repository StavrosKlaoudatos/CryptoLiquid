import { users, type User, type InsertUser, type NormalizedLiquiditySnapshot, type Trade } from "@shared/schema";

// Extend the storage interface for our liquidity dashboard
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Liquidity dashboard methods
  getSymbols(): Promise<string[]>;
  getLiquiditySnapshot(symbol: string): Promise<NormalizedLiquiditySnapshot | undefined>;
  saveLiquiditySnapshot(snapshot: NormalizedLiquiditySnapshot): Promise<void>;
  getRecentTrades(symbol: string, limit?: number): Promise<Trade[]>;
  saveTrade(trade: Trade): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private liquiditySnapshots: Map<string, NormalizedLiquiditySnapshot>;
  private tradeHistory: Map<string, Trade[]>;
  private symbols: string[];
  currentId: number;

  constructor() {
    this.users = new Map();
    this.liquiditySnapshots = new Map();
    this.tradeHistory = new Map();
    // Define crypto symbols that work well with Alpha Vantage
    this.symbols = [
      "BTC/USD", "ETH/USD", "LTC/USD", "XRP/USD", "BCH/USD"
    ];
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getSymbols(): Promise<string[]> {
    return this.symbols;
  }

  async getLiquiditySnapshot(symbol: string): Promise<NormalizedLiquiditySnapshot | undefined> {
    return this.liquiditySnapshots.get(symbol);
  }

  async saveLiquiditySnapshot(snapshot: NormalizedLiquiditySnapshot): Promise<void> {
    this.liquiditySnapshots.set(snapshot.symbol, snapshot);
  }

  async getRecentTrades(symbol: string, limit: number = 50): Promise<Trade[]> {
    const trades = this.tradeHistory.get(symbol) || [];
    return trades.slice(0, limit);
  }

  async saveTrade(trade: Trade): Promise<void> {
    const symbol = trade.symbol;
    const trades = this.tradeHistory.get(symbol) || [];
    // Add the new trade at the beginning of the array
    trades.unshift(trade);
    // Keep only the latest 100 trades per symbol
    if (trades.length > 100) {
      trades.length = 100;
    }
    this.tradeHistory.set(symbol, trades);
  }
}

export const storage = new MemStorage();
