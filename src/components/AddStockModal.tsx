import { Loader2, Search, X } from 'lucide-react';
import { useState } from 'react';
import { generateHistoricalBars } from '../engine/simulator';
import type { MarketRegion, StockAsset } from '../types/market';

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStock: (stock: StockAsset) => void;
}

interface SearchCandidate {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export function AddStockModal({ isOpen, onClose, onAddStock }: AddStockModalProps) {
  const [tab, setTab] = useState<'lookup' | 'custom'>('lookup');
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [syncingSymbol, setSyncingSymbol] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom sandbox stock form
  const [customSymbol, setCustomSymbol] = useState('');
  const [customName, setCustomName] = useState('');
  const [customMarket, setCustomMarket] = useState<MarketRegion>('CN');
  const [customSector, setCustomSector] = useState('科技成长');
  const [customPrice, setCustomPrice] = useState(50);
  const [customVol, setCustomVol] = useState(32);
  const [customShares, setCustomShares] = useState(500);
  const [customCost, setCustomCost] = useState(48);

  if (!isOpen) return null;

  const inferMarket = (sym: string): { market: MarketRegion; currency: 'CNY' | 'HKD' | 'USD' } => {
    const upper = sym.toUpperCase();
    if (upper.endsWith('.SS') || upper.endsWith('.SZ') || upper.endsWith('.BJ')) {
      return { market: 'CN', currency: 'CNY' };
    }
    if (upper.endsWith('.HK')) {
      return { market: 'HK', currency: 'HKD' };
    }
    return { market: 'US', currency: 'USD' };
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (!q) return;
    setErrorMsg(null);
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { ok: boolean; results?: SearchCandidate[] };
      const list = json.results || [];
      setCandidates(list);
      if (list.length === 0) {
        setErrorMsg('未搜索到远端匹配代码，可直接输入精确代码尝试同步，或切换「自定义沙盘标的」创建。');
      }
    } catch {
      setErrorMsg('远端搜索暂时不可用，可直接输入代码尝试同步或创建自定义沙盘标的。');
    } finally {
      setSearching(false);
    }
  };

  const handleFetchAndAdd = async (symbolToFetch: string, fallbackName?: string) => {
    const clean = symbolToFetch.trim().toUpperCase();
    if (!clean) return;
    setErrorMsg(null);
    setSyncingSymbol(clean);

    try {
      const res = await fetch(`/api/quote?symbol=${encodeURIComponent(clean)}`);
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          symbol: string;
          name: string;
          currency: string;
          exchange: string;
          currentPrice: number;
          prevClose: number;
          bars: StockAsset['bars'];
        };
      };

      if (json.ok && json.data) {
        const d = json.data;
        const inferred = inferMarket(d.symbol);
        const currency =
          d.currency === 'CNY' || d.currency === 'HKD' || d.currency === 'USD'
            ? d.currency
            : inferred.currency;

        const asset: StockAsset = {
          symbol: d.symbol,
          name: fallbackName || d.name || d.symbol,
          market: inferred.market,
          sector: d.exchange || '实时同步',
          currency,
          currentPrice: d.currentPrice,
          prevClose: d.prevClose,
          pe: null,
          pb: null,
          dividendYield: null,
          bars: d.bars,
          position: {
            shares: 0,
            avgCost: d.currentPrice,
            cashReserve: 50000,
            takeProfitPrice: Number((d.currentPrice * 1.18).toFixed(2)),
            stopLossPrice: Number((d.currentPrice * 0.9).toFixed(2)),
          },
          source: 'live',
          lastUpdated: d.bars[d.bars.length - 1]?.date || new Date().toISOString().slice(0, 10),
        };
        onAddStock(asset);
        onClose();
        return;
      }

      setErrorMsg(
        json.error || '未能拉取到该代码行情，建议切换「自定义沙盘标的」手动设定起始价。',
      );
    } catch {
      setErrorMsg('请求行情接口失败，建议切换「自定义沙盘标的」手动创建。');
    } finally {
      setSyncingSymbol(null);
    }
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = (customSymbol.trim() || `SIM-${Date.now().toString().slice(-4)}`).toUpperCase();
    const name = customName.trim() || sym;
    const price = Math.max(0.1, Number(customPrice) || 50);
    const currency: 'CNY' | 'HKD' | 'USD' =
      customMarket === 'HK' ? 'HKD' : customMarket === 'US' ? 'USD' : 'CNY';

    const bars = generateHistoricalBars(
      price,
      90,
      8,
      Math.max(10, customVol),
      5000000,
      sym.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) + 777,
    );

    const prevClose = bars.length >= 2 ? bars[bars.length - 2].close : price;

    const asset: StockAsset = {
      symbol: sym,
      name,
      market: customMarket,
      sector: customSector.trim() || '自定义标的',
      currency,
      currentPrice: bars[bars.length - 1].close,
      prevClose,
      pe: null,
      pb: null,
      dividendYield: null,
      bars,
      position: {
        shares: Math.max(0, customShares),
        avgCost: Math.max(0, customCost),
        cashReserve: 50000,
        takeProfitPrice: Number((price * 1.2).toFixed(2)),
        stopLossPrice: Number((price * 0.88).toFixed(2)),
      },
      source: 'custom',
      lastUpdated: bars[bars.length - 1].date,
    };

    onAddStock(asset);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-stock-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2
            id="add-stock-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            添加股票或沙盘推演标的
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭弹窗"
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setTab('lookup');
                setErrorMsg(null);
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === 'lookup'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              同步真实股票行情
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('custom');
                setErrorMsg(null);
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === 'custom'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              自定义沙盘标的
            </button>
          </div>
        </div>

        {tab === 'lookup' ? (
          <div className="p-5 space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="输入代码或简称，如 600036、0700.HK、MSFT"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                {searching ? '搜索中...' : '搜索'}
              </button>
              <button
                type="button"
                disabled={!searchTerm.trim() || syncingSymbol !== null}
                onClick={() => handleFetchAndAdd(searchTerm)}
                className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                直接同步代码
              </button>
            </form>

            {errorMsg && (
              <div className="p-3 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg">
                {errorMsg}
              </div>
            )}

            {candidates.length > 0 && (
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                {candidates.map((item) => (
                  <div
                    key={item.symbol}
                    className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </div>
                      <div className="font-mono-num text-slate-500 dark:text-slate-400">
                        {item.symbol} · {item.exchange}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={syncingSymbol === item.symbol}
                      onClick={() => handleFetchAndAdd(item.symbol, item.name)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded cursor-pointer"
                    >
                      {syncingSymbol === item.symbol && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <span>加入自选</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              支持自动识别 A 股 6 位代码（如 600036 → 600036.SS）、港股代码（0700 → 0700.HK）及美股代码（TSLA、MSFT）。
            </p>
          </div>
        ) : (
          <form onSubmit={handleCreateCustom} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">标的代码</span>
                <input
                  type="text"
                  required
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                  placeholder="如 688981.SS"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">股票名称</span>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="如 中芯国际"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">所属市场</span>
                <select
                  value={customMarket}
                  onChange={(e) => setCustomMarket(e.target.value as MarketRegion)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="CN">A股 (CNY)</option>
                  <option value="HK">港股 (HKD)</option>
                  <option value="US">美股 (USD)</option>
                  <option value="CUSTOM">自定义沙盘 (CNY)</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">所属板块</span>
                <input
                  type="text"
                  value={customSector}
                  onChange={(e) => setCustomSector(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">当前基准价</span>
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  value={customPrice}
                  onChange={(e) => setCustomPrice(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">历史参考波动率 (%)</span>
                <input
                  type="number"
                  min={8}
                  max={90}
                  value={customVol}
                  onChange={(e) => setCustomVol(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">初始持仓股数</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={customShares}
                  onChange={(e) => setCustomShares(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">持仓成本价</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={customCost}
                  onChange={(e) => setCustomCost(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
              >
                生成基线并开始推演
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
