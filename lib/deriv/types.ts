export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export type ActiveSymbol = {
  symbol: string;
  display_name: string;
  market: string;
  submarket: string;
  pip: number;
};

export type Tick = {
  symbol: string;
  quote: number;
  epoch: number;
  digit: number;
  precision: number;
};

export type Candle = {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export interface TickMessage {
  msg_type: 'tick';
  tick: {
    symbol: string;
    quote: number;
    epoch: number;
    pip_size?: number;
  };
  subscription?: { id: string };
}

export interface ActiveSymbolsMessage {
  msg_type: 'active_symbols';
  active_symbols: Array<{
    symbol: string;
    display_name: string;
    market: string;
    submarket: string;
    pip: number;
  }>;
}

export interface CandlesHistoryMessage {
  msg_type: 'candles';
  candles: Array<{
    epoch: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
  subscription?: { id: string };
}
