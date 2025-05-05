import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Calculate the spread between bid and ask prices
export function calculateSpread(bidPrice: number, askPrice: number) {
  const spread = askPrice - bidPrice;
  const spreadPercentage = (spread / bidPrice) * 100;
  
  return {
    spread,
    spreadPercentage
  };
}

// Format prices with appropriate precision
export function formatPrice(price: number, precision = 2) {
  if (isNaN(price) || price === 0) return '0.00';
  
  // Format based on price magnitude
  if (price < 0.01) {
    return price.toFixed(6);
  } else if (price < 1) {
    return price.toFixed(4);
  } else if (price < 1000) {
    return price.toFixed(2);
  } else {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}

// Format volume with K, M, B suffixes
export function formatVolume(volume: number) {
  if (isNaN(volume) || volume === 0) return '0';
  
  if (volume >= 1000000000) {
    return (volume / 1000000000).toFixed(2) + 'B';
  } else if (volume >= 1000000) {
    return (volume / 1000000).toFixed(2) + 'M';
  } else if (volume >= 1000) {
    return (volume / 1000).toFixed(2) + 'K';
  } else {
    return volume.toFixed(2);
  }
}

// Format date for display
export function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  
  // Time in HH:MM:SS format
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Date in MMM DD, YYYY format
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
  
  return { time, date: dateStr };
}

// Generate color based on index
export function getChartColor(index: number) {
  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))'
  ];
  
  return colors[index % colors.length];
}

// Generate time labels for charts (last N minutes)
export function generateTimeLabels(minutesAgo: number, intervalMinutes: number = 5) {
  const labels = [];
  const now = new Date();
  
  for (let i = minutesAgo; i >= 0; i -= intervalMinutes) {
    const date = new Date(now.getTime() - i * 60000);
    labels.push(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }
  
  return labels;
}

// Generate placeholder data for charts when API data is loading
export function generatePlaceholderChartData(
  length: number, 
  baseValue: number, 
  volatility: number = 0.01
) {
  const data = [];
  let lastValue = baseValue;
  
  for (let i = 0; i < length; i++) {
    // Random walk with mean reversion
    const change = (Math.random() - 0.5) * volatility * baseValue;
    lastValue = lastValue + change;
    // Mean reversion
    lastValue = lastValue * 0.95 + baseValue * 0.05;
    data.push(lastValue);
  }
  
  return data;
}
