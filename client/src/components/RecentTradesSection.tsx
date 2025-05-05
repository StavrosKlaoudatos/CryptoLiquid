import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { formatPrice, formatDate } from "@/lib/utils";

type TradeType = "all" | "buys" | "sells";

export function RecentTradesSection() {
  const selectedSymbol = useStore((state) => state.selectedSymbol);
  const tradesMap = useStore((state) => state.trades);
  const trades = tradesMap[selectedSymbol] || [];
  
  const [tradeType, setTradeType] = useState<TradeType>("all");
  const [filteredTrades, setFilteredTrades] = useState(trades);
  
  // Filter trades when type changes
  useEffect(() => {
    if (tradeType === "all") {
      setFilteredTrades(trades);
    } else if (tradeType === "buys") {
      setFilteredTrades(trades.filter((trade) => !trade.isBuyerMaker));
    } else {
      setFilteredTrades(trades.filter((trade) => trade.isBuyerMaker));
    }
  }, [trades, tradeType]);

  return (
    <Card className="mt-6">
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h3 className="text-base font-semibold">Recent Trades</h3>
        <div className="flex space-x-2">
          <button
            className={`text-xs px-2 py-1 rounded transition-colors ${
              tradeType === "all" 
                ? "bg-primary/10 text-primary" 
                : "hover:bg-muted"
            }`}
            onClick={() => setTradeType("all")}
          >
            All
          </button>
          <button
            className={`text-xs px-2 py-1 rounded transition-colors ${
              tradeType === "buys" 
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" 
                : "hover:bg-muted"
            }`}
            onClick={() => setTradeType("buys")}
          >
            Buys
          </button>
          <button
            className={`text-xs px-2 py-1 rounded transition-colors ${
              tradeType === "sells" 
                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" 
                : "hover:bg-muted"
            }`}
            onClick={() => setTradeType("sells")}
          >
            Sells
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="text-xs text-muted-foreground bg-muted">
              <th className="px-4 py-2 text-left">Time</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-right">Price (USD)</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-right">Total (USD)</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrades.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No recent trades available
                </td>
              </tr>
            ) : (
              filteredTrades.slice(0, 5).map((trade, index) => {
                const { time, date } = formatDate(trade.timestamp);
                const isBuy = !trade.isBuyerMaker;
                const total = trade.price * trade.size;
                
                return (
                  <tr 
                    key={`trade-${index}`} 
                    className="text-xs border-b border-border hover:bg-muted/50"
                  >
                    <td className="px-4 py-3">
                      <div className="text-foreground">{time}</div>
                      <div className="text-muted-foreground text-[10px]">{date}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-sm ${
                        isBuy 
                          ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" 
                          : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                      } font-medium`}>
                        {isBuy ? "Buy" : "Sell"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatPrice(trade.price)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {trade.size.toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatPrice(total)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
