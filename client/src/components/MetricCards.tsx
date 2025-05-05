import { useStore } from "@/lib/store";
import { formatPrice, calculateSpread, formatCryptoAmount, formatUsdAmount } from "@/lib/apis";
import { Card, CardContent } from "@/components/ui/card";

export function MetricCards() {
  const selectedSymbol = useStore((state) => state.selectedSymbol);
  const snapshots = useStore((state) => state.snapshots);
  const snapshot = snapshots[selectedSymbol];
  
  // Calculate spread if we have a snapshot
  const { spread, spreadPct } = snapshot 
    ? calculateSpread(snapshot.bidPrice, snapshot.askPrice) 
    : { spread: 0, spreadPct: 0 };
  
  // Get currency from symbol (e.g., BTC from BTC/USD)
  const currency = selectedSymbol.split('/')[0];
  
  // For the liquidity depth, we'll simulate some values
  const bidDepth = snapshot ? snapshot.bidSize * 10 : 0;
  const askDepth = snapshot ? snapshot.askSize * 7 : 0;
  const depthImbalance = bidDepth && askDepth ? (bidDepth / askDepth).toFixed(2) : "0";
  const isBidFavored = bidDepth > askDepth;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Bid/Ask Spread Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground">BID/ASK SPREAD</h3>
            <div className="text-xs bg-muted px-2 py-1 rounded flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Live</span>
            </div>
          </div>
          <div className="flex space-x-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Bid</div>
              <div className="text-xl font-mono font-semibold text-green-500">
                {snapshot ? formatPrice(snapshot.bidPrice) : '-'}
              </div>
              <div className="text-sm font-mono text-muted-foreground">
                {snapshot ? formatCryptoAmount(snapshot.bidSize, selectedSymbol) : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Ask</div>
              <div className="text-xl font-mono font-semibold text-red-500">
                {snapshot ? formatPrice(snapshot.askPrice) : '-'}
              </div>
              <div className="text-sm font-mono text-muted-foreground">
                {snapshot ? formatCryptoAmount(snapshot.askSize, selectedSymbol) : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Spread</div>
              <div className="text-xl font-mono font-semibold">
                {snapshot ? formatPrice(spread, 4) : '-'}
              </div>
              <div className="text-sm font-mono text-muted-foreground">
                {snapshot ? `${spreadPct.toFixed(4)}%` : '-'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Volume Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground">VOLUME (24H)</h3>
            <div className="text-xs bg-muted px-2 py-1 rounded flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
              </svg>
              <span>Daily</span>
            </div>
          </div>
          <div className="flex space-x-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total</div>
              <div className="text-xl font-mono font-semibold">
                {snapshot ? formatCryptoAmount(snapshot.volume24h, selectedSymbol) : '-'}
              </div>
              <div className="text-sm font-mono text-muted-foreground">
                {snapshot 
                  ? formatUsdAmount(snapshot.volume24h * snapshot.bidPrice) 
                  : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Buy Volume</div>
              <div className="text-xl font-mono font-semibold text-green-500">
                {snapshot 
                  ? formatCryptoAmount(snapshot.volume24h * 0.52, selectedSymbol) 
                  : '-'}
              </div>
              <div className="text-sm font-mono text-muted-foreground">52.3%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Sell Volume</div>
              <div className="text-xl font-mono font-semibold text-red-500">
                {snapshot 
                  ? formatCryptoAmount(snapshot.volume24h * 0.48, selectedSymbol) 
                  : '-'}
              </div>
              <div className="text-sm font-mono text-muted-foreground">47.7%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liquidity Depth Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground">LIQUIDITY DEPTH</h3>
            <div className="text-xs bg-muted px-2 py-1 rounded flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Order Book</span>
            </div>
          </div>
          <div className="flex space-x-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Bid Depth (1%)</div>
              <div className="text-xl font-mono font-semibold text-green-500">
                {formatCryptoAmount(bidDepth, selectedSymbol)}
              </div>
              <div className="text-sm font-mono text-muted-foreground">
                {snapshot 
                  ? formatUsdAmount(bidDepth * snapshot.bidPrice) 
                  : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Ask Depth (1%)</div>
              <div className="text-xl font-mono font-semibold text-red-500">
                {formatCryptoAmount(askDepth, selectedSymbol)}
              </div>
              <div className="text-sm font-mono text-muted-foreground">
                {snapshot 
                  ? formatUsdAmount(askDepth * snapshot.askPrice) 
                  : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Imbalance</div>
              <div className="text-xl font-mono font-semibold text-orange-500">
                {depthImbalance}
              </div>
              <div className="text-sm font-mono text-muted-foreground">
                {isBidFavored ? 'Bid Favored' : 'Ask Favored'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
