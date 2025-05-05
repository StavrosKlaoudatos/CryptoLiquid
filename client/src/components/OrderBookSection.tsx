import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { formatPrice } from "@/lib/apis";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer
} from "recharts";

export function OrderBookSection() {
  const selectedSymbol = useStore((state) => state.selectedSymbol);
  const snapshots = useStore((state) => state.snapshots);
  const snapshot = snapshots[selectedSymbol];
  
  const [orderBookData, setOrderBookData] = useState<any[]>([]);
  const [bids, setBids] = useState<any[]>([]);
  const [asks, setAsks] = useState<any[]>([]);
  
  // Generate order book data when symbol or snapshot changes
  useEffect(() => {
    if (snapshot) {
      const midPrice = (snapshot.bidPrice + snapshot.askPrice) / 2;
      const priceRange = midPrice * 0.01; // 1% range
      
      // Generate price points
      const prices = [];
      for (let i = -15; i <= 15; i++) {
        prices.push(midPrice + (i * priceRange / 15));
      }
      
      // Generate bid and ask data
      const newBids = [];
      const newAsks = [];
      let bidSum = 0;
      let askSum = 0;
      
      // Generate random bids (higher density near the mid price)
      for (let i = 0; i < 10; i++) {
        const price = snapshot.bidPrice * (1 - 0.0001 * (i + 1) * (i + 1));
        const size = snapshot.bidSize * Math.exp(-i * 0.2) * (1 + Math.random() * 0.5);
        bidSum += size;
        
        newBids.push({
          price: formatPrice(price),
          amount: size.toFixed(3),
          total: (price * size).toFixed(2),
          sum: bidSum.toFixed(3),
          width: Math.min(100, 30 + 70 * Math.exp(-i * 0.3))
        });
      }
      
      // Generate random asks (higher density near the mid price)
      for (let i = 0; i < 10; i++) {
        const price = snapshot.askPrice * (1 + 0.0001 * (i + 1) * (i + 1));
        const size = snapshot.askSize * Math.exp(-i * 0.2) * (1 + Math.random() * 0.5);
        askSum += size;
        
        newAsks.push({
          price: formatPrice(price),
          amount: size.toFixed(3),
          total: (price * size).toFixed(2),
          sum: askSum.toFixed(3),
          width: Math.min(100, 30 + 70 * Math.exp(-i * 0.3))
        });
      }
      
      // Sort asks in descending order (highest price first)
      newAsks.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      
      // Generate order book depth chart data
      const depthData = prices.map((price) => {
        let bidDepth = 0;
        let askDepth = 0;
        
        // Add up all bids at or above this price
        if (price <= snapshot.bidPrice) {
          bidDepth = snapshot.bidSize * 10 * Math.exp(-(snapshot.bidPrice - price) / priceRange * 3);
        }
        
        // Add up all asks at or below this price
        if (price >= snapshot.askPrice) {
          askDepth = snapshot.askSize * 8 * Math.exp(-(price - snapshot.askPrice) / priceRange * 3);
        }
        
        return {
          price: price,
          bid: bidDepth,
          ask: askDepth
        };
      });
      
      setOrderBookData(depthData);
      setBids(newBids);
      setAsks(newAsks);
    }
  }, [selectedSymbol, snapshot]);

  // Calculate spread
  const spread = snapshot ? (snapshot.askPrice - snapshot.bidPrice).toFixed(2) : "0.00";
  const spreadPercentage = snapshot 
    ? ((snapshot.askPrice - snapshot.bidPrice) / snapshot.bidPrice * 100).toFixed(4) 
    : "0.0000";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Order Book Depth Chart */}
      <Card className="lg:col-span-2">
        <div className="p-4 border-b border-border">
          <h3 className="text-base font-semibold">Order Book Depth</h3>
        </div>
        <CardContent className="p-4">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={orderBookData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey="price" 
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickFormatter={(value) => formatPrice(value, 0)}
                />
                <YAxis 
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    color: 'var(--card-foreground)'
                  }}
                  formatter={(value: number) => [value.toFixed(3), ""]}
                  labelFormatter={(label) => `Price: ${formatPrice(label)}`}
                />
                <Legend />
                <ReferenceLine
                  x={snapshot?.bidPrice}
                  stroke="var(--primary)"
                  strokeDasharray="3 3"
                  label={{
                    value: `Bid: ${snapshot ? formatPrice(snapshot.bidPrice) : ''}`,
                    position: 'top',
                    fill: 'var(--primary)',
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  x={snapshot?.askPrice}
                  stroke="var(--primary)"
                  strokeDasharray="3 3"
                  label={{
                    value: `Ask: ${snapshot ? formatPrice(snapshot.askPrice) : ''}`,
                    position: 'top',
                    fill: 'var(--primary)',
                    fontSize: 12,
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="bid" 
                  name="Bid Depth"
                  fill="rgba(34, 197, 94, 0.6)" 
                  stroke="rgba(34, 197, 94, 0.8)"
                  fillOpacity={0.5}
                />
                <Area 
                  type="monotone" 
                  dataKey="ask" 
                  name="Ask Depth"
                  fill="rgba(239, 68, 68, 0.6)" 
                  stroke="rgba(239, 68, 68, 0.8)"
                  fillOpacity={0.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Order Book */}
      <Card>
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="text-base font-semibold">Order Book</h3>
          <div className="text-xs text-muted-foreground flex items-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-3 w-3 mr-1" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Live Updates</span>
          </div>
        </div>
        <div className="p-0 h-80">
          <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground p-2 border-b border-border">
            <div>Price (USD)</div>
            <div className="text-right">Amount</div>
            <div className="text-right">Total (USD)</div>
            <div className="text-right">Sum</div>
          </div>
          
          {/* Order book asks (sells) */}
          <div className="overflow-y-auto h-[136px]">
            {asks.map((ask, index) => (
              <div 
                key={`ask-${index}`} 
                className="grid grid-cols-4 text-xs p-2 hover:bg-muted border-b border-border/20"
              >
                <div className="font-mono text-red-500">{ask.price}</div>
                <div className="font-mono text-right">{ask.amount}</div>
                <div className="font-mono text-right">{ask.total}</div>
                <div className="font-mono text-right">{ask.sum}</div>
                <div className="col-span-4 mt-1">
                  <div className="depth-bar ask-bar" style={{ width: `${ask.width}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Spread indicator */}
          <div className="py-2 px-4 bg-muted text-center">
            <span className="text-xs font-medium text-muted-foreground">Spread: </span>
            <span className="text-xs font-mono font-semibold">{spread} ({spreadPercentage}%)</span>
          </div>
          
          {/* Order book bids (buys) */}
          <div className="overflow-y-auto h-[136px]">
            {bids.map((bid, index) => (
              <div 
                key={`bid-${index}`} 
                className="grid grid-cols-4 text-xs p-2 hover:bg-muted border-b border-border/20"
              >
                <div className="font-mono text-green-500">{bid.price}</div>
                <div className="font-mono text-right">{bid.amount}</div>
                <div className="font-mono text-right">{bid.total}</div>
                <div className="font-mono text-right">{bid.sum}</div>
                <div className="col-span-4 mt-1">
                  <div className="depth-bar bid-bar" style={{ width: `${bid.width}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
