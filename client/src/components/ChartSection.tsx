import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { generateTimeLabels, generatePlaceholderChartData, getChartColor } from "@/lib/utils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

// Time range options for the charts
const timeRanges = [
  { label: "1H", value: 60 },
  { label: "4H", value: 240 },
  { label: "1D", value: 1440 },
  { label: "1W", value: 10080 }
];

export function ChartSection() {
  const selectedSymbol = useStore((state) => state.selectedSymbol);
  const snapshots = useStore((state) => state.snapshots);
  const snapshot = snapshots[selectedSymbol];
  
  const [selectedRange, setSelectedRange] = useState(timeRanges[0]);
  const [spreadChartData, setSpreadChartData] = useState<any[]>([]);
  const [volumeChartData, setVolumeChartData] = useState<any[]>([]);
  
  // Generate chart data when symbol or snapshot changes
  useEffect(() => {
    if (snapshot) {
      // Generate time labels for the selected range
      const timeLabels = generateTimeLabels(selectedRange.value, 5);
      
      // Generate price data (random walk around current price)
      const basePrice = snapshot.bidPrice;
      const priceData = generatePlaceholderChartData(
        timeLabels.length, 
        basePrice, 
        0.005 // 0.5% volatility
      );
      
      // Generate spread data (random walk between 0.05% and 0.5% of price)
      const spreadData = generatePlaceholderChartData(
        timeLabels.length, 
        basePrice * 0.001, 
        0.5
      );
      
      // Generate buy volume data
      const buyVolumeData = generatePlaceholderChartData(
        timeLabels.length, 
        snapshot.volume24h / 24, // Hourly average
        0.3
      );
      
      // Generate sell volume data
      const sellVolumeData = generatePlaceholderChartData(
        timeLabels.length, 
        snapshot.volume24h / 28, // Slightly less than buy
        0.3
      );
      
      // Create the spread chart data
      const newSpreadChartData = timeLabels.map((time, index) => ({
        time,
        price: priceData[index],
        spread: spreadData[index]
      }));
      
      // Create the volume chart data
      const newVolumeChartData = timeLabels.map((time, index) => ({
        time,
        buy: buyVolumeData[index],
        sell: sellVolumeData[index]
      }));
      
      setSpreadChartData(newSpreadChartData);
      setVolumeChartData(newVolumeChartData);
    }
  }, [selectedSymbol, snapshot, selectedRange]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Spread & Price Chart */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-base font-semibold">Spread & Price History</h3>
            <TimeRangeSelector 
              ranges={timeRanges}
              selected={selectedRange}
              onChange={setSelectedRange}
            />
          </div>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={spreadChartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey="time" 
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <YAxis 
                  yAxisId="price"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickFormatter={(value) => value.toFixed(0)}
                />
                <YAxis 
                  yAxisId="spread"
                  orientation="right"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    color: 'var(--card-foreground)'
                  }}
                  itemStyle={{ color: 'var(--card-foreground)' }}
                  labelStyle={{ color: 'var(--card-foreground)', fontWeight: 'bold' }}
                />
                <Legend />
                <Line 
                  yAxisId="price"
                  type="monotone" 
                  dataKey="price" 
                  name="Price (USD)"
                  stroke={getChartColor(0)}
                  activeDot={{ r: 6 }}
                  dot={false}
                />
                <Line 
                  yAxisId="spread"
                  type="monotone" 
                  dataKey="spread" 
                  name="Spread"
                  stroke={getChartColor(2)}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Volume Chart */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-base font-semibold">Trading Volume</h3>
            <TimeRangeSelector 
              ranges={timeRanges}
              selected={selectedRange}
              onChange={setSelectedRange}
            />
          </div>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={volumeChartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey="time" 
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    color: 'var(--card-foreground)'
                  }}
                  itemStyle={{ color: 'var(--card-foreground)' }}
                  labelStyle={{ color: 'var(--card-foreground)', fontWeight: 'bold' }}
                />
                <Legend />
                <Bar 
                  dataKey="buy" 
                  name="Buy Volume"
                  fill="rgba(34, 197, 94, 0.6)" 
                  stroke="rgba(34, 197, 94, 0.8)"
                />
                <Bar 
                  dataKey="sell" 
                  name="Sell Volume"
                  fill="rgba(239, 68, 68, 0.6)" 
                  stroke="rgba(239, 68, 68, 0.8)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface TimeRangeSelectorProps {
  ranges: { label: string; value: number }[];
  selected: { label: string; value: number };
  onChange: (range: { label: string; value: number }) => void;
}

function TimeRangeSelector({ ranges, selected, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex space-x-2">
      {ranges.map((range) => (
        <button
          key={range.label}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            selected.label === range.label 
              ? "bg-primary/10 text-primary" 
              : "hover:bg-muted"
          }`}
          onClick={() => onChange(range)}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
