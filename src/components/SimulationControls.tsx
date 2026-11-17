import { Plus, Shuffle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SCENARIO_TEMPLATES } from '../data/presets';
import type {
  ColorScheme,
  EventCategory,
  HoldingPosition,
  MarketEvent,
  ScenarioStage,
  ScheduledTrade,
  SimulationConfig,
  SimulationResult,
  TradeAction,
} from '../types/market';
import { formatMoney, formatPrice, formatSignedPct, getTrendTextColor } from '../utils/format';

interface SimulationControlsProps {
  currency: 'CNY' | 'HKD' | 'USD';
  currentPrice: number;
  position: HoldingPosition;
  config: SimulationConfig;
  simulation: SimulationResult;
  colorScheme: ColorScheme;
  onUpdateConfig: (next: SimulationConfig) => void;
  onUpdatePosition: (next: HoldingPosition) => void;
  onResample: () => void;
}

type ControlTab = 'regime' | 'events' | 'sandbox';

export function SimulationControls({
  currency,
  currentPrice,
  position,
  config,
  simulation,
  colorScheme,
  onUpdateConfig,
  onUpdatePosition,
  onResample,
}: SimulationControlsProps) {
  const [activeTab, setActiveTab] = useState<ControlTab>('regime');

  // New event form state
  const [evDay, setEvDay] = useState(15);
  const [evTitle, setEvTitle] = useState('业绩公告催化');
  const [evImpact, setEvImpact] = useState(4.0);
  const [evVolMult, setEvVolMult] = useState(1.4);
  const [evCategory, setEvCategory] = useState<EventCategory>('earnings');

  // New scheduled trade form state
  const [trDay, setTrDay] = useState(10);
  const [trAction, setTrAction] = useState<TradeAction>('BUY');
  const [trMode, setTrMode] = useState<'SHARES' | 'AMOUNT'>('SHARES');
  const [trValue, setTrValue] = useState(100);
  const [trNote, setTrNote] = useState('逢低加仓');

  const applyTemplate = (templateId: string) => {
    const tpl = SCENARIO_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    onUpdateConfig({
      ...config,
      mode: tpl.config.mode ?? config.mode,
      horizonDays: tpl.config.horizonDays ?? config.horizonDays,
      annualDriftPct: tpl.config.annualDriftPct ?? config.annualDriftPct,
      annualVolPct: tpl.config.annualVolPct ?? config.annualVolPct,
      meanReversion: tpl.config.meanReversion ?? config.meanReversion,
      mcPaths: tpl.config.mcPaths ?? config.mcPaths,
      stages: tpl.config.stages ? tpl.config.stages.map((s) => ({ ...s })) : config.stages,
      events: tpl.config.events ? tpl.config.events.map((e) => ({ ...e })) : [],
    });
  };

  const updateStage = (id: string, patch: Partial<ScenarioStage>) => {
    onUpdateConfig({
      ...config,
      stages: config.stages.map((st) => (st.id === id ? { ...st, ...patch } : st)),
    });
  };

  const addStage = () => {
    const newStage: ScenarioStage = {
      id: `stage-${Date.now()}`,
      name: `阶段 ${config.stages.length + 1}`,
      days: 20,
      annualDriftPct: 10,
      annualVolPct: 26,
      meanReversion: 0.4,
    };
    onUpdateConfig({ ...config, stages: [...config.stages, newStage] });
  };

  const removeStage = (id: string) => {
    if (config.stages.length <= 1) return;
    onUpdateConfig({ ...config, stages: config.stages.filter((s) => s.id !== id) });
  };

  const addEvent = () => {
    if (!evTitle.trim()) return;
    const ev: MarketEvent = {
      id: `ev-${Date.now()}`,
      dayOffset: Math.max(1, Math.min(config.horizonDays, evDay)),
      title: evTitle.trim(),
      impactPct: evImpact,
      volMultiplier: evVolMult,
      category: evCategory,
      enabled: true,
    };
    onUpdateConfig({ ...config, events: [...config.events, ev] });
  };

  const toggleEvent = (id: string) => {
    onUpdateConfig({
      ...config,
      events: config.events.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)),
    });
  };

  const removeEvent = (id: string) => {
    onUpdateConfig({ ...config, events: config.events.filter((e) => e.id !== id) });
  };

  const addTrade = () => {
    if (trValue <= 0) return;
    const trade: ScheduledTrade = {
      id: `tr-${Date.now()}`,
      dayOffset: Math.max(1, Math.min(config.horizonDays, trDay)),
      action: trAction,
      mode: trMode,
      value: trValue,
      note: trNote.trim() || (trAction === 'BUY' ? '计划买入' : '计划卖出'),
      enabled: true,
    };
    onUpdateConfig({ ...config, scheduledTrades: [...config.scheduledTrades, trade] });
  };

  const removeTrade = (id: string) => {
    onUpdateConfig({
      ...config,
      scheduledTrades: config.scheduledTrades.filter((t) => t.id !== id),
    });
  };

  const tabs: Array<{ id: ControlTab; label: string }> = [
    { id: 'regime', label: '情景与参数' },
    { id: 'events', label: `事件冲击 (${config.events.filter((e) => e.enabled).length})` },
    { id: 'sandbox', label: '持仓与沙盘' },
  ];

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Panel Header with Segmented Tabs */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => onUpdateConfig({ ...config, mode: 'scenario' })}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                config.mode === 'scenario'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              分段情景
            </button>
            <button
              type="button"
              onClick={() => onUpdateConfig({ ...config, mode: 'montecarlo' })}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                config.mode === 'montecarlo'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              蒙特卡洛
            </button>
          </div>

          <button
            type="button"
            onClick={onResample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>重新采样路径</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Regime & Parameters */}
      {activeTab === 'regime' && (
        <div className="p-4 lg:p-5 grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left: Presets & Global Horizon */}
          <div className="xl:col-span-4 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                快速推演模板
              </h3>
              <div className="space-y-1.5">
                {SCENARIO_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl.id)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {tpl.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {tpl.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">推演交易日跨度</span>
                <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                  {config.horizonDays} 交易日
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={240}
                step={5}
                value={config.horizonDays}
                onChange={(e) =>
                  onUpdateConfig({ ...config, horizonDays: Number(e.target.value) })
                }
                aria-label="推演交易日跨度"
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex items-center gap-1.5">
                {[20, 60, 120, 240].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onUpdateConfig({ ...config, horizonDays: d })}
                    className={`flex-1 py-1 text-xs font-mono-num rounded border transition-colors cursor-pointer ${
                      config.horizonDays === d
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {d}日
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Either Multi-Stage Builder or Monte Carlo Parameters */}
          <div className="xl:col-span-8">
            {config.mode === 'scenario' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      多阶段行情节奏编排
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      按时间顺序设置不同市场阶段的年化漂移率、波动率与均值回归强度
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addStage}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>新增阶段</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">阶段名称</th>
                        <th className="text-right font-medium px-3 py-2">持续天数</th>
                        <th className="text-right font-medium px-3 py-2">年化漂移率 (%)</th>
                        <th className="text-right font-medium px-3 py-2">年化波动率 (%)</th>
                        <th className="text-right font-medium px-3 py-2">均值回归</th>
                        <th className="text-right font-medium px-3 py-2 w-12">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {config.stages.map((st, idx) => (
                        <tr key={st.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono-num text-slate-400">
                                0{idx + 1}
                              </span>
                              <input
                                type="text"
                                value={st.name}
                                onChange={(e) => updateStage(st.id, { name: e.target.value })}
                                className="w-28 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={5}
                              max={240}
                              value={st.days}
                              onChange={(e) =>
                                updateStage(st.id, { days: Math.max(1, Number(e.target.value)) })
                              }
                              className="w-16 px-2 py-1 text-xs text-right font-mono-num rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={-80}
                              max={120}
                              step={2}
                              value={st.annualDriftPct}
                              onChange={(e) =>
                                updateStage(st.id, { annualDriftPct: Number(e.target.value) })
                              }
                              className="w-18 px-2 py-1 text-xs text-right font-mono-num rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={5}
                              max={120}
                              step={2}
                              value={st.annualVolPct}
                              onChange={(e) =>
                                updateStage(st.id, {
                                  annualVolPct: Math.max(2, Number(e.target.value)),
                                })
                              }
                              className="w-18 px-2 py-1 text-xs text-right font-mono-num rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              max={5}
                              step={0.1}
                              value={st.meanReversion}
                              onChange={(e) =>
                                updateStage(st.id, {
                                  meanReversion: Math.max(0, Number(e.target.value)),
                                })
                              }
                              className="w-16 px-2 py-1 text-xs text-right font-mono-num rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              disabled={config.stages.length <= 1}
                              onClick={() => removeStage(st.id)}
                              aria-label="删除阶段"
                              className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-slate-500 dark:text-slate-400">蒙特卡洛采样</div>
                    <div className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {config.mcPaths} 条分布路径
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-slate-500 dark:text-slate-400">期末 P10 悲观价</div>
                    <div className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatPrice(simulation.summary.p10FinalPrice, currency)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-slate-500 dark:text-slate-400">期末 P50 中位价</div>
                    <div className="font-mono-num font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                      {formatPrice(simulation.summary.p50FinalPrice, currency)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-slate-500 dark:text-slate-400">期末 P90 乐观价</div>
                    <div className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatPrice(simulation.summary.p90FinalPrice, currency)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    蒙特卡洛随机过程参数 (GBM + 均值回归)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    通过调整漂移率、波动率与路径样本数，计算未来价格分布锥与胜率区间
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-300">预期年化漂移率 (μ)</span>
                      <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                        {formatSignedPct(config.annualDriftPct)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-40}
                      max={60}
                      step={1}
                      value={config.annualDriftPct}
                      onChange={(e) =>
                        onUpdateConfig({ ...config, annualDriftPct: Number(e.target.value) })
                      }
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-300">年化波动率 (σ)</span>
                      <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                        {config.annualVolPct.toFixed(1)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={80}
                      step={1}
                      value={config.annualVolPct}
                      onChange={(e) =>
                        onUpdateConfig({ ...config, annualVolPct: Number(e.target.value) })
                      }
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-300">均值回归系数 (κ)</span>
                      <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                        {config.meanReversion.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={config.meanReversion}
                      onChange={(e) =>
                        onUpdateConfig({ ...config, meanReversion: Number(e.target.value) })
                      }
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-300">模拟路径数量</span>
                      <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                        {config.mcPaths} 条
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {[100, 300, 500, 800].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => onUpdateConfig({ ...config, mcPaths: n })}
                          className={`flex-1 py-1 text-xs font-mono-num rounded border transition-colors cursor-pointer ${
                            config.mcPaths === n
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-slate-500 dark:text-slate-400">期末正收益概率</div>
                    <div className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {simulation.summary.winProbabilityPct}%
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-slate-500 dark:text-slate-400">中位最大回撤</div>
                    <div className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      -{simulation.summary.maxDrawdownP50Pct}%
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-slate-500 dark:text-slate-400">90分位极端回撤</div>
                    <div className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      -{simulation.summary.maxDrawdownP90Pct}%
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-slate-500 dark:text-slate-400">触及止盈/止损概率</div>
                    <div className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {simulation.summary.hitTakeProfitPct}% / {simulation.summary.hitStopLossPct}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Catalyst Event Shocks */}
      {activeTab === 'events' && (
        <div className="p-4 lg:p-5 grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-5 space-y-3 border-b xl:border-b-0 xl:border-r border-slate-100 dark:border-slate-800 pb-4 xl:pb-0 xl:pr-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              添加未来事件冲击节点
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">发生日期 (T+交易日)</span>
                <input
                  type="number"
                  min={1}
                  max={config.horizonDays}
                  value={evDay}
                  onChange={(e) => setEvDay(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">事件类型</span>
                <select
                  value={evCategory}
                  onChange={(e) => setEvCategory(e.target.value as EventCategory)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="earnings">财报业绩</option>
                  <option value="macro">宏观利率</option>
                  <option value="policy">行业政策</option>
                  <option value="capital">回购分红/减持</option>
                  <option value="risk">突发风险</option>
                </select>
              </label>
              <label className="col-span-2 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">事件名称</span>
                <input
                  type="text"
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  placeholder="例如：Q4业绩发布 / 降息落地 / 大宗减持"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">价格跳空冲击 (%)</span>
                <input
                  type="number"
                  step={0.5}
                  min={-30}
                  max={30}
                  value={evImpact}
                  onChange={(e) => setEvImpact(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">短期波动放大倍数</span>
                <input
                  type="number"
                  step={0.1}
                  min={0.5}
                  max={3.0}
                  value={evVolMult}
                  onChange={(e) => setEvVolMult(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={addEvent}
              className="w-full py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
            >
              加入推演时间轴
            </button>
          </div>

          <div className="xl:col-span-7 space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              已配置催化事件 ({config.events.length})
            </h3>
            {config.events.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                当前未设置事件冲击，行情将完全按阶段漂移与波动率自由演化。
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                {config.events
                  .slice()
                  .sort((a, b) => a.dayOffset - b.dayOffset)
                  .map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={ev.enabled}
                          onChange={() => toggleEvent(ev.id)}
                          aria-label={`启用事件 ${ev.title}`}
                          className="rounded accent-blue-600 cursor-pointer"
                        />
                        <span className="font-mono-num font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                          T+{ev.dayOffset}
                        </span>
                        <span
                          className={`font-medium truncate ${
                            ev.enabled
                              ? 'text-slate-900 dark:text-slate-100'
                              : 'text-slate-400 line-through'
                          }`}
                        >
                          {ev.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 font-mono-num">
                        <span className={`font-semibold ${getTrendTextColor(ev.impactPct, colorScheme)}`}>
                          {formatSignedPct(ev.impactPct)}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          波动×{ev.volMultiplier.toFixed(1)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeEvent(ev.id)}
                          aria-label="删除事件"
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Position & Sandbox Orders */}
      {activeTab === 'sandbox' && (
        <div className="p-4 lg:p-5 grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Position & Stop/Take-Profit */}
          <div className="xl:col-span-5 space-y-4 border-b xl:border-b-0 xl:border-r border-slate-100 dark:border-slate-800 pb-4 xl:pb-0 xl:pr-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                个人持仓与风控线设置
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                修改当前持仓与止盈止损线，图表参考线及推演盈亏将同步重算
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">当前持仓股数</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={position.shares}
                  onChange={(e) =>
                    onUpdatePosition({ ...position, shares: Math.max(0, Number(e.target.value)) })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">持仓平均成本价</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={position.avgCost}
                  onChange={(e) =>
                    onUpdatePosition({ ...position, avgCost: Math.max(0, Number(e.target.value)) })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">可用备用金</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={position.cashReserve}
                  onChange={(e) =>
                    onUpdatePosition({
                      ...position,
                      cashReserve: Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <div className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">现价参考</span>
                <div className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800/60 font-mono-num font-medium">
                  {formatPrice(currentPrice, currency)}
                </div>
              </div>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">止盈目标价</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={position.takeProfitPrice ?? ''}
                  placeholder="不设"
                  onChange={(e) =>
                    onUpdatePosition({
                      ...position,
                      takeProfitPrice: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">止损防守价</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={position.stopLossPrice ?? ''}
                  placeholder="不设"
                  onChange={(e) =>
                    onUpdatePosition({
                      ...position,
                      stopLossPrice: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">触及止盈卖出比例</span>
                <select
                  value={config.autoTakeProfitSellPct}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, autoTakeProfitSellPct: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value={0}>仅提示不自动卖出</option>
                  <option value={30}>减仓 30%</option>
                  <option value={50}>减仓 50%</option>
                  <option value={100}>全部清仓 (100%)</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">触及止损卖出比例</span>
                <select
                  value={config.autoStopLossSellPct}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, autoStopLossSellPct: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value={0}>仅提示不自动卖出</option>
                  <option value={50}>减仓 50%</option>
                  <option value={100}>全部止损 (100%)</option>
                </select>
              </label>
            </div>

            {/* DCA Periodic Auto-Buy */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.dcaEnabled}
                  onChange={(e) => onUpdateConfig({ ...config, dcaEnabled: e.target.checked })}
                  className="rounded accent-blue-600"
                />
                <span>开启沙盘定期定额买入 (DCA 摊薄测试)</span>
              </label>
              {config.dcaEnabled && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="space-y-1">
                    <span className="text-slate-500 dark:text-slate-400 block">定投周期 (交易日)</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={config.dcaIntervalDays}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          dcaIntervalDays: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-slate-500 dark:text-slate-400 block">单次定投金额</span>
                    <input
                      type="number"
                      min={100}
                      step={500}
                      value={config.dcaAmount}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          dcaAmount: Math.max(100, Number(e.target.value)),
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Right: Scheduled Trades & Execution Ledger */}
          <div className="xl:col-span-7 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                计划加减仓指令与沙盘成交流水
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                模拟在未来指定交易日执行加减仓，观察对总资产与成本线的动态影响
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs items-end">
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">T+交易日</span>
                <input
                  type="number"
                  min={1}
                  max={config.horizonDays}
                  value={trDay}
                  onChange={(e) => setTrDay(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">方向</span>
                <select
                  value={trAction}
                  onChange={(e) => setTrAction(e.target.value as TradeAction)}
                  className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="BUY">买入</option>
                  <option value="SELL">卖出</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">方式</span>
                <select
                  value={trMode}
                  onChange={(e) => setTrMode(e.target.value as 'SHARES' | 'AMOUNT')}
                  className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="SHARES">按股数</option>
                  <option value="AMOUNT">按金额</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">数量/金额</span>
                <input
                  type="number"
                  min={1}
                  value={trValue}
                  onChange={(e) => setTrValue(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block">备注</span>
                <input
                  type="text"
                  value={trNote}
                  onChange={(e) => setTrNote(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </label>
              <button
                type="button"
                onClick={addTrade}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                添加指令
              </button>
            </div>

            {config.scheduledTrades.length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                {config.scheduledTrades.map((tr) => (
                  <div key={tr.id} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono-num font-semibold text-slate-600 dark:text-slate-300">
                        T+{tr.dayOffset}
                      </span>
                      <span
                        className={`font-semibold ${
                          tr.action === 'BUY'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {tr.action === 'BUY' ? '计划买入' : '计划卖出'}
                      </span>
                      <span className="font-mono-num">
                        {tr.value} {tr.mode === 'SHARES' ? '股' : currency}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{tr.note}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTrade(tr.id)}
                      aria-label="删除指令"
                      className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Simulated Execution Ledger */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  沙盘推演成交记录 ({simulation.allExecutions.length} 笔)
                </span>
                <span className="font-mono-num text-slate-500 dark:text-slate-400">
                  期末持仓 {simulation.summary.finalShares} 股 · 剩余现金{' '}
                  {formatMoney(simulation.summary.finalCash, currency)}
                </span>
              </div>
              {simulation.allExecutions.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                  当前路径未触发计划交易、定投或止盈止损条件。
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium">日期</th>
                        <th className="text-left px-3 py-1.5 font-medium">方向</th>
                        <th className="text-right px-3 py-1.5 font-medium">股数</th>
                        <th className="text-right px-3 py-1.5 font-medium">成交价</th>
                        <th className="text-right px-3 py-1.5 font-medium">金额</th>
                        <th className="text-left px-3 py-1.5 font-medium">触发原因</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono-num">
                      {simulation.allExecutions.map((ex, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">
                            {ex.date} (T+{ex.dayIndex})
                          </td>
                          <td
                            className={`px-3 py-1.5 font-semibold ${
                              ex.action === 'BUY'
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {ex.action === 'BUY' ? '买入' : '卖出'}
                          </td>
                          <td className="px-3 py-1.5 text-right">{ex.shares}</td>
                          <td className="px-3 py-1.5 text-right">{ex.price.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right">
                            {formatMoney(ex.amount, currency)}
                          </td>
                          <td className="px-3 py-1.5 font-sans text-slate-500 dark:text-slate-400">
                            {ex.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
