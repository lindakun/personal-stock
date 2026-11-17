import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { runSimulation } from '../engine/simulator';
import type { ColorScheme, SavedScenario, StockAsset } from '../types/market';
import { formatMoney, formatPrice, formatSignedPct, getTrendTextColor } from '../utils/format';

interface ScenarioCompareViewProps {
  scenarios: SavedScenario[];
  stocks: StockAsset[];
  colorScheme: ColorScheme;
  onLoadScenario: (scenario: SavedScenario) => void;
  onDeleteScenario: (id: string) => void;
  onGoToWorkbench: () => void;
}

const LINE_PALETTE = ['#2563eb', '#d97706', '#059669', '#7c3aed', '#e11d48', '#0891b2'];

export function ScenarioCompareView({
  scenarios,
  stocks,
  colorScheme,
  onLoadScenario,
  onDeleteScenario,
  onGoToWorkbench,
}: ScenarioCompareViewProps) {
  // Compute normalized P50 return curves (% change from startPrice) for up to 6 saved scenarios
  const plottedCurves = useMemo(() => {
    return scenarios.slice(0, 6).map((sc, idx) => {
      const stock = stocks.find((s) => s.symbol === sc.symbol);
      if (!stock) {
        return { scenario: sc, color: LINE_PALETTE[idx % LINE_PALETTE.length], returns: [] as number[] };
      }
      const res = runSimulation(stock.bars, stock.position, sc.config);
      const base = res.summary.startPrice || 1;
      const returns = [0, ...res.points.map((pt) => ((pt.p50 - base) / base) * 100)];
      return {
        scenario: sc,
        color: LINE_PALETTE[idx % LINE_PALETTE.length],
        returns,
      };
    });
  }, [scenarios, stocks]);

  const { maxDays, minRet, maxRet } = useMemo(() => {
    let md = 20;
    let mn = -10;
    let mx = 10;
    for (const c of plottedCurves) {
      if (c.returns.length > md) md = c.returns.length;
      for (const r of c.returns) {
        if (r < mn) mn = r;
        if (r > mx) mx = r;
      }
    }
    const pad = Math.max(2, (mx - mn) * 0.12);
    return { maxDays: md, minRet: mn - pad, maxRet: mx + pad };
  }, [plottedCurves]);

  const svgW = 960;
  const svgH = 260;
  const padL = 48;
  const padR = 24;
  const padT = 18;
  const padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const yForRet = (r: number) =>
    padT + ((maxRet - r) / Math.max(0.1, maxRet - minRet)) * plotH;
  const xForDay = (d: number) =>
    padL + (d / Math.max(1, maxDays - 1)) * plotW;

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 font-display">
            多推演方案对比矩阵
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            横向对比已保存推演方案的中位收益路径、回撤分位、胜率与沙盘期末净值
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToWorkbench}
          className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
        >
          返回行情推演台
        </button>
      </div>

      {scenarios.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-3">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            还没有保存的推演方案
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            在「行情推演」页面调整好阶段节奏、事件冲击或定投策略后，点击工作区工具栏的「保存方案」即可加入对比。
          </p>
          <button
            type="button"
            onClick={onGoToWorkbench}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
          >
            前往配置推演方案
          </button>
        </div>
      ) : (
        <>
          {/* Multi-Scenario P50 Return Overlay Chart */}
          <section className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                P50 中位收益率路径对比 (相对推演起点 %)
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                {plottedCurves.map((c) => (
                  <div key={c.scenario.id} className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-0.5 inline-block rounded"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {c.scenario.name} ({c.scenario.stockName})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-auto block"
              role="img"
              aria-label="多方案中位收益率对比折线图"
            >
              {/* Zero baseline */}
              <line
                x1={padL}
                x2={svgW - padR}
                y1={yForRet(0)}
                y2={yForRet(0)}
                className="stroke-slate-300 dark:stroke-slate-700"
                strokeDasharray="4 4"
              />

              {/* Horizontal ticks */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const val = minRet + (maxRet - minRet) * frac;
                const y = yForRet(val);
                return (
                  <g key={frac}>
                    <line
                      x1={padL}
                      x2={svgW - padR}
                      y1={y}
                      y2={y}
                      className="stroke-slate-100 dark:stroke-slate-800"
                    />
                    <text
                      x={padL - 6}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-slate-400 dark:fill-slate-500"
                      fontSize="10"
                      fontFamily="var(--font-mono)"
                    >
                      {val.toFixed(1)}%
                    </text>
                  </g>
                );
              })}

              {/* Scenario lines */}
              {plottedCurves.map((c) => {
                if (c.returns.length < 2) return null;
                const d = c.returns
                  .map((r, idx) => `${idx === 0 ? 'M' : 'L'} ${xForDay(idx).toFixed(1)} ${yForRet(r).toFixed(1)}`)
                  .join(' ');
                return (
                  <path
                    key={c.scenario.id}
                    d={d}
                    fill="none"
                    stroke={c.color}
                    strokeWidth={2}
                  />
                );
              })}

              <text
                x={padL}
                y={svgH - 8}
                className="fill-slate-400"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                T+0
              </text>
              <text
                x={svgW - padR}
                y={svgH - 8}
                textAnchor="end"
                className="fill-slate-400"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                T+{maxDays - 1} 交易日
              </text>
            </svg>
          </section>

          {/* Comparison Table */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">方案名称</th>
                    <th className="text-left font-medium px-4 py-2.5">标的</th>
                    <th className="text-right font-medium px-4 py-2.5">跨度</th>
                    <th className="text-right font-medium px-4 py-2.5">P10 悲观价</th>
                    <th className="text-right font-medium px-4 py-2.5">P50 中位价</th>
                    <th className="text-right font-medium px-4 py-2.5">P90 乐观价</th>
                    <th className="text-right font-medium px-4 py-2.5">中位收益率</th>
                    <th className="text-right font-medium px-4 py-2.5">正收益概率</th>
                    <th className="text-right font-medium px-4 py-2.5">中位最大回撤</th>
                    <th className="text-right font-medium px-4 py-2.5">沙盘期末净值</th>
                    <th className="text-right font-medium px-4 py-2.5">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {scenarios.map((sc) => {
                    const stock = stocks.find((s) => s.symbol === sc.symbol);
                    const currency = stock?.currency || 'CNY';
                    return (
                      <tr
                        key={sc.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                          <div>{sc.name}</div>
                          <div className="text-[11px] font-normal text-slate-400">
                            {sc.config.mode === 'scenario' ? '分段情景' : '蒙特卡洛'} ·{' '}
                            {sc.createdAt}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{sc.stockName}</div>
                          <div className="text-[11px] font-mono-num text-slate-500">{sc.symbol}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num">
                          {sc.config.horizonDays}日
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num">
                          {formatPrice(sc.summary.p10FinalPrice, currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num font-semibold text-blue-600 dark:text-blue-400">
                          {formatPrice(sc.summary.p50FinalPrice, currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num">
                          {formatPrice(sc.summary.p90FinalPrice, currency)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono-num font-semibold ${getTrendTextColor(
                            sc.summary.expectedReturnPct,
                            colorScheme,
                          )}`}
                        >
                          {formatSignedPct(sc.summary.expectedReturnPct)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num">
                          {sc.summary.winProbabilityPct}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num text-slate-600 dark:text-slate-300">
                          -{sc.summary.maxDrawdownP50Pct}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num font-semibold">
                          {formatMoney(sc.summary.finalEquity, currency)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onLoadScenario(sc)}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                            >
                              载入
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteScenario(sc.id)}
                              aria-label={`删除方案 ${sc.name}`}
                              className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
