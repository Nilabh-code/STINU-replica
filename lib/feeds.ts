// lib/feeds.ts — streaming quotes over WebSocket, browser only.
// • biquote.io: SignalR hub with MetaTrader 5 ticks for FX, metals and oil. No key.
//   Spoken with the plain SignalR JSON protocol, so no client library is needed.
// • Binance: public market-data stream (24h mini ticker) for crypto vs USDT. No key.
// Both reconnect with exponential backoff while anything is subscribed.

import type { Tick } from "./market";

type OnTicks = (ticks: Tick[]) => void;

const RS = "\x1e"; // SignalR record separator
const BIQUOTE = "biquote.io";
const BINANCE_WS = "wss://data-stream.binance.vision/stream";
const MAX_BACKOFF_MS = 30_000;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);

interface BiquoteTick {
  symbol?: string;
  bid?: number;
  ask?: number;
  mid?: number;
  timestamp?: string;
}

export class BiquoteStream {
  private ws: WebSocket | null = null;
  private ready = false;
  private connecting = false;
  private disposed = false;
  private wanted = new Set<string>();
  private sent = new Set<string>();
  private closedMarkets = new Map<string, boolean>();
  private retryMs = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private onTicks: OnTicks) {}

  setSymbols(symbols: string[]): void {
    this.wanted = new Set(symbols);
    if (!this.wanted.size) return this.close();
    if (this.ready) this.sync();
    else if (!this.ws && !this.connecting && !this.retryTimer) void this.open();
  }

  dispose(): void {
    this.disposed = true;
    this.close();
  }

  private invoke(target: string, symbols: string[]) {
    this.ws?.send(JSON.stringify({ type: 1, target, arguments: [symbols] }) + RS);
  }

  /** Bring the hub's subscriptions in line with what we want. */
  private sync() {
    const add = [...this.wanted].filter((s) => !this.sent.has(s));
    const drop = [...this.sent].filter((s) => !this.wanted.has(s));
    if (add.length) this.invoke("Subscribe", add);
    if (drop.length) this.invoke("Unsubscribe", drop);
    this.sent = new Set(this.wanted);
  }

  private async open() {
    this.retryTimer = undefined;
    this.connecting = true;
    try {
      const r = await fetch(`https://${BIQUOTE}/hubs/tick/negotiate?negotiateVersion=1`, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) throw new Error(`negotiate ${r.status}`);
      const { connectionToken } = (await r.json()) as { connectionToken?: string };
      if (!connectionToken) throw new Error("no connection token");
      if (this.disposed || !this.wanted.size) return;
      const ws = new WebSocket(`wss://${BIQUOTE}/hubs/tick?id=${encodeURIComponent(connectionToken)}`);
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ protocol: "json", version: 1 }) + RS);
      ws.onmessage = (e) => this.receive(String(e.data));
      ws.onclose = () => this.dropped();
      ws.onerror = () => ws.close();
    } catch {
      this.dropped();
    } finally {
      this.connecting = false;
    }
  }

  private receive(data: string) {
    const ticks: Tick[] = [];
    for (const frame of data.split(RS)) {
      if (!frame) continue;
      let m: { type?: number; target?: string; arguments?: unknown[]; error?: string };
      try {
        m = JSON.parse(frame);
      } catch {
        continue;
      }
      if (!this.ready) {
        // first frame is the handshake reply: {} or {"error": "..."}
        if (m.error) return this.ws?.close();
        this.ready = true;
        this.retryMs = 1000;
        this.sent = new Set();
        this.sync();
        this.pingTimer = setInterval(() => this.ws?.send('{"type":6}' + RS), 15_000);
        continue;
      }
      if (m.type === 1 && m.target === "ReceiveTick") {
        for (const raw of (m.arguments ?? []) as BiquoteTick[]) {
          const bid = num(raw.bid);
          const ask = num(raw.ask);
          const mid = num(raw.mid) ?? (bid && ask ? (bid + ask) / 2 : undefined);
          const time = raw.timestamp ? Date.parse(raw.timestamp) : NaN;
          if (raw.symbol && mid && Number.isFinite(time)) {
            ticks.push({ symbol: raw.symbol, bid, ask, mid, time, closed: this.closedMarkets.get(raw.symbol) });
          }
        }
      } else if (m.type === 1 && m.target === "ReceiveSubscriptionState") {
        const states = (m.arguments?.[0] ?? []) as { symbol?: string; state?: string }[];
        for (const s of states) if (s.symbol) this.closedMarkets.set(s.symbol, s.state === "closed");
      } else if (m.type === 7) {
        this.ws?.close(); // server asked us to go away; reconnect with backoff
      }
    }
    if (ticks.length) this.onTicks(ticks);
  }

  private dropped() {
    clearInterval(this.pingTimer);
    this.ws = null;
    this.ready = false;
    this.sent = new Set();
    if (this.disposed || !this.wanted.size || this.retryTimer) return;
    this.retryTimer = setTimeout(() => void this.open(), this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, MAX_BACKOFF_MS);
  }

  private close() {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    clearInterval(this.pingTimer);
    const ws = this.ws;
    this.ws = null;
    this.ready = false;
    this.sent = new Set();
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }
}

export class BinanceStream {
  private ws: WebSocket | null = null;
  private key = "";
  private disposed = false;
  private retryMs = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private onTicks: OnTicks) {}

  /** Symbols like "BTCUSDT". Reconnects only when the set changes. */
  setSymbols(symbols: string[]): void {
    const key = [...new Set(symbols)].sort().join("/");
    if (key === this.key) return;
    this.key = key;
    this.close();
    if (key) this.open();
  }

  dispose(): void {
    this.disposed = true;
    this.key = "";
    this.close();
  }

  private open() {
    this.retryTimer = undefined;
    const streams = this.key.split("/").map((s) => `${s.toLowerCase()}@miniTicker`).join("/");
    const ws = new WebSocket(`${BINANCE_WS}?streams=${streams}`);
    this.ws = ws;
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(String(e.data))?.data as { e?: string; s?: string; c?: string; E?: number } | undefined;
        const mid = Number(d?.c);
        if (d?.e === "24hrMiniTicker" && d.s && mid > 0 && d.E) {
          this.retryMs = 1000;
          this.onTicks([{ symbol: d.s, mid, time: d.E }]);
        }
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.disposed || !this.key) return;
      this.retryTimer = setTimeout(() => this.open(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, MAX_BACKOFF_MS);
    };
    ws.onerror = () => ws.close();
  }

  private close() {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }
}
