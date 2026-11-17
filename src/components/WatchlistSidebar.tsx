import { RefreshCw, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ColorScheme, MarketRegion, StockAsset } from '../types/market';
import { formatPrice, formatSignedPct, getMarketLabel, getTrendTextColor } from '../utils/format';

interface WatchlistSidebarProps {
  stocks: StockAsset[];
  selectedSymbol: string;
  colorScheme: ColorScheme;
  syncingSymbol: string | null;
  onSelectStock: (symbol: string) => void;
  onSyncStock: (symbol: string) => void;
  onRemoveStock: (symbol: string) => void;
}

type MarketFilter = 'ALL' | MarketRegion;

export function WatchlistSidebar({
  stocks,
  selectedSymbol,
  colorScheme,
  syncingSymbol,
  onSelectStock,
  onSyncStock,
  onRemoveStock,
}: WatchlistSidebarProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MarketFilter>('ALL');

  const filteredStocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stocks.filter((s) => {
      if (filter !== 'ALL' && s.market !== filter) return false;
      if (!q) return true;
      return (
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q)
      );
    });
  }, [stocks, query, filter]);

  const filterTabs: Array<{ id: MarketFilter; label: string }> = [
    { id: 'ALL', label: '全部' },
    { id: 'CN', label: 'A股' },
    { id: 'HK', label: '港股' },
    { id: 'US', label: '美股' },
  ];

  return (
    <aside className="w-full lg:w-[272px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300">
            自选行情列表 ({stocks.length})
          </h2>
        </div>

        <div className="relative">
          <Search
            className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索代码、名称或行业"
            aria-label="搜索自选股"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600"
          />
        </div>

        <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-md">
          {filterTabs.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[260px] lg:max-h-none">
        {filteredStocks.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
            没有匹配的自选标的
          </div>
        ) : (
          filteredStocks.map((stock) => {
            const isSelected = stock.symbol === selectedSymbol;
            const change = stock.currentPrice - stock.prevClose;
            const changePct = stock.prevClose > 0 ? (change / stock.prevClose) * 100 : 0;
            const trendColor = getTrendTextColor(change, colorScheme);
            const isSyncing = syncingSymbol === stock.symbol;

            return (
              <div
                key={stock.symbol}
                className={`group flex items-center justify-between gap-2 px-3.5 py-2.5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/70 dark:bg-blue-950/35'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
                onClick={() => onSelectStock(stock.symbol)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectStock(stock.symbol);
                  }
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm font-medium truncate ${
                        isSelected
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {stock.name}
                    </span>
                    {stock.position.shares > 0 && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                        持{stock.position.shares}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num truncate">
                    {stock.symbol} · {getMarketLabel(stock.market)}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono-num">
                      {formatPrice(stock.currentPrice, stock.currency)}
                    </div>
                    <div className={`text-[11px] font-medium font-mono-num ${trendColor}`}>
                      {formatSignedPct(changePct)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      title="同步最新行情"
                      aria-label={`同步 ${stock.name} 行情`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSyncStock(stock.symbol);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-600' : ''}`}
                      />
                    </button>
                    {stocks.length > 1 && (
                      <button
                        type="button"
                        title="移出自选"
                        aria-label={`移出 ${stock.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveStock(stock.symbol);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
