import { useMemo, useRef, useState } from 'react';
import type {
  ColorScheme,
  HoldingPosition,
  OhlcBar,
  ProjectedPoint,
  SimulationResult,
} from '../types/market';
import { formatMoney, formatPrice, formatSignedPct, formatVolume, getTrendHexColors, getTrendTextColor } from '../utils/format';

interface MarketChartProps {
  currency: 'CNY' | 'HKD' | 'USD';
  bars: OhlcBar[];
  position: HoldingPosition;
  simulation: SimulationResult;
  playbackDay: number;
  colorScheme: ColorScheme;
  chartType: 'candle' | 'line';
  showMA: boolean;
  showCone: boolean;
  showSamplePaths: boolean;
  historyWindow: 30 | 60 | 90;
}

interface ChartSlot {
  kind: 'history' | 'projection';
  index: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  volume: number;
  proj?: ProjectedPoint;
  visibleCandle: boolean;
}

function computeSMA(values: number[], period: number): Array<number | null> {
  return values.map((_, idx) => {
    if (idx < period - 1) return null;
    let sum = 0;
    for (let j = idx - period + 1; j <= idx; j += 1) {
      sum += values[j];
    }
    return sum / period;
  });
}

export function MarketChart({
  currency,
  bars,
  position,
  simulation,
  playbackDay,
  colorScheme,
  chartType,
  showMA,
  showCone,
  showSamplePaths,
  historyWindow,
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const histBars = useMemo(() => bars.slice(-historyWindow), [bars, historyWindow]);
  const trendColors = useMemo(() => getTrendHexColors(colorScheme), [colorScheme]);

  const slots: ChartSlot[] = useMemo(() => {
    const list: ChartSlot[] = [];
    for (let i = 0; i < histBars.length; i += 1) {
      const b = histBars[i];
      const prev = i > 0 ? histBars[i - 1].close : b.open;
      list.push({
        kind: 'history',
        index: i,
        date: b.date,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        prevClose: prev,
        volume: b.volume,
        visibleCandle: true,
      });
    }

    const lastHistClose = histBars.length > 0 ? histBars[histBars.length - 1].close : 100;
    for (let i = 0; i < simulation.points.length; i += 1) {
      const pt = simulation.points[i];
      const prev = i === 0 ? lastHistClose : simulation.points[i - 1].activeClose;
      list.push({
        kind: 'projection',
        index: histBars.length + i,
        date: pt.date,
        open: pt.activeOpen,
        high: pt.activeHigh,
        low: pt.activeLow,
        close: pt.activeClose,
        prevClose: prev,
        volume: pt.activeVolume,
        proj: pt,
        visibleCandle: pt.dayIndex <= playbackDay,
      });
    }
    return list;
  }, [histBars, simulation.points, playbackDay]);

  // Moving averages computed across history + visible simulated candles
  const { ma5, ma20 } = useMemo(() => {
    const closes = slots.map((s) => s.close);
    return {
      ma5: computeSMA(closes, 5),
      ma20: computeSMA(closes, 20),
    };
  }, [slots]);

  // Compute min/max price range including cone, active bars, and target lines
  const { minPrice, maxPrice, maxVol } = useMemo(() => {
    let minP = Infinity;
    let maxP = -Infinity;
    let maxV = 1;

    for (const s of slots) {
      if (s.kind === 'history' || s.visibleCandle) {
        if (s.low < minP) minP = s.low;
        if (s.high > maxP) maxP = s.high;
        if (s.volume > maxV) maxV = s.volume;
      }
      if (s.proj && showCone) {
        if (s.proj.p10 < minP) minP = s.proj.p10;
        if (s.proj.p90 > maxP) maxP = s.proj.p90;
      }
    }

    if (position.avgCost > 0 && position.shares > 0) {
      minP = Math.min(minP, position.avgCost);
      maxP = Math.max(maxP, position.avgCost);
    }
    if (position.takeProfitPrice && position.takeProfitPrice > 0) {
      maxP = Math.max(maxP, position.takeProfitPrice);
    }
    if (position.stopLossPrice && position.stopLossPrice > 0) {
      minP = Math.min(minP, position.stopLossPrice);
    }

    if (!Number.isFinite(minP) || !Number.isFinite(maxP) || minP === maxP) {
      minP = 90;
      maxP = 110;
    }

    const pad = (maxP - minP) * 0.08;
    return {
      minPrice: Math.max(0.01, minP - pad),
      maxPrice: maxP + pad,
      maxVol: maxV,
    };
  }, [slots, showCone, position]);

  // SVG coordinate dimensions
  const width = 1040;
  const height = 430;
  const padLeft = 14;
  const padRight = 72;
  const padTop = 20;
  const priceHeight = 290;
  const volTop = 328;
  const volHeight = 70;
  const plotWidth = width - padLeft - padRight;

  const totalSlots = Math.max(1, slots.length);
  const stepX = plotWidth / totalSlots;
  const candleW = Math.max(2, Math.min(9, stepX * 0.64));

  const xForIdx = (i: number) => padLeft + (i + 0.5) * stepX;
  const yForPrice = (p: number) =>
    padTop + ((maxPrice - p) / Math.max(0.0001, maxPrice - minPrice)) * priceHeight;
  const yForVol = (v: number) =>
    volTop + volHeight - (v / Math.max(1, maxVol)) * volHeight;

  const boundaryIdx = histBars.length;
  const boundaryX = boundaryIdx < totalSlots ? padLeft + boundaryIdx * stepX : width - padRight;

  // Build SVG paths for Cone & MA & Line
  const projStartIdx = histBars.length;
  const lastHistSlot = histBars.length > 0 ? slots[histBars.length - 1] : null;

  const { p10_90Path, p25_75Path, p50Path } = useMemo(() => {
    if (simulation.points.length === 0 || !lastHistSlot) {
      return { p10_90Path: '', p25_75Path: '', p50Path: '' };
    }
    const anchorX = xForIdx(histBars.length - 1);
    const anchorY = yForPrice(lastHistSlot.close);

    const upper90 = [`${anchorX.toFixed(1)},${anchorY.toFixed(1)}`];
    const lower10: string[] = [];
    const upper75 = [`${anchorX.toFixed(1)},${anchorY.toFixed(1)}`];
    const lower25: string[] = [];
    const medianPts = [`M ${anchorX.toFixed(1)} ${anchorY.toFixed(1)}`];

    for (let i = 0; i < simulation.points.length; i += 1) {
      const pt = simulation.points[i];
      const cx = xForIdx(projStartIdx + i).toFixed(1);
      upper90.push(`${cx},${yForPrice(pt.p90).toFixed(1)}`);
      lower10.unshift(`${cx},${yForPrice(pt.p10).toFixed(1)}`);
      upper75.push(`${cx},${yForPrice(pt.p75).toFixed(1)}`);
      lower25.unshift(`${cx},${yForPrice(pt.p25).toFixed(1)}`);
      medianPts.push(`L ${cx} ${yForPrice(pt.p50).toFixed(1)}`);
    }

    return {
      p10_90Path: `M ${upper90.join(' L ')} L ${lower10.join(' L ')} Z`,
      p25_75Path: `M ${upper75.join(' L ')} L ${lower25.join(' L ')} Z`,
      p50Path: medianPts.join(' '),
    };
  }, [simulation.points, lastHistSlot, histBars.length, projStartIdx, minPrice, maxPrice, stepX]);

  const buildLinePath = (vals: Array<number | null>, maxVisibleIdx: number) => {
    let d = '';
    let started = false;
    for (let i = 0; i <= maxVisibleIdx && i < vals.length; i += 1) {
      const v = vals[i];
      if (v == null) continue;
      const x = xForIdx(i).toFixed(1);
      const y = yForPrice(v).toFixed(1);
      d += started ? ` L ${x} ${y}` : `M ${x} ${y}`;
      started = true;
    }
    return d;
  };

  const maxVisibleIdx = histBars.length + playbackDay - 1;
  const closeLinePath = useMemo(() => {
    const closes = slots.map((s) => (s.visibleCandle ? s.close : null));
    return buildLinePath(closes, maxVisibleIdx);
  }, [slots, maxVisibleIdx, minPrice, maxPrice, stepX]);

  const ma5Path = useMemo(
    () => (showMA ? buildLinePath(ma5, maxVisibleIdx) : ''),
    [ma5, showMA, maxVisibleIdx, minPrice, maxPrice, stepX],
  );
  const ma20Path = useMemo(
    () => (showMA ? buildLinePath(ma20, maxVisibleIdx) : ''),
    [ma20, showMA, maxVisibleIdx, minPrice, maxPrice, stepX],
  );

  // Price grid lines (5 levels)
  const priceTicks = useMemo(() => {
    const count = 5;
    const arr: number[] = [];
    for (let i = 0; i < count; i += 1) {
      arr.push(minPrice + ((maxPrice - minPrice) * i) / (count - 1));
    }
    return arr;
  }, [minPrice, maxPrice]);

  // Date ticks (~6 evenly spaced labels)
  const dateTickIndices = useMemo(() => {
    const step = Math.max(1, Math.floor(totalSlots / 6));
    const indices: number[] = [];
    for (let i = 0; i < totalSlots; i += step) {
      indices.push(i);
    }
    return indices;
  }, [totalSlots]);

  const activeHoverSlot =
    hoverIdx !== null && hoverIdx >= 0 && hoverIdx < slots.length
      ? slots[hoverIdx]
      : slots[Math.min(slots.length - 1, Math.max(0, maxVisibleIdx))];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.floor((svgX - padLeft) / stepX);
    if (idx >= 0 && idx < slots.length) {
      setHoverIdx(idx);
    } else {
      setHoverIdx(null);
    }
  };

  const renderRefLine = (price: number | null, label: string, stroke: string) => {
    if (price == null || price <= 0) return null;
    const y = yForPrice(price);
    if (y < padTop - 4 || y > padTop + priceHeight + 4) return null;
    return (
      <g key={label}>
        <line
          x1={padLeft}
          x2={width - padRight}
          y1={y}
          y2={y}
          stroke={stroke}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <rect
          x={width - padRight + 4}
          y={y - 9}
          width={64}
          height={18}
          rx={3}
          fill={stroke}
          fillOpacity={0.14}
        />
        <text
          x={width - padRight + 8}
          y={y + 4}
          fill={stroke}
          fontSize="10"
          fontFamily="var(--font-mono)"
          fontWeight={600}
        >
          {label} {price.toFixed(1)}
        </text>
      </g>
    );
  };

  const hoverDelta = activeHoverSlot ? activeHoverSlot.close - activeHoverSlot.prevClose : 0;
  const hoverPct =
    activeHoverSlot && activeHoverSlot.prevClose > 0
      ? (hoverDelta / activeHoverSlot.prevClose) * 100
      : 0;

  return (
    <div ref={containerRef} className="w-full select-none">
      {/* Live Crosshair Telemetry Strip */}
      {activeHoverSlot && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 border-b border-slate-100 dark:border-slate-800/80 text-xs bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-num">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {activeHoverSlot.date}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {activeHoverSlot.kind === 'history'
                ? '历史实盘'
                : `推演 T+${activeHoverSlot.proj?.dayIndex} · ${activeHoverSlot.proj?.stageName}`}
            </span>
            {(activeHoverSlot.kind === 'history' || activeHoverSlot.visibleCandle) && (
              <>
                <span className="text-slate-500 dark:text-slate-400">
                  开 <strong className="text-slate-800 dark:text-slate-100">{activeHoverSlot.open.toFixed(2)}</strong>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  高 <strong className="text-slate-800 dark:text-slate-100">{activeHoverSlot.high.toFixed(2)}</strong>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  低 <strong className="text-slate-800 dark:text-slate-100">{activeHoverSlot.low.toFixed(2)}</strong>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  收 <strong className="text-slate-800 dark:text-slate-100">{activeHoverSlot.close.toFixed(2)}</strong>
                </span>
                <span className={`font-semibold ${getTrendTextColor(hoverDelta, colorScheme)}`}>
                  {formatSignedPct(hoverPct)}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  量 {formatVolume(activeHoverSlot.volume)}
                </span>
              </>
            )}
          </div>

          {activeHoverSlot.proj && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono-num">
              <span className="text-blue-600 dark:text-blue-400">
                P10–P90: {formatPrice(activeHoverSlot.proj.p10, currency)} ~{' '}
                {formatPrice(activeHoverSlot.proj.p90, currency)}
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                中位: {formatPrice(activeHoverSlot.proj.p50, currency)}
              </span>
              {activeHoverSlot.visibleCandle && (
                <span className="text-slate-700 dark:text-slate-200">
                  推演总资产: {formatMoney(activeHoverSlot.proj.totalEquity, currency)} (
                  <span className={getTrendTextColor(activeHoverSlot.proj.totalPnl, colorScheme)}>
                    {formatSignedPct(activeHoverSlot.proj.totalReturnPct)}
                  </span>
                  )
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main SVG Canvas */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          role="img"
          aria-label="股票历史K线与未来推演概率走势图"
        >
          {/* Projection region subtle tint */}
          {boundaryIdx < totalSlots && (
            <rect
              x={boundaryX}
              y={padTop}
              width={width - padRight - boundaryX}
              height={volTop + volHeight - padTop}
              className="fill-blue-500/[0.03] dark:fill-blue-400/[0.04]"
            />
          )}

          {/* Horizontal Price Grid Lines */}
          {priceTicks.map((tick, idx) => {
            const y = yForPrice(tick);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  className="stroke-slate-200/80 dark:stroke-slate-800"
                  strokeWidth={1}
                />
                <text
                  x={width - padRight + 6}
                  y={y + 4}
                  className="fill-slate-500 dark:fill-slate-400"
                  fontSize="10.5"
                  fontFamily="var(--font-mono)"
                >
                  {tick.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Separator line between price & volume */}
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={volTop - 8}
            y2={volTop - 8}
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth={1}
          />

          {/* Boundary line: Historical vs Projection */}
          {boundaryIdx < totalSlots && (
            <g>
              <line
                x1={boundaryX}
                x2={boundaryX}
                y1={padTop}
                y2={volTop + volHeight}
                className="stroke-blue-500/50 dark:stroke-blue-400/50"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={boundaryX + 6}
                y={padTop + 12}
                className="fill-blue-600 dark:fill-blue-400"
                fontSize="10.5"
                fontWeight={600}
              >
                推演区间 →
              </text>
            </g>
          )}

          {/* Monte Carlo Sample Paths */}
          {showSamplePaths &&
            lastHistSlot &&
            simulation.samplePaths.slice(1).map((path, pIdx) => {
              const anchorX = xForIdx(histBars.length - 1);
              const anchorY = yForPrice(lastHistSlot.close);
              let d = `M ${anchorX.toFixed(1)} ${anchorY.toFixed(1)}`;
              for (let t = 0; t < path.length; t += 1) {
                d += ` L ${xForIdx(projStartIdx + t).toFixed(1)} ${yForPrice(path[t]).toFixed(1)}`;
              }
              return (
                <path
                  key={pIdx}
                  d={d}
                  fill="none"
                  className="stroke-slate-400/25 dark:stroke-slate-500/25"
                  strokeWidth={1}
                />
              );
            })}

          {/* Monte Carlo Confidence Bands */}
          {showCone && p10_90Path && (
            <path d={p10_90Path} className="fill-blue-500/10 dark:fill-blue-400/12" />
          )}
          {showCone && p25_75Path && (
            <path d={p25_75Path} className="fill-blue-500/15 dark:fill-blue-400/18" />
          )}
          {showCone && p50Path && (
            <path
              d={p50Path}
              fill="none"
              stroke="#2563EB"
              strokeWidth={1.6}
              strokeDasharray="5 3"
              opacity={0.85}
            />
          )}

          {/* Position & Target Reference Lines */}
          {position.shares > 0 && renderRefLine(position.avgCost, '成本', '#d97706')}
          {renderRefLine(position.takeProfitPrice, '止盈', trendColors.up)}
          {renderRefLine(position.stopLossPrice, '止损', trendColors.down)}

          {/* Moving Averages */}
          {showMA && ma5Path && (
            <path d={ma5Path} fill="none" stroke="#f59e0b" strokeWidth={1.2} opacity={0.85} />
          )}
          {showMA && ma20Path && (
            <path d={ma20Path} fill="none" stroke="#8b5cf6" strokeWidth={1.2} opacity={0.85} />
          )}

          {/* Candlesticks or Close Line + Volume Bars */}
          {chartType === 'line' && closeLinePath && (
            <path
              d={closeLinePath}
              fill="none"
              className="stroke-slate-900 dark:stroke-slate-100"
              strokeWidth={1.8}
            />
          )}

          {slots.map((s) => {
            if (!s.visibleCandle) return null;
            const cx = xForIdx(s.index);
            const isUp = s.close >= s.open;
            const color = isUp ? trendColors.up : trendColors.down;
            const volColor = isUp ? trendColors.upSoft : trendColors.downSoft;
            const isProj = s.kind === 'projection';

            const yHigh = yForPrice(s.high);
            const yLow = yForPrice(s.low);
            const yOpen = yForPrice(s.open);
            const yClose = yForPrice(s.close);
            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(1.5, Math.abs(yOpen - yClose));

            const vy = yForVol(s.volume);
            const vh = Math.max(1, volTop + volHeight - vy);

            return (
              <g key={s.index} opacity={isProj ? 0.92 : 1}>
                {chartType === 'candle' && (
                  <>
                    <line
                      x1={cx}
                      x2={cx}
                      y1={yHigh}
                      y2={yLow}
                      stroke={color}
                      strokeWidth={1}
                    />
                    <rect
                      x={cx - candleW / 2}
                      y={bodyTop}
                      width={candleW}
                      height={bodyHeight}
                      fill={color}
                      fillOpacity={isProj ? 0.8 : 1}
                      rx={0.5}
                    />
                  </>
                )}

                {/* Volume bar */}
                <rect
                  x={cx - candleW / 2}
                  y={vy}
                  width={candleW}
                  height={vh}
                  fill={volColor}
                />
              </g>
            );
          })}

          {/* Event & Trade Execution Markers on Projection Horizon */}
          {slots.map((s) => {
            if (!s.proj) return null;
            const cx = xForIdx(s.index);
            const hasEvent = s.proj.eventsTriggered.length > 0;
            const hasTrade = s.visibleCandle && s.proj.tradesTriggered.length > 0;
            if (!hasEvent && !hasTrade) return null;

            const anchorY = s.visibleCandle ? yForPrice(s.high) : yForPrice(s.proj.p50);

            return (
              <g key={`marker-${s.index}`}>
                {hasEvent && (
                  <g transform={`translate(${cx}, ${Math.max(padTop + 10, anchorY - 16)})`}>
                    <circle r={7} fill="#0284c7" />
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight={700}
                    >
                      事
                    </text>
                  </g>
                )}
                {hasTrade &&
                  s.proj.tradesTriggered.map((tr, tIdx) => {
                    const isBuy = tr.action === 'BUY';
                    const offsetY = hasEvent ? -32 - tIdx * 16 : -16 - tIdx * 16;
                    const yPos = Math.max(padTop + 10, yForPrice(s.low) + 18 + tIdx * 16);
                    return (
                      <g
                        key={`tr-${tIdx}`}
                        transform={`translate(${cx}, ${isBuy ? Math.min(volTop - 18, yPos) : Math.max(padTop + 10, anchorY + offsetY)})`}
                      >
                        <rect
                          x={-7}
                          y={-7}
                          width={14}
                          height={14}
                          rx={3}
                          fill={isBuy ? '#2563eb' : '#d97706'}
                        />
                        <text
                          textAnchor="middle"
                          dy="3.5"
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight={700}
                        >
                          {isBuy ? '买' : '卖'}
                        </text>
                      </g>
                    );
                  })}
              </g>
            );
          })}

          {/* Date X-Axis Labels */}
          {dateTickIndices.map((idx) => {
            const s = slots[idx];
            if (!s) return null;
            const cx = xForIdx(idx);
            return (
              <text
                key={`dt-${idx}`}
                x={cx}
                y={height - 10}
                textAnchor="middle"
                className="fill-slate-400 dark:fill-slate-500"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {s.date.slice(5)}
              </text>
            );
          })}

          {/* Hover Crosshair */}
          {hoverIdx !== null && slots[hoverIdx] && (
            <g pointerEvents="none">
              <line
                x1={xForIdx(hoverIdx)}
                x2={xForIdx(hoverIdx)}
                y1={padTop}
                y2={volTop + volHeight}
                className="stroke-slate-400 dark:stroke-slate-500"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {(slots[hoverIdx].visibleCandle || slots[hoverIdx].proj) && (
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={yForPrice(
                    slots[hoverIdx].visibleCandle
                      ? slots[hoverIdx].close
                      : slots[hoverIdx].proj!.p50,
                  )}
                  y2={yForPrice(
                    slots[hoverIdx].visibleCandle
                      ? slots[hoverIdx].close
                      : slots[hoverIdx].proj!.p50,
                  )}
                  className="stroke-slate-400 dark:stroke-slate-500"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Event / Trade Notice Row for Hovered Projected Point */}
      {activeHoverSlot?.proj &&
        (activeHoverSlot.proj.eventsTriggered.length > 0 ||
          (activeHoverSlot.visibleCandle && activeHoverSlot.proj.tradesTriggered.length > 0)) && (
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-4 text-xs bg-blue-50/40 dark:bg-blue-950/20">
            {activeHoverSlot.proj.eventsTriggered.map((ev) => (
              <span key={ev.id} className="text-sky-700 dark:text-sky-300 font-medium">
                催化事件：{ev.title}（冲击 {formatSignedPct(ev.impactPct)} · 波动率×{ev.volMultiplier}）
              </span>
            ))}
            {activeHoverSlot.visibleCandle &&
              activeHoverSlot.proj.tradesTriggered.map((tr, idx) => (
                <span key={idx} className="text-slate-700 dark:text-slate-200 font-mono-num">
                  沙盘成交：{tr.action === 'BUY' ? '买入' : '卖出'} {tr.shares} 股 @{' '}
                  {tr.price.toFixed(2)}（{tr.reason}）
                </span>
              ))}
          </div>
        )}
    </div>
  );
}
