import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLiquiditySnapshot, fetchSymbols, fetchTrades } from './apis';
import { useStore } from './store';

// Hook for WebSocket connection
export function useWebSocket() {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected');
      setReadyState(WebSocket.OPEN);
    };

    socket.onmessage = (event) => {
      setLastMessage(event.data);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setReadyState(WebSocket.CLOSED);
    };

    return () => {
      socket.close();
    };
  }, []);

  // Send a message through the WebSocket
  const sendMessage = useCallback((message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
      return true;
    }
    return false;
  }, []);

  return {
    lastMessage,
    readyState,
    sendMessage,
    READY_STATE: {
      CONNECTING: WebSocket.CONNECTING,
      OPEN: WebSocket.OPEN,
      CLOSING: WebSocket.CLOSING,
      CLOSED: WebSocket.CLOSED
    }
  };
}

// Hook for tracking window dimensions
export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return windowSize;
}

// Hook for tracking connection status
export function useConnectionStatus() {
  const readyState = useStore(state => state.websocketState);
  const lastSnapshot = useStore(state => state.lastUpdated);
  
  const isConnected = readyState === WebSocket.OPEN;
  
  // Calculate time since last update
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastSnapshot) {
        const seconds = Math.floor((Date.now() - lastSnapshot) / 1000);
        setTimeSinceUpdate(`Updated ${seconds}s ago`);
      } else {
        setTimeSinceUpdate('Waiting for data...');
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [lastSnapshot]);
  
  return {
    isConnected,
    timeSinceUpdate
  };
}

// Hook to fetch symbols
export function useSymbols() {
  return useQuery({
    queryKey: ['/api/symbols'],
    staleTime: 60 * 1000, // 1 minute
  });
}

// Hook to fetch liquidity data for a symbol
export function useLiquidityData(symbol: string) {
  return useQuery({
    queryKey: ['/api/liquidity', symbol],
    queryFn: () => fetchLiquiditySnapshot(symbol),
    staleTime: 5 * 1000, // 5 seconds
    enabled: !!symbol,
  });
}

// Hook to fetch recent trades for a symbol
export function useRecentTrades(symbol: string) {
  return useQuery({
    queryKey: ['/api/trades', symbol],
    queryFn: () => fetchTrades(symbol),
    staleTime: 5 * 1000, // 5 seconds
    enabled: !!symbol,
  });
}
