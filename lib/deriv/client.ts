import type {
  ActiveSymbol,
  Candle,
  ConnectionState,
  Tick,
} from './types';
import { extractFinalDigit } from '../statistics/digits';

type MessageHandler = (msg: any) => void;

export type DerivClientEvents = {
  onState: (state: ConnectionState) => void;
  onTick: (tick: Tick) => void;
  onCandles: (candles: Candle[]) => void;
  onActiveSymbols: (symbols: ActiveSymbol[]) => void;
  onError: (error: string) => void;
  onLatency: (ms: number) => void;
};

export class DerivWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Partial<DerivClientEvents> = {};
  private reconnectAttempt = 0;
  private maxReconnects = 8;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pingSentAt = 0;
  private currentSymbol: string | null = null;
  private symbolPipSizes = new Map<string, number>();
  private lastSubscriptionIds = new Set<string>();

  constructor(private appId: string = '1089') {
  this.appId = '1089'; // Temporarily forcing the test ID
}

  on<K extends keyof DerivClientEvents>(
    event: K,
    handler: DerivClientEvents[K]
  ) {
    this.listeners[event] = handler;
  }

  private emit<K extends keyof DerivClientEvents>(
    event: K,
    ...args: Parameters<DerivClientEvents[K]>
  ) {
    const h = this.listeners[event] as any;
    if (h) h(...args);
  }

  connect() {
    this.emit('onState', 'connecting');
    this.ws = new WebSocket(
  `wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`
);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.emit('onState', 'connected');
      this.startPing();
      this.requestActiveSymbols();
      if (this.currentSymbol) {
        this.subscribeTicks(this.currentSymbol);
        this.requestCandles(this.currentSymbol);
      }
    };

    this.ws.onmessage = (event) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        this.emit('onError', 'Malformed message received');
        return;
      }

      if (msg.error) {
        this.emit('onError', msg.error.message ?? 'API error');
        return;
      }

      switch (msg.msg_type) {
        case 'active_symbols':
          this.handleActiveSymbols(msg.active_symbols);
          break;
        case 'tick':
          this.handleTick(msg);
          break;
        case 'candles':
          this.handleCandles(msg);
          break;
        case 'pong':
          this.handlePong();
          break;
        default:
          break;
      }
    };

    this.ws.onerror = () => {
      this.emit('onError', 'WebSocket error');
    };

    this.ws.onclose = () => {
      this.stopPing();
      if (this.reconnectAttempt < this.maxReconnects) {
        this.scheduleReconnect();
      } else {
        this.emit('onState', 'disconnected');
      }
    };
  }

  private scheduleReconnect() {
    this.emit('onState', 'reconnecting');
    const delay = Math.min(
      30_000,
      2 ** this.reconnectAttempt * 1_000
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private requestActiveSymbols() {
    this.send({ active_symbols: 'brief', req_id: Date.now() });
  }

  private handleActiveSymbols(symbols: any[]) {
    const mapped: ActiveSymbol[] = symbols.map((s) => ({
      symbol: s.symbol,
      display_name: s.display_name,
      market: s.market,
      submarket: s.submarket,
      pip: s.pip,
    }));
    mapped.forEach((s) => this.symbolPipSizes.set(s.symbol, s.pip));
    this.emit('onActiveSymbols', mapped);
  }

  setSymbol(symbol: string) {
    if (this.currentSymbol === symbol) return;
    this.unsubscribeAll();
    this.currentSymbol = symbol;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.subscribeTicks(symbol);
      this.requestCandles(symbol);
    }
  }

  private subscribeTicks(symbol: string) {
    this.send({ ticks: symbol, subscribe: 1, req_id: Date.now() });
  }

  private requestCandles(symbol: string) {
    this.send({
      ticks_history: symbol,
      end: 'latest',
      count: 300,
      style: 'candles',
      granularity: 60,
      subscribe: 1,
      req_id: Date.now(),
    });
  }

  private handleTick(msg: any) {
    const t = msg.tick;
    if (!t?.symbol || typeof t.quote !== 'number') return;

    if (msg.subscription?.id) {
      this.lastSubscriptionIds.add(msg.subscription.id);
    }

    const pip = this.symbolPipSizes.get(t.symbol) ?? t.pip_size ?? 0.01;
    const extracted = extractFinalDigit(t.quote, pip);
    if (!extracted) return;

    this.emit('onTick', {
      symbol: t.symbol,
      quote: t.quote,
      epoch: t.epoch,
      digit: extracted.digit,
      precision: extracted.precision,
    });
  }

  private handleCandles(msg: any) {
    if (!Array.isArray(msg.candles)) return;
    if (msg.subscription?.id) {
      this.lastSubscriptionIds.add(msg.subscription.id);
    }
    const mapped: Candle[] = msg.candles
      .map((c: any) => ({
        epoch: Number(c.epoch),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }))
      .filter(
  (c: Candle) =>
    Number.isFinite(c.epoch) &&
    Number.isFinite(c.open) &&
    Number.isFinite(c.close)
);
    this.emit('onCandles', mapped);
  }

  private unsubscribeAll() {
    this.send({ forget_all: ['ticks', 'candles'], req_id: Date.now() });
    this.lastSubscriptionIds.clear();
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.pingSentAt = performance.now();
      this.send({ ping: 1 });
    }, 25_000);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handlePong() {
    if (this.pingSentAt) {
      const latency = Math.round(performance.now() - this.pingSentAt);
      this.emit('onLatency', latency);
      this.pingSentAt = 0;
    }
  }

  disconnect() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.emit('onState', 'disconnected');
  }
      }
