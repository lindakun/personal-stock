import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

interface YahooQuoteResult {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  currentPrice: number;
  prevClose: number;
  bars: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

function normalizeTickerSymbol(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned) return '';
  if (cleaned.includes('.')) return cleaned;
  // 6-digit A-share code
  if (/^\d{6}$/.test(cleaned)) {
    if (cleaned.startsWith('6') || cleaned.startsWith('5')) {
      return `${cleaned}.SS`;
    }
    if (cleaned.startsWith('0') || cleaned.startsWith('3') || cleaned.startsWith('1')) {
      return `${cleaned}.SZ`;
    }
    if (cleaned.startsWith('8') || cleaned.startsWith('4')) {
      return `${cleaned}.BJ`;
    }
  }
  // 4-5 digit HK code
  if (/^\d{4,5}$/.test(cleaned)) {
    const num = String(Number(cleaned)).padStart(4, '0');
    return `${num}.HK`;
  }
  return cleaned;
}

async function fetchYahooChart(symbol: string): Promise<YahooQuoteResult | null> {
  const normalized = normalizeTickerSymbol(symbol);
  if (!normalized) return null;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    normalized,
  )}?range=6mo&interval=1d`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StockWorkbench/1.0)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            symbol?: string;
            shortName?: string;
            longName?: string;
            currency?: string;
            exchangeName?: string;
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
          };
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: Array<number | null>;
              high?: Array<number | null>;
              low?: Array<number | null>;
              close?: Array<number | null>;
              volume?: Array<number | null>;
            }>;
          };
        }>;
      };
    };

    const result = json.chart?.result?.[0];
    if (!result || !result.meta) return null;

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    if (!quote || timestamps.length === 0) return null;

    const bars: YahooQuoteResult['bars'] = [];
    for (let i = 0; i < timestamps.length; i += 1) {
      const o = quote.open?.[i];
      const h = quote.high?.[i];
      const l = quote.low?.[i];
      const c = quote.close?.[i];
      const v = quote.volume?.[i] ?? 0;
      if (o == null || h == null || l == null || c == null) continue;
      const d = new Date(timestamps[i] * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      bars.push({
        date: dateStr,
        open: Number(o.toFixed(2)),
        high: Number(h.toFixed(2)),
        low: Number(l.toFixed(2)),
        close: Number(c.toFixed(2)),
        volume: Math.round(v),
      });
    }

    if (bars.length === 0) return null;

    const lastBar = bars[bars.length - 1];
    const prevBar = bars.length > 1 ? bars[bars.length - 2] : lastBar;
    const currentPrice = Number((result.meta.regularMarketPrice ?? lastBar.close).toFixed(2));
    const prevClose = Number(
      (result.meta.previousClose ?? result.meta.chartPreviousClose ?? prevBar.close).toFixed(2),
    );

    return {
      symbol: result.meta.symbol || normalized,
      name: result.meta.shortName || result.meta.longName || normalized,
      currency: result.meta.currency || 'USD',
      exchange: result.meta.exchangeName || '',
      currentPrice,
      prevClose,
      bars: bars.slice(-90),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/quote', async (req, res) => {
    const rawSymbol = typeof req.query.symbol === 'string' ? req.query.symbol : '';
    if (!rawSymbol.trim()) {
      res.status(400).json({ ok: false, error: '缺少股票代码参数' });
      return;
    }
    const quote = await fetchYahooChart(rawSymbol);
    if (!quote) {
      res.json({
        ok: false,
        error: '无法从远端行情源获取该代码，可使用本地基线行情或手动输入初始价推演',
      });
      return;
    }
    res.json({ ok: true, data: quote });
  });

  app.get('/api/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      res.json({ ok: true, results: [] });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        q,
      )}&quotesCount=8&newsCount=0`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StockWorkbench/1.0)',
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        res.json({ ok: true, results: [] });
        return;
      }
      const data = (await response.json()) as {
        quotes?: Array<{
          symbol?: string;
          shortname?: string;
          longname?: string;
          exchange?: string;
          quoteType?: string;
        }>;
      };
      const results = (data.quotes || [])
        .filter((item) => item.symbol && item.quoteType !== 'OPTION')
        .slice(0, 8)
        .map((item) => ({
          symbol: item.symbol || '',
          name: item.shortname || item.longname || item.symbol || '',
          exchange: item.exchange || '',
          type: item.quoteType || 'EQUITY',
        }));
      res.json({ ok: true, results });
    } catch {
      res.json({ ok: true, results: [] });
    } finally {
      clearTimeout(timer);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('/{*path}', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp();
