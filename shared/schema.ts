import { pgTable, text, serial, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model for auth (keeping the existing schema)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// New models for the liquidity dashboard
export const cryptoSymbols = pgTable("crypto_symbols", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  exchange: text("exchange").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertCryptoSymbolSchema = createInsertSchema(cryptoSymbols).pick({
  symbol: true,
  name: true,
  exchange: true,
  isActive: true,
});

export type InsertCryptoSymbol = z.infer<typeof insertCryptoSymbolSchema>;
export type CryptoSymbol = typeof cryptoSymbols.$inferSelect;

// For caching liquidity snapshots
export const liquiditySnapshots = pgTable("liquidity_snapshots", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  bidPrice: numeric("bid_price").notNull(),
  askPrice: numeric("ask_price").notNull(),
  bidSize: numeric("bid_size").notNull(),
  askSize: numeric("ask_size").notNull(),
  volume24h: numeric("volume_24h").notNull(),
  source: text("source").notNull(), // The API source of this data
});

export const insertLiquiditySnapshotSchema = createInsertSchema(liquiditySnapshots).pick({
  symbol: true,
  timestamp: true,
  bidPrice: true,
  askPrice: true,
  bidSize: true,
  askSize: true,
  volume24h: true,
  source: true,
});

export type InsertLiquiditySnapshot = z.infer<typeof insertLiquiditySnapshotSchema>;
export type LiquiditySnapshot = typeof liquiditySnapshots.$inferSelect;

// Define TypeScript interfaces for our normalized data models
export interface DepthLevel {
  price: number;
  size: number;
  total?: number; // Cumulative size at this level
}

export interface NormalizedLiquiditySnapshot {
  symbol: string;
  timestamp: number;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  volume24h: number;
  depthLevels?: {
    bids: DepthLevel[];
    asks: DepthLevel[];
  };
  source: string; // Which API this came from
  liquidityScore?: number; // 0-100 score based on spread, depth, and volume
  marketDepthRatio?: number; // Ratio of depth on bid vs ask side
  volumeToMcapRatio?: number; // Volume to Market Cap ratio
  spreadPercentage?: number; // Spread as a percentage of price
  slippageImpact?: { // Estimated price impact for different order sizes
    small: number;  // 0.1% of 24h volume
    medium: number; // 0.5% of 24h volume
    large: number;  // 1% of 24h volume
  };
}

export interface Trade {
  symbol: string;
  timestamp: number;
  price: number;
  size: number;
  isBuyerMaker: boolean; // true if the trade was a sell (maker was a buyer)
}

export interface WebSocketMessage {
  type: 'snapshot' | 'update' | 'trade' | 'error';
  data: NormalizedLiquiditySnapshot | Trade | { message: string };
}
