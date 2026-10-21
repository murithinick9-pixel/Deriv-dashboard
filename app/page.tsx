'use client';

import { useMemo, useState } from 'react';
import { useDerivWebSocket } from '@/hooks/useDerivWebSocket';
import type { Tick } from '@/lib/deriv/types';
import {
  Wifi,
  WifiOff,
  Loader2,
  Activity,
} from 'lucide-react';

export default function DashboardPage() {
  const {
    state,
    symbols,
    ticks,
    candles,
    latency,
    error,
    selectedSymbol,
    setSelectedSymbol,
  } = useDerivWebSocket(process.env.NEXT_PUBLIC_DERIV_APP_ID);

  const [search, setSearch] = useState('');
  const [paused, setPaused] = useState(false);

  const filteredSymbols = useMemo(() => {
    const q = search.toLowerCase();
    return symbols.filter(
      (s) =>
        s.display_name.toLowerCase().includes(q) ||
        s.symbol.toLowerCase().includes(q)
    );
  }, [symbols, search]);

  const latestTick = ticks[ticks.length - 1];

  const digitCounts = useMemo(() => {
    const counts = Array(10).fill(0);
    let total = 0;
    for (const t of ticks) {
      if (t.symbol === selectedSymbol) {
        counts[t.digit]++;
        total++;
      }
    }
    return { counts, total };
  }, [ticks, selectedSymbol]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="text-emerald-400" />
          <h1 className="font-semibold text-lg">Deriv Synthetic Analyst</h1>
        </div>
        <ConnectionBadge state={state} latency={latency} />
      </header>

      <div className="grid lg:grid-cols-[280px_1fr_360px] gap-4 p-4">
        {/* Left sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider">
              Market
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbols…"
              className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            />
            <select
              value={selectedSymbol ?? ''}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="mt-2 w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Choose a market
              </option>
              {filteredSymbols.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.display_name} ({s.symbol})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Latest tick
            </p>
            {latestTick && latestTick.symbol === selectedSymbol ? (
              <div className="mt-2 space-y-1">
                <p className="text-3xl font-mono font-bold text-emerald-400">
                  {latestTick.quote.toFixed(latestTick.precision)}
                </p>
                <p className="text-sm text-slate-400">
                  Final digit:{' '}
                  <span className="text-emerald-300 font-mono text-lg">
                    {latestTick.digit}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  precision={latestTick.precision} · epoch={latestTick.epoch}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Waiting for ticks…
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300">
              {error}
            </div>
          )}
        </aside>

        {/* Center */}
        <section className="space-y-4">
          <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 min-h-[260px]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-slate-300">
                Live tick chart
              </h2>
              <button
                onClick={() => setPaused((p) => !p)}
                className="text-xs rounded-md border border-slate-700 px-3 py-1 text-slate-300 hover:bg-slate-800"
              >
                {paused ? 'Resume' : 'Pause'}
              </button>
            </div>
            <TickSparkline
              ticks={ticks.filter((t) => t.symbol === selectedSymbol)}
              paused={paused}
            />
          </div>

          <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 min-h-[220px]">
            <h2 className="text-sm font-medium text-slate-300 mb-2">
              1‑minute candles
            </h2>
            <CandleTable candles={candles} />
          </div>
        </section>

        {/* Right sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4">
            <h2 className="text-sm font-medium text-slate-300 mb-3">
              Digit distribution
            </h2>
            <DigitBars counts={digitCounts.counts} total={digitCounts.total} />
            <p className="mt-3 text-xs text-slate-500">
              Sample: {digitCounts.total} ticks · baseline 10% per digit
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ConnectionBadge({
  state,
  latency,
}: {
  state: string;
  latency: number | null;
}) {
  const online = state === 'connected';
  return (
    <div
      className={`flex items-center gap-2 text-xs rounded-full px-3 py-1 border ${
        online
          ? 'border-emerald-700 text-emerald-300 bg-emerald-950/30'
          : 'border-amber-700 text-amber-300 bg-amber-950/30'
      }`}
    >
      {online ? (
        <Wifi size={14} />
      ) : state === 'reconnecting' || state === 'connecting' ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <WifiOff size={14} />
      )}
      <span className="capitalize">{state}</span>
      {latency != null && <span>· {latency} ms</span>}
    </div>
  );
}

function TickSparkline({ ticks, paused }: { ticks: Tick[]; paused: boolean }) {
  if (paused) {
    return <p className="text-xs text-slate-500">Updates paused</p>;
  }
  if (ticks.length < 2) {
    return <p className="text-xs text-slate-500">Collecting ticks…</p>;
  }
  const min = Math.min(...ticks.map((t) => t.quote));
  const max = Math.max(...ticks.map((t) => t.quote));
  const range = max - min || 1;
  return (
    <div className="flex items-end gap-[2px] h-40">
      {ticks.slice(-80).map((t, i) => {
        const h = ((t.quote - min) / range) * 100;
        return (
          <div
            key={`${t.epoch}-${i}`}
            className="flex-1 bg-emerald-500/70 rounded-t"
            style={{ height: `${Math.max(2, h)}%` }}
            title={`${t.quote.toFixed(t.precision)} → ${t.digit}`}
          />
        );
      })}
    </div>
  );
}

function CandleTable({ candles }: { candles: any[] }) {
  if (!candles.length) {
    return (
      <p className="text-xs text-slate-500">
        Waiting for one‑minute candles…
      </p>
    );
  }
  return (
    <div className="max-h-48 overflow-y-auto text-xs font-mono">
      <table className="w-full">
        <thead className="text-slate-500 sticky top-0 bg-slate-900">
          <tr>
            <th className="text-left py-1">Epoch</th>
            <th className="text-right">O</th>
            <th className="text-right">H</th>
            <th className="text-right">L</th>
            <th className="text-right">C</th>
          </tr>
        </thead>
        <tbody>
          {candles.slice(-20).map((c: any) => (
            <tr key={c.epoch} className="border-t border-slate-800/60">
              <td className="py-1 text-slate-400">
                {new Date(c.epoch * 1000).toLocaleTimeString()}
              </td>
              <td className="text-right">{c.open.toFixed(2)}</td>
              <td className="text-right text-emerald-400">
                {c.high.toFixed(2)}
              </td>
              <td className="text-right text-rose-400">
                {c.low.toFixed(2)}
              </td>
              <td className="text-right">{c.close.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DigitBars({ counts, total }: { counts: number[]; total: number }) {
  return (
    <div className="space-y-1">
      {counts.map((count, digit) => {
        const pct = total ? (count / total) * 100 : 0;
        return (
          <div key={digit} className="flex items-center gap-2 text-xs">
            <span className="w-4 text-slate-400">{digit}</span>
            <div className="flex-1 h-3 rounded bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-cyan-500/70"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-16 text-right text-slate-400">
              {pct.toFixed(1)}%
            </span>
            <span className="w-10 text-right text-slate-500">{count}</span>
          </div>
        );
      })}
      {total === 0 && (
        <p className="text-xs text-slate-500 pt-2">
          No ticks collected yet. Select a market to begin.
        </p>
      )}
    </div>
  );
}