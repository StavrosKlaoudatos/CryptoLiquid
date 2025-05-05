import { MetricCards } from "./MetricCards";
import { ChartSection } from "./ChartSection";
import { OrderBookSection } from "./OrderBookSection";
import { RecentTradesSection } from "./RecentTradesSection";

export function Dashboard() {
  return (
    <div className="p-6">
      <MetricCards />
      <ChartSection />
      <OrderBookSection />
      <RecentTradesSection />
    </div>
  );
}
