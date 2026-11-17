import { ArrowUpRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ColorScheme, StockAsset } from '../types/market';
import { formatMoney, formatPrice, formatSignedPct, getMarketLabel, getTrendTextColor } from '../utils/format';

interface PortfolioSandboxViewProps {
  stocks: StockAsset[];
  colorScheme: ColorScheme;
  onSelectAndInspect: (symbol: string) => void;
}

export function PortfolioSandboxView({
  stocks,
  colorScheme,
  onSelectAndInspect,
}: PortfolioSandboxViewProps) {
  const [usdToCny, setUsdToCny] = useState(7.22);
  const [hkdToCny, setHkdToCny] = useState(0.92);

  // Market-wide stress test shock sliders (%)
  const [cnShockPct, setCnShockPct] = useState(0);
  const [hkShockPct, setHkShockPct] = useState(0);
  const [usShockPct, setUsShockPct] = useState(0);

  const toCnyRate = (currency: 'CNY' | 'HKD' | 'USD') => {
    if (currency === 'USD') return usdToCny;
    if (currency === 'HKD') return hkdToCny;
    return 1;
  };

  const getShockForMarket = (market: StockAsset['market']) => {
    if (market === 'HK') return hkShockPct;
    if (market === 'US') return usShockPct;
    return cnShockPct;
  };

  const rows = useMemo(() => {
    return stocks
      .filter((s) => s.position.shares > 0)
      .map((s) => {
        const rate = toCnyRate(s.currency);
        const marketValLocal = s.position.shares * s.currentPrice;
        const costValLocal = s.position.shares * s.position.avgCost;
        const pnlLocal = marketValLocal - costValLocal;
        const pnlPct = costValLocal > 0 ? (pnlLocal / costValLocal) * 100 : 0;

        const shockPct = getShockForMarket(s.market);
        const stressedPrice = s.currentPrice * (1 + shockPct / 100);
        const stressedValCny = s.position.shares * stressedPrice * rate;
        const currentValCny = marketValLocal * rate;
        const costValCny = costValLocal * rate;
        const cashCny = s.position.cashReserve * rate;

        return {
          stock: s,
          rate,
          marketValLocal,
          pnlLocal,
          pnlPct,
          currentValCny,
          costValCny,
          cashCny,
          stressedPrice,
          stressedValCny,
          stressedDeltaCny: stressedValCny - currentValCny,
        };
      });
  }, [stocks, usdToCny, hkdToCny, cnShockPct, hkShockPct, usShockPct]);

  const totals = useMemo(() => {
    const totalMarketCny = rows.reduce((a, r) => a + r.currentValCny, 0);
    const totalCostCny = rows.reduce((a, r) => a + r.costValCny, 0);
    const totalCashCny = rows.reduce((a, r) => a + r.cashCny, 0);
    const totalStressedCny = rows.reduce((a, r) => a + r.stressedValCny, 0);
    const unrealizedPnlCny = totalMarketCny - totalCostCny;
    const unrealizedPct = totalCostCny > 0 ? (unrealizedPnlCny / totalCostCny) * 100 : 0;
    const stressDeltaCny = totalStressedCny - totalMarketCny;
    const stressDeltaPct = totalMarketCny > 0 ? (stressDeltaCny / totalMarketCny) * 100 : 0;

    return {
      totalMarketCny,
      totalCostCny,
      totalCashCny,
      totalAssetsCny: totalMarketCny + totalCashCny,
      unrealizedPnlCny,
      unrealizedPct,
      totalStressedCny,
      stressDeltaCny,
      stressDeltaPct,
    };
  }, [rows]);

  const resetShocks = () => {
    setCnShockPct(0);
    setHkShockPct(0);
    setUsShockPct(0);
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 font-display">
            跨市场持仓组合与压力测试沙盘
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            汇总 A股 / 港股 / 美股 持仓净值，模拟跨市场系统性涨跌冲击下的组合抗压表现
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">USD/CNY</span>
            <input
              type="number"
              step={0.01}
              min={1}
              value={usdToCny}
              onChange={(e) => setUsdToCny(Math.max(1, Number(e.target.value)))}
              className="w-18 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-right"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">HKD/CNY</span>
            <input
              type="number"
              step={0.01}
              min={0.1}
              value={hkdToCny}
              onChange={(e) => setHkdToCny(Math.max(0.1, Number(e.target.value)))}
              className="w-18 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-right"
            />
          </label>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">持仓总市值 (折合人民币)</div>
          <div className="text-xl font-bold font-mono-num text-slate-900 dark:text-slate-50 mt-1">
            {formatMoney(totals.totalMarketCny, 'CNY')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num mt-1">
            含备用金总资产 {formatMoney(totals.totalAssetsCny, 'CNY')}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">当前持仓浮动盈亏</div>
          <div
            className={`text-xl font-bold font-mono-num mt-1 ${getTrendTextColor(
              totals.unrealizedPnlCny,
              colorScheme,
            )}`}
          >
            {totals.unrealizedPnlCny >= 0 ? '+' : ''}
            {formatMoney(totals.unrealizedPnlCny, 'CNY')}
          </div>
          <div
            className={`text-xs font-mono-num mt-1 ${getTrendTextColor(
              totals.unrealizedPct,
              colorScheme,
            )}`}
          >
            累计收益率 {formatSignedPct(totals.unrealizedPct)}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">压力测试后持仓市值</div>
          <div className="text-xl font-bold font-mono-num text-slate-900 dark:text-slate-50 mt-1">
            {formatMoney(totals.totalStressedCny, 'CNY')}
          </div>
          <div
            className={`text-xs font-mono-num mt-1 ${getTrendTextColor(
              totals.stressDeltaCny,
              colorScheme,
            )}`}
          >
            冲击变化 {totals.stressDeltaCny >= 0 ? '+' : ''}
            {formatMoney(totals.stressDeltaCny, 'CNY')} ({formatSignedPct(totals.stressDeltaPct)})
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">股票仓位占比</div>
          <div className="text-xl font-bold font-mono-num text-slate-900 dark:text-slate-50 mt-1">
            {totals.totalAssetsCny > 0
              ? ((totals.totalMarketCny / totals.totalAssetsCny) * 100).toFixed(1)
              : '0.0'}
            %
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num mt-1">
            可用备用金 {formatMoney(totals.totalCashCny, 'CNY')}
          </div>
        </div>
      </div>

      {/* Market Stress Test Sliders */}
      <section className="p-4 lg:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              市场情景联动冲击推演
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              拖动各市场涨跌幅假设滑块，实时计算组合净值与单票回撤暴露
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCnShockPct(-10);
                setHkShockPct(-12);
                setUsShockPct(-15);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              全球避险下挫情景
            </button>
            <button
              type="button"
              onClick={() => {
                setCnShockPct(12);
                setHkShockPct(15);
                setUsShockPct(8);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              风险偏好回暖情景
            </button>
            <button
              type="button"
              onClick={resetShocks}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-md cursor-pointer"
            >
              归零重置
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">A股市场假定涨跌</span>
              <span className={`font-mono-num font-semibold ${getTrendTextColor(cnShockPct, colorScheme)}`}>
                {formatSignedPct(cnShockPct)}
              </span>
            </div>
            <input
              type="range"
              min={-30}
              max={30}
              step={1}
              value={cnShockPct}
              onChange={(e) => setCnShockPct(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">港股市场假定涨跌</span>
              <span className={`font-mono-num font-semibold ${getTrendTextColor(hkShockPct, colorScheme)}`}>
                {formatSignedPct(hkShockPct)}
              </span>
            </div>
            <input
              type="range"
              min={-30}
              max={30}
              step={1}
              value={hkShockPct}
              onChange={(e) => setHkShockPct(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">美股市场假定涨跌</span>
              <span className={`font-mono-num font-semibold ${getTrendTextColor(usShockPct, colorScheme)}`}>
                {formatSignedPct(usShockPct)}
              </span>
            </div>
            <input
              type="range"
              min={-30}
              max={30}
              step={1}
              value={usShockPct}
              onChange={(e) => setUsShockPct(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* Holdings Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            持仓明细与单票压力暴露 ({rows.length} 只)
          </h2>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            暂无持仓股数大于 0 的标的，可在「行情推演 → 持仓与沙盘」中录入当前持仓。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">标的</th>
                  <th className="text-right font-medium px-4 py-2.5">持仓股数</th>
                  <th className="text-right font-medium px-4 py-2.5">成本价</th>
                  <th className="text-right font-medium px-4 py-2.5">最新价</th>
                  <th className="text-right font-medium px-4 py-2.5">浮动盈亏</th>
                  <th className="text-right font-medium px-4 py-2.5">市值权重</th>
                  <th className="text-right font-medium px-4 py-2.5">压力测试价</th>
                  <th className="text-right font-medium px-4 py-2.5">冲击市值变化 (CNY)</th>
                  <th className="text-right font-medium px-4 py-2.5">推演</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => {
                  const weight =
                    totals.totalMarketCny > 0
                      ? (r.currentValCny / totals.totalMarketCny) * 100
                      : 0;
                  return (
                    <tr
                      key={r.stock.symbol}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {r.stock.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                          {r.stock.symbol} · {getMarketLabel(r.stock.market)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono-num">{r.stock.position.shares}</td>
                      <td className="px-4 py-3 text-right font-mono-num">
                        {formatPrice(r.stock.position.avgCost, r.stock.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-num font-semibold">
                        {formatPrice(r.stock.currentPrice, r.stock.currency)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono-num font-medium ${getTrendTextColor(
                          r.pnlLocal,
                          colorScheme,
                        )}`}
                      >
                        {r.pnlLocal >= 0 ? '+' : ''}
                        {formatMoney(r.pnlLocal, r.stock.currency)} ({formatSignedPct(r.pnlPct)})
                      </td>
                      <td className="px-4 py-3 text-right font-mono-num text-slate-600 dark:text-slate-300">
                        {weight.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono-num">
                        {formatPrice(r.stressedPrice, r.stock.currency)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono-num font-semibold ${getTrendTextColor(
                          r.stressedDeltaCny,
                          colorScheme,
                        )}`}
                      >
                        {r.stressedDeltaCny >= 0 ? '+' : ''}
                        {formatMoney(r.stressedDeltaCny, 'CNY')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectAndInspect(r.stock.symbol)}
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                        >
                          <span>推演</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
