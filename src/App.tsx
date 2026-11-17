import {
  BookmarkPlus,
  Moon,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Sun,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AddStockModal } from './components/AddStockModal';
import { MarketChart } from './components/MarketChart';
import { PortfolioSandboxView } from './components/PortfolioSandboxView';
import { ScenarioCompareView } from './components/ScenarioCompareView';
import { SimulationControls } from './components/SimulationControls';
import { TopBar, type WorkspaceView } from './components/TopBar';
import { WatchlistSidebar } from './components/WatchlistSidebar';
import { createDefaultConfig, PRESET_STOCKS } from './data/presets';
import { runSimulation } from './engine/simulator';
import type {
  ColorScheme,
  HoldingPosition,
  SavedScenario,
  SimulationConfig,
  StockAsset,
} from './types/market';
import {
  formatMoney,
  formatPrice,
  formatSignedPct,
  getMarketLabel,
  getTrendTextColor,
} from './utils/format';

const STORAGE_KEYS = {
  stocks: 'guanchao_stocks_v1',
  configs: 'guanchao_configs_v1',
  scenarios: 'guanchao_scenarios_v1',
  prefs: 'guanchao_prefs_v1',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [stocks, setStocks] = useState<StockAsset[]>(() =>
    loadFromStorage(STORAGE_KEYS.stocks, PRESET_STOCKS),
  );
  const [configsBySymbol, setConfigsBySymbol] = useState<Record<string, SimulationConfig>>(() =>
    loadFromStorage(STORAGE_KEYS.configs, {}),
  );
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() =>
    loadFromStorage(STORAGE_KEYS.scenarios, []),
  );
  const [prefs, setPrefs] = useState<{ theme: 'light' | 'dark'; colorScheme: ColorScheme }>(() =>
    loadFromStorage(STORAGE_KEYS.prefs, { theme: 'light', colorScheme: 'cn' }),
  );

  const [activeView, setActiveView] = useState<WorkspaceView>('workbench');
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => stocks[0]?.symbol || '600519.SS');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [syncingSymbol, setSyncingSymbol] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'info' | 'warn'; text: string } | null>(null);

  // Chart presentation toggles
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [historyWindow, setHistoryWindow] = useState<30 | 60 | 90>(60);
  const [showMA, setShowMA] = useState(true);
  const [showCone, setShowCone] = useState(true);
  const [showSamplePaths, setShowSamplePaths] = useState(false);

  // Playback state
  const [playbackDay, setPlaybackDay] = useState<number>(60);
  const [isPlaying, setIsPlaying] = useState(false);

  // Save scenario inline popover
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [scenarioTitle, setScenarioTitle] = useState('');

  // Persist states
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.stocks, JSON.stringify(stocks));
    } catch {
      // ignore storage quota errors
    }
  }, [stocks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.configs, JSON.stringify(configsBySymbol));
    } catch {
      // ignore
    }
  }, [configsBySymbol]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.scenarios, JSON.stringify(savedScenarios));
    } catch {
      // ignore
    }
  }, [savedScenarios]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs));
    } catch {
      // ignore
    }
    const root = document.documentElement;
    if (prefs.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [prefs]);

  const activeStock = useMemo(
    () => stocks.find((s) => s.symbol === selectedSymbol) || stocks[0],
    [stocks, selectedSymbol],
  );

  const activeConfig = useMemo(() => {
    if (!activeStock) return createDefaultConfig();
    return configsBySymbol[activeStock.symbol] || createDefaultConfig();
  }, [activeStock, configsBySymbol]);

  // Keep playbackDay bounded when horizon changes
  useEffect(() => {
    setPlaybackDay(activeConfig.horizonDays);
    setIsPlaying(false);
  }, [activeStock?.symbol, activeConfig.horizonDays]);

  // Playback animation timer
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setPlaybackDay((prev) => {
        if (prev >= activeConfig.horizonDays) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 180);
    return () => clearInterval(timer);
  }, [isPlaying, activeConfig.horizonDays]);

  // Auto-dismiss notice
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(t);
  }, [notice]);

  const simulation = useMemo(() => {
    if (!activeStock) {
      return runSimulation([], { shares: 0, avgCost: 0, cashReserve: 0, takeProfitPrice: null, stopLossPrice: null }, activeConfig);
    }
    return runSimulation(activeStock.bars, activeStock.position, activeConfig);
  }, [activeStock, activeConfig]);

  const updateActiveConfig = (next: SimulationConfig) => {
    if (!activeStock) return;
    setConfigsBySymbol((prev) => ({
      ...prev,
      [activeStock.symbol]: next,
    }));
  };

  const updateActivePosition = (nextPos: HoldingPosition) => {
    if (!activeStock) return;
    setStocks((prev) =>
      prev.map((s) => (s.symbol === activeStock.symbol ? { ...s, position: nextPos } : s)),
    );
  };

  const handleResample = () => {
    updateActiveConfig({
      ...activeConfig,
      seed: Math.floor(Math.random() * 9000000) + 100000,
    });
  };

  const handleSyncStock = async (symbol: string) => {
    setSyncingSymbol(symbol);
    try {
      const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          currentPrice: number;
          prevClose: number;
          bars: StockAsset['bars'];
          name: string;
        };
      };
      if (json.ok && json.data) {
        const d = json.data;
        setStocks((prev) =>
          prev.map((s) =>
            s.symbol === symbol
              ? {
                  ...s,
                  currentPrice: d.currentPrice,
                  prevClose: d.prevClose,
                  bars: d.bars,
                  source: 'live',
                  lastUpdated: d.bars[d.bars.length - 1]?.date || new Date().toISOString().slice(0, 10),
                }
              : s,
          ),
        );
        setNotice({ type: 'info', text: `${symbol} 已同步最新日线行情（${d.currentPrice.toFixed(2)}）` });
      } else {
        setNotice({
          type: 'warn',
          text: json.error || `${symbol} 远端行情暂不可用，继续使用本地基线数据推演`,
        });
      }
    } catch {
      setNotice({
        type: 'warn',
        text: `${symbol} 远端同步超时，当前使用本地基线行情进行推演`,
      });
    } finally {
      setSyncingSymbol(null);
    }
  };

  const handleAddStock = (newStock: StockAsset) => {
    setStocks((prev) => {
      const exists = prev.some((s) => s.symbol === newStock.symbol);
      if (exists) {
        return prev.map((s) => (s.symbol === newStock.symbol ? newStock : s));
      }
      return [newStock, ...prev];
    });
    setSelectedSymbol(newStock.symbol);
    setActiveView('workbench');
    setNotice({ type: 'info', text: `已将 ${newStock.name} (${newStock.symbol}) 加入自选推演列表` });
  };

  const handleRemoveStock = (symbol: string) => {
    setStocks((prev) => {
      const filtered = prev.filter((s) => s.symbol !== symbol);
      if (selectedSymbol === symbol && filtered[0]) {
        setSelectedSymbol(filtered[0].symbol);
      }
      return filtered;
    });
  };

  const handleSaveScenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStock) return;
    const name =
      scenarioTitle.trim() ||
      `${activeStock.name} · ${activeConfig.mode === 'scenario' ? '情景推演' : '蒙特卡洛'} (${activeConfig.horizonDays}日)`;

    const entry: SavedScenario = {
      id: `sc-${Date.now()}`,
      name,
      symbol: activeStock.symbol,
      stockName: activeStock.name,
      createdAt: new Date().toISOString().slice(0, 10),
      config: JSON.parse(JSON.stringify(activeConfig)) as SimulationConfig,
      summary: { ...simulation.summary },
    };

    setSavedScenarios((prev) => [entry, ...prev]);
    setScenarioTitle('');
    setSavePromptOpen(false);
    setNotice({ type: 'info', text: `已保存推演方案「${name}」，可在「方案对比」中横向比较` });
  };

  const handleLoadScenario = (sc: SavedScenario) => {
    setSelectedSymbol(sc.symbol);
    setConfigsBySymbol((prev) => ({
      ...prev,
      [sc.symbol]: JSON.parse(JSON.stringify(sc.config)) as SimulationConfig,
    }));
    setActiveView('workbench');
    setNotice({ type: 'info', text: `已载入推演方案「${sc.name}」` });
  };

  const handleDeleteScenario = (id: string) => {
    setSavedScenarios((prev) => prev.filter((s) => s.id !== id));
  };

  // Current stock derived metrics
  const priceChange = activeStock ? activeStock.currentPrice - activeStock.prevClose : 0;
  const priceChangePct =
    activeStock && activeStock.prevClose > 0 ? (priceChange / activeStock.prevClose) * 100 : 0;

  const holdingMarketVal = activeStock
    ? activeStock.position.shares * activeStock.currentPrice
    : 0;
  const holdingCostVal = activeStock
    ? activeStock.position.shares * activeStock.position.avgCost
    : 0;
  const holdingPnl = holdingMarketVal - holdingCostVal;
  const holdingPnlPct = holdingCostVal > 0 ? (holdingPnl / holdingCostVal) * 100 : 0;

  const currentPlaybackPoint =
    playbackDay > 0 && simulation.points[playbackDay - 1]
      ? simulation.points[playbackDay - 1]
      : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <TopBar
        activeView={activeView}
        onSelectView={setActiveView}
        onOpenAddStock={() => setIsAddModalOpen(true)}
      />

      {notice && (
        <div
          className={`px-4 lg:px-6 py-2 text-xs border-b flex items-center justify-between ${
            notice.type === 'warn'
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs underline ml-4 cursor-pointer"
          >
            关闭
          </button>
        </div>
      )}

      {activeView === 'portfolio' && (
        <main className="flex-1">
          <PortfolioSandboxView
            stocks={stocks}
            colorScheme={prefs.colorScheme}
            onSelectAndInspect={(sym) => {
              setSelectedSymbol(sym);
              setActiveView('workbench');
            }}
          />
        </main>
      )}

      {activeView === 'compare' && (
        <main className="flex-1">
          <ScenarioCompareView
            scenarios={savedScenarios}
            stocks={stocks}
            colorScheme={prefs.colorScheme}
            onLoadScenario={handleLoadScenario}
            onDeleteScenario={handleDeleteScenario}
            onGoToWorkbench={() => setActiveView('workbench')}
          />
        </main>
      )}

      {activeView === 'workbench' && activeStock && (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          <WatchlistSidebar
            stocks={stocks}
            selectedSymbol={activeStock.symbol}
            colorScheme={prefs.colorScheme}
            syncingSymbol={syncingSymbol}
            onSelectStock={setSelectedSymbol}
            onSyncStock={handleSyncStock}
            onRemoveStock={handleRemoveStock}
          />

          <main className="flex-1 min-w-0 p-4 lg:p-5 space-y-4 overflow-y-auto">
            {/* Stock Workspace Header & Utility Toolbar */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-3">
                  <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-slate-50 font-display tracking-tight">
                    {activeStock.name}
                  </h1>
                  <span className="text-sm font-mono-num text-slate-500 dark:text-slate-400">
                    {activeStock.symbol}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>{getMarketLabel(activeStock.market)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeStock.sector}</span>
                  {activeStock.pe !== null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">PE {activeStock.pe}</span>
                    </>
                  )}
                  {activeStock.pb !== null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">PB {activeStock.pb}</span>
                    </>
                  )}
                  {activeStock.dividendYield !== null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">股息率 {activeStock.dividendYield}%</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>
                    {activeStock.source === 'live'
                      ? `实时同步 (${activeStock.lastUpdated})`
                      : activeStock.source === 'custom'
                      ? '自定义沙盘标的数据'
                      : `基线行情 (${activeStock.lastUpdated})`}
                  </span>
                </div>
              </div>

              {/* Workspace Preferences & Save Scenario */}
              <div className="flex flex-wrap items-center gap-2 relative">
                <button
                  type="button"
                  onClick={() => handleSyncStock(activeStock.symbol)}
                  disabled={syncingSymbol === activeStock.symbol}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      syncingSymbol === activeStock.symbol ? 'animate-spin text-blue-600' : ''
                    }`}
                  />
                  <span>同步行情</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPrefs((p) => ({
                      ...p,
                      colorScheme: p.colorScheme === 'cn' ? 'us' : 'cn',
                    }))
                  }
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {prefs.colorScheme === 'cn' ? '红涨绿跌' : '绿涨红跌'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPrefs((p) => ({
                      ...p,
                      theme: p.theme === 'light' ? 'dark' : 'light',
                    }))
                  }
                  aria-label="切换深浅色主题"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {prefs.theme === 'light' ? (
                    <>
                      <Moon className="w-3.5 h-3.5" />
                      <span>深色</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-3.5 h-3.5" />
                      <span>浅色</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSavePromptOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>保存方案</span>
                </button>

                {savePromptOpen && (
                  <form
                    onSubmit={handleSaveScenario}
                    className="absolute right-0 top-10 z-30 w-72 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg space-y-2.5"
                  >
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                      推演方案名称
                      <input
                        type="text"
                        value={scenarioTitle}
                        onChange={(e) => setScenarioTitle(e.target.value)}
                        placeholder={`${activeStock.name} 推演方案`}
                        autoFocus
                        className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSavePromptOpen(false)}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded cursor-pointer"
                      >
                        保存至对比
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* 4-Column KPI Summary Strip (Flat 1px border, internal dividers, zero nested cards) */}
            <div className="grid grid-cols-2 xl:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y xl:divide-y-0 xl:divide-x divide-slate-200 dark:divide-slate-800">
              <div className="p-3.5 lg:p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">最新收盘价</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-mono-num text-slate-900 dark:text-slate-50">
                    {formatPrice(activeStock.currentPrice, activeStock.currency)}
                  </span>
                  <span className={`text-xs font-semibold font-mono-num ${getTrendTextColor(priceChange, prefs.colorScheme)}`}>
                    {priceChange >= 0 ? '+' : ''}
                    {priceChange.toFixed(2)} ({formatSignedPct(priceChangePct)})
                  </span>
                </div>
              </div>

              <div className="p-3.5 lg:p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  当前持仓 ({activeStock.position.shares} 股 · 成本{' '}
                  {activeStock.position.avgCost.toFixed(2)})
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-mono-num text-slate-900 dark:text-slate-50">
                    {formatMoney(holdingMarketVal, activeStock.currency)}
                  </span>
                  <span className={`text-xs font-semibold font-mono-num ${getTrendTextColor(holdingPnl, prefs.colorScheme)}`}>
                    {holdingPnl >= 0 ? '+' : ''}
                    {formatMoney(holdingPnl, activeStock.currency)} ({formatSignedPct(holdingPnlPct)})
                  </span>
                </div>
              </div>

              <div className="p-3.5 lg:p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  推演期末中位价 (T+{activeConfig.horizonDays})
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-mono-num text-blue-600 dark:text-blue-400">
                    {formatPrice(simulation.summary.p50FinalPrice, activeStock.currency)}
                  </span>
                  <span
                    className={`text-xs font-semibold font-mono-num ${getTrendTextColor(
                      simulation.summary.expectedReturnPct,
                      prefs.colorScheme,
                    )}`}
                  >
                    {formatSignedPct(simulation.summary.expectedReturnPct)}
                  </span>
                </div>
              </div>

              <div className="p-3.5 lg:p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  胜率分布 · 沙盘期末总资产
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-mono-num text-slate-900 dark:text-slate-50">
                    {formatMoney(simulation.summary.finalEquity, activeStock.currency)}
                  </span>
                  <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                    正收益概率 {simulation.summary.winProbabilityPct}%
                  </span>
                </div>
              </div>
            </div>

            {/* Primary Interactive Chart Card */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {/* Chart Toolbar */}
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Candle vs Line */}
                  <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-xs">
                    <button
                      type="button"
                      onClick={() => setChartType('candle')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        chartType === 'candle'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 font-medium shadow-xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      K线图
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartType('line')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        chartType === 'line'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 font-medium shadow-xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      折线图
                    </button>
                  </div>

                  {/* Historical Window */}
                  <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-mono-num">
                    {([30, 60, 90] as const).map((win) => (
                      <button
                        key={win}
                        type="button"
                        onClick={() => setHistoryWindow(win)}
                        className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                          historyWindow === win
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 font-medium shadow-xs'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        近{win}日
                      </button>
                    ))}
                  </div>

                  {/* Overlay Toggles */}
                  <div className="flex items-center gap-3 pl-2 text-xs text-slate-600 dark:text-slate-300">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showMA}
                        onChange={(e) => setShowMA(e.target.checked)}
                        className="rounded accent-blue-600"
                      />
                      <span>均线 MA5/20</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showCone}
                        onChange={(e) => setShowCone(e.target.checked)}
                        className="rounded accent-blue-600"
                      />
                      <span>P10–P90 概率带</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSamplePaths}
                        onChange={(e) => setShowSamplePaths(e.target.checked)}
                        className="rounded accent-blue-600"
                      />
                      <span>采样轨迹</span>
                    </label>
                  </div>
                </div>

                {/* Playback Step Controls */}
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setPlaybackDay(0);
                    }}
                    title="回到推演起点 T+0"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>重置</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (playbackDay >= activeConfig.horizonDays) {
                        setPlaybackDay(1);
                      }
                      setIsPlaying((p) => !p);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{isPlaying ? '暂停' : '回放推演'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setPlaybackDay((d) => Math.min(activeConfig.horizonDays, d + 1));
                    }}
                    title="单步推进1个交易日"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <SkipForward className="w-3 h-3" />
                    <span>+1日</span>
                  </button>
                </div>
              </div>

              <MarketChart
                currency={activeStock.currency}
                bars={activeStock.bars}
                position={activeStock.position}
                simulation={simulation}
                playbackDay={playbackDay}
                colorScheme={prefs.colorScheme}
                chartType={chartType}
                showMA={showMA}
                showCone={showCone}
                showSamplePaths={showSamplePaths}
                historyWindow={historyWindow}
              />

              {/* Timeline Scrubber Bar */}
              <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                  <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    推演进度 T+{playbackDay} / {activeConfig.horizonDays}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={activeConfig.horizonDays}
                    value={playbackDay}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setPlaybackDay(Number(e.target.value));
                    }}
                    aria-label="推演时间轴进度"
                    className="flex-1 accent-blue-600 cursor-pointer"
                  />
                </div>

                {currentPlaybackPoint ? (
                  <div className="flex flex-wrap items-center gap-4 font-mono-num text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      推演日期 {currentPlaybackPoint.date}
                    </span>
                    <span>
                      沙盘价格{' '}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {formatPrice(currentPlaybackPoint.activeClose, activeStock.currency)}
                      </strong>
                    </span>
                    <span>
                      总资产{' '}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {formatMoney(currentPlaybackPoint.totalEquity, activeStock.currency)}
                      </strong>
                    </span>
                    <span
                      className={`font-semibold ${getTrendTextColor(
                        currentPlaybackPoint.totalPnl,
                        prefs.colorScheme,
                      )}`}
                    >
                      累计盈亏 {currentPlaybackPoint.totalPnl >= 0 ? '+' : ''}
                      {formatMoney(currentPlaybackPoint.totalPnl, activeStock.currency)} (
                      {formatSignedPct(currentPlaybackPoint.totalReturnPct)})
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400 font-mono-num">
                    处于推演起点 T+0 · 点击「回放推演」或拖动滑块查看逐日演化
                  </span>
                )}
              </div>
            </section>

            {/* Simulation Configurator */}
            <SimulationControls
              currency={activeStock.currency}
              currentPrice={activeStock.currentPrice}
              position={activeStock.position}
              config={activeConfig}
              simulation={simulation}
              colorScheme={prefs.colorScheme}
              onUpdateConfig={updateActiveConfig}
              onUpdatePosition={updateActivePosition}
              onResample={handleResample}
            />
          </main>
        </div>
      )}

      <AddStockModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddStock={handleAddStock}
      />
    </div>
  );
}
