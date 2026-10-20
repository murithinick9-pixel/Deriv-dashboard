'use client';

import { useEffect, useRef, useState } from 'react';
import { DerivWebSocketClient } from '@/lib/deriv/client';
import type {
  ActiveSymbol,
  Candle,
  ConnectionState,
  Tick,
} from '@/lib/deriv/types';

export function useDerivWebSocket(appId?: string) {
  const clientRef = useRef<DerivWebSocketClient | null>(null);

  const [state, setState] = useState<ConnectionState>('connecting');
  const [symbols, setSymbols] = useState<ActiveSymbol[]>([]);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  useEffect(() => {
    const client = new DerivWebSocketClient(appId ?? '1089');
    clientRef.current = client;

    client.on('onState', setState);
    client.on('onActiveSymbols', setSymbols);
    client.on('onLatency', setLatency);
    client.on('onError', setError);

    client.on('onTick', (tick) => {
      setTicks((prev) => {
        // Avoid duplicate ticks (same symbol + epoch).
        const last = prev[prev.length - 1];
        if (last && last.epoch === tick.epoch && last.symbol === tick.symbol) {
          return prev;
        }
        // Bound memory: keep last 2,000 ticks.
        const next = [...prev, tick];
        return next.length > 2_000 ? next.slice(-2_000) : next;
      });
    });

    client.on('onCandles', (newCandles) => {
      setCandles((prev) => mergeCandles(prev, newCandles));
    });

    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [appId]);

  // When the user picks a new symbol, switch subscriptions.
  useEffect(() => {
    if (!selectedSymbol || !clientRef.current) return;
    clientRef.current.setSymbol(selectedSymbol);
    setTicks([]); // Clear ticks from the previous market.
    setCandles([]);
  }, [selectedSymbol]);

  return {
    state,
    symbols,
    ticks,
    candles,
    latency,
    error,
    selectedSymbol,
    setSelectedSymbol,
  };
}

/** Merge candle updates without duplicating or re-ordering. */
function mergeCandles(prev: Candle[], incoming: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  [...prev, ...incoming].forEach((c) => {
    if (c.epoch && Number.isFinite(c.open)) map.set(c.epoch, c);
  });
  return Array.from(map.values()).sort((a, b) => a.epoch - b.epoch);
}
