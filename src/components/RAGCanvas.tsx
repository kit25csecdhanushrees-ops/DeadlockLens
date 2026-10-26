import React, { useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { getAllocatedCount, getVisualEdges } from "../core/ragGraph";
import {
  DetectionReport,
  DfsColor,
  DfsStep,
  ProcessState,
  RAGState,
} from "../core/types";
import { Tooltip } from "./Tooltip";

interface RAGCanvasProps {
  graph: RAGState;
  report: DetectionReport;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onAutoLayout: () => void;
  walkthroughActive: boolean;
  walkthroughIndex: number;
  isPlaying: boolean;
  speedMs: number;
  onTogglePlay: () => void;
  onStepPrev: () => void;
  onStepNext: () => void;
  onRestartWalkthrough: () => void;
  onCloseWalkthrough: () => void;
  onChangeSpeed: (ms: number) => void;
  onSelectNodeForAction?: (nodeId: string, kind: "process" | "resource") => void;
}

const PROC_RADIUS = 30;
const RES_HEIGHT = 56;

function getResourceWidth(instances: number): number {
  return Math.max(88, 34 + instances * 16);
}

/**
 * Computes the boundary intersection point for a circle or rectangle so directed
 * arrowheads land cleanly on node perimeters instead of clipping underneath.
 */
function intersectBoundary(
  cx: number,
  cy: number,
  tx: number,
  ty: number,
  shape: { kind: "circle"; r: number } | { kind: "rect"; w: number; h: number },
  padding = 0
): { x: number; y: number } {
  const dx = tx - cx;
  const dy = ty - cy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-3) return { x: cx, y: cy };

  const ux = dx / dist;
  const uy = dy / dist;

  if (shape.kind === "circle") {
    const r = shape.r + padding;
    return { x: cx + ux * r, y: cy + uy * r };
  }

  const hw = shape.w / 2 + padding;
  const hh = shape.h / 2 + padding;
  const scaleX = Math.abs(ux) > 1e-5 ? hw / Math.abs(ux) : Infinity;
  const scaleY = Math.abs(uy) > 1e-5 ? hh / Math.abs(uy) : Infinity;
  const t = Math.min(scaleX, scaleY);
  return { x: cx + ux * t, y: cy + uy * t };
}

export const RAGCanvas: React.FC<RAGCanvasProps> = ({
  graph,
  report,
  onMoveNode,
  onAutoLayout,
  walkthroughActive,
  walkthroughIndex,
  isPlaying,
  speedMs,
  onTogglePlay,
  onStepPrev,
  onStepNext,
  onRestartWalkthrough,
  onCloseWalkthrough,
  onChangeSpeed,
  onSelectNodeForAction,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const visualEdges = useMemo(() => getVisualEdges(graph), [graph]);

  const nodeLookup = useMemo(() => {
    const map = new Map<
      string,
      | { kind: "process"; x: number; y: number; r: number }
      | { kind: "resource"; x: number; y: number; w: number; h: number }
    >();
    for (const p of graph.processes) {
      map.set(p.id, { kind: "process", x: p.x, y: p.y, r: PROC_RADIUS });
    }
    for (const r of graph.resources) {
      map.set(r.id, {
        kind: "resource",
        x: r.x,
        y: r.y,
        w: getResourceWidth(r.instances),
        h: RES_HEIGHT,
      });
    }
    return map;
  }, [graph]);

  const cycleNodeSet = useMemo(
    () => new Set(report.dfs.cycleNodes),
    [report.dfs.cycleNodes]
  );
  const cycleEdgeSet = useMemo(
    () => new Set(report.dfs.cycleEdges.map((e) => `${e.from}->${e.to}`)),
    [report.dfs.cycleEdges]
  );

  const currentStep: DfsStep | null = walkthroughActive
    ? report.dfs.steps[
        Math.min(walkthroughIndex, Math.max(0, report.dfs.steps.length - 1))
      ] ?? null
    : null;

  // Convert pointer coordinates accurately into SVG viewBox coordinates (760x480)
  const clientToSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const transformed = pt.matrixTransform(ctm.inverse());
    return {
      x: Math.max(48, Math.min(712, transformed.x)),
      y: Math.max(44, Math.min(436, transformed.y)),
    };
  };

  const handleNodePointerDown = (
    e: React.PointerEvent,
    nodeId: string,
    nodeX: number,
    nodeY: number,
    kind: "process" | "resource"
  ) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const svgPt = clientToSvgPoint(e.clientX, e.clientY);
    dragOffset.current = { dx: nodeX - svgPt.x, dy: nodeY - svgPt.y };
    setDraggingId(nodeId);
    onSelectNodeForAction?.(nodeId, kind);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId) return;
    const svgPt = clientToSvgPoint(e.clientX, e.clientY);
    const nx = Math.max(48, Math.min(712, Math.round(svgPt.x + dragOffset.current.dx)));
    const ny = Math.max(44, Math.min(436, Math.round(svgPt.y + dragOffset.current.dy)));
    onMoveNode(draggingId, nx, ny);
  };

  const handlePointerUp = () => {
    if (draggingId) {
      setDraggingId(null);
    }
  };

  const speedMultiplier = (1000 / speedMs).toFixed(1);

  return (
    <div className="flex flex-col h-full bg-[#0E1420] border border-slate-800 rounded-xl overflow-hidden">
      {/* Canvas Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-[#111827]/70">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="font-semibold text-sm text-slate-100">
            Resource Allocation Graph
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {graph.processes.length}P / {graph.resources.length}R
          </span>
          <span aria-hidden="true">·</span>
          <span className="hidden sm:inline">Drag nodes to rearrange</span>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip content="Arrange processes and resources cleanly" shortcut="L">
            <button
              type="button"
              onClick={onAutoLayout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
              Auto-Layout
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Legend Bar (Unboxed clean typographic legend) */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2 border-b border-slate-800/80 bg-[#0B0F17]/60 text-[12px] text-slate-400">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" fill="none" stroke="#94A3B8" strokeWidth="1.5" />
            </svg>
            Process (Circle)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-4 h-3.5" viewBox="0 0 16 14" aria-hidden="true">
              <rect x="1.5" y="2" width="13" height="10" rx="2" fill="none" stroke="#94A3B8" strokeWidth="1.5" />
              <circle cx="5.5" cy="7" r="1.6" fill="#38BDF8" />
              <circle cx="10.5" cy="7" r="1.6" fill="none" stroke="#94A3B8" strokeWidth="1.2" />
            </svg>
            Resource (Filled dot = held)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-6 h-3" viewBox="0 0 24 12" aria-hidden="true">
              <line x1="1" y1="6" x2="21" y2="6" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 2.5" />
            </svg>
            Request (P → R)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-6 h-3" viewBox="0 0 24 12" aria-hidden="true">
              <line x1="1" y1="6" x2="21" y2="6" stroke="#38BDF8" strokeWidth="1.75" />
            </svg>
            Assignment (R → P)
          </span>
        </div>

        {walkthroughActive ? (
          <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
            <span>DFS Coloring Mode: WHITE → GREY → BLACK</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-400">Safe = Emerald</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-rose-400">Cycle = Pulsing Crimson</span>
          </div>
        )}
      </div>

      {/* Interactive SVG Stage */}
      <div className="relative flex-1 min-h-[380px] lg:min-h-[460px] select-none bg-[#0B0F17]">
        {graph.processes.length === 0 && graph.resources.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-sm font-medium text-slate-300 mb-1">
              Resource Allocation Graph is empty
            </p>
            <p className="text-xs text-slate-500 max-w-sm">
              Add a Process and Resource from the Controls panel on the left, or load a preset scenario to inspect deadlock detection.
            </p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox="0 0 760 480"
            className="w-full h-full touch-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            role="img"
            aria-label="Interactive Resource Allocation Graph"
          >
            <defs>
              {/* Subtle architectural dot grid */}
              <pattern
                id="rag-grid"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="0.85" fill="#1E293B" />
              </pattern>

              {/* Arrowhead markers for every semantic state */}
              <marker
                id="arrow-request"
                viewBox="0 0 10 10"
                refX="8.5"
                refY="5"
                markerWidth="6.5"
                markerHeight="6.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#94A3B8" />
              </marker>
              <marker
                id="arrow-assign"
                viewBox="0 0 10 10"
                refX="8.5"
                refY="5"
                markerWidth="6.5"
                markerHeight="6.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#38BDF8" />
              </marker>
              <marker
                id="arrow-safe"
                viewBox="0 0 10 10"
                refX="8.5"
                refY="5"
                markerWidth="6.5"
                markerHeight="6.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#34D399" />
              </marker>
              <marker
                id="arrow-cycle"
                viewBox="0 0 10 10"
                refX="8.5"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.2 L 9.5 5 L 0 8.8 z" fill="#F87171" />
              </marker>
              <marker
                id="arrow-active-dfs"
                viewBox="0 0 10 10"
                refX="8.5"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.2 L 9.5 5 L 0 8.8 z" fill="#FBBF24" />
              </marker>
            </defs>

            <rect width="760" height="480" fill="url(#rag-grid)" />

            {/* Directed Edges Layer */}
            <g>
              {visualEdges.map((edge) => {
                const src = nodeLookup.get(edge.from);
                const dst = nodeLookup.get(edge.to);
                if (!src || !dst) return null;

                // Curve offset when bidirectional edges exist between same (P, R) pair
                let ctrlOffsetX = 0;
                let ctrlOffsetY = 0;
                if (edge.hasReverse) {
                  const dx = dst.x - src.x;
                  const dy = dst.y - src.y;
                  const len = Math.hypot(dx, dy) || 1;
                  const normalX = -dy / len;
                  const normalY = dx / len;
                  ctrlOffsetX = normalX * 26;
                  ctrlOffsetY = normalY * 26;
                }

                const midAimX = (src.x + dst.x) / 2 + ctrlOffsetX;
                const midAimY = (src.y + dst.y) / 2 + ctrlOffsetY;

                const startPt = intersectBoundary(
                  src.x,
                  src.y,
                  midAimX,
                  midAimY,
                  src.kind === "process"
                    ? { kind: "circle", r: src.r }
                    : { kind: "rect", w: src.w, h: src.h },
                  2
                );

                const endPt = intersectBoundary(
                  dst.x,
                  dst.y,
                  midAimX,
                  midAimY,
                  dst.kind === "process"
                    ? { kind: "circle", r: dst.r }
                    : { kind: "rect", w: dst.w, h: dst.h },
                  4
                );

                const pathD = edge.hasReverse
                  ? `M ${startPt.x} ${startPt.y} Q ${midAimX} ${midAimY} ${endPt.x} ${endPt.y}`
                  : `M ${startPt.x} ${startPt.y} L ${endPt.x} ${endPt.y}`;

                const labelX = edge.hasReverse
                  ? (startPt.x + 2 * midAimX + endPt.x) / 4
                  : (startPt.x + endPt.x) / 2;
                const labelY = edge.hasReverse
                  ? (startPt.y + 2 * midAimY + endPt.y) / 4
                  : (startPt.y + endPt.y) / 2;

                const inCycle = cycleEdgeSet.has(edge.id);
                const isInspectedEdge =
                  walkthroughActive &&
                  currentStep?.edge?.from === edge.from &&
                  currentStep?.edge?.to === edge.to;
                const isBackEdgeFlash =
                  isInspectedEdge && currentStep?.type === "back-edge";

                let stroke = edge.kind === "request" ? "#94A3B8" : "#38BDF8";
                let strokeWidth = edge.kind === "request" ? 1.8 : 2.1;
                let markerEnd =
                  edge.kind === "request"
                    ? "url(#arrow-request)"
                    : "url(#arrow-assign)";
                let opacity = 0.92;
                let extraClass = "";

                if (walkthroughActive) {
                  if (isBackEdgeFlash) {
                    stroke = "#EF4444";
                    strokeWidth = 3.4;
                    markerEnd = "url(#arrow-cycle)";
                    opacity = 1;
                    extraClass = "animate-edge-flash";
                  } else if (isInspectedEdge) {
                    stroke = "#FBBF24";
                    strokeWidth = 2.8;
                    markerEnd = "url(#arrow-active-dfs)";
                    opacity = 1;
                  } else {
                    opacity = 0.42;
                  }
                } else if (report.isDeadlocked) {
                  if (inCycle) {
                    stroke = "#F87171";
                    strokeWidth = 2.8;
                    markerEnd = "url(#arrow-cycle)";
                    opacity = 1;
                    extraClass = "animate-cycle-pulse";
                  } else {
                    opacity = 0.25;
                  }
                } else if (report.hasCycleButSafe && inCycle) {
                  stroke = "#FBBF24";
                  strokeWidth = 2.3;
                  markerEnd = "url(#arrow-active-dfs)";
                } else {
                  // System safe: subtle emerald tint for assignments, clean slate for waiting requests
                  if (edge.kind === "assignment") {
                    stroke = "#34D399";
                    markerEnd = "url(#arrow-safe)";
                  }
                }

                return (
                  <g key={edge.id} style={{ opacity }}>
                    <path
                      d={pathD}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeDasharray={
                        edge.kind === "request" ? "6 4" : undefined
                      }
                      markerEnd={markerEnd}
                      className={extraClass}
                    />
                    {edge.count > 1 && (
                      <g transform={`translate(${labelX}, ${labelY})`}>
                        <rect
                          x="-13"
                          y="-9"
                          width="26"
                          height="18"
                          rx="4"
                          fill="#0F172A"
                          stroke={stroke}
                          strokeWidth="1"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#E2E8F0"
                          className="font-mono text-[10px] font-semibold"
                        >
                          ×{edge.count}
                        </text>
                      </g>
                    )}
                    {isBackEdgeFlash && (
                      <g transform={`translate(${labelX}, ${labelY - 14})`}>
                        <rect
                          x="-38"
                          y="-10"
                          width="76"
                          height="19"
                          rx="4"
                          fill="#7F1D1D"
                          stroke="#F87171"
                          strokeWidth="1.2"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#FECACA"
                          className="font-mono text-[10px] font-bold"
                        >
                          BACK EDGE
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Resource Nodes Layer (Rectangles with instance dots) */}
            <g>
              {graph.resources.map((res) => {
                const width = getResourceWidth(res.instances);
                const allocated = getAllocatedCount(graph, res.id);
                const inCycle = cycleNodeSet.has(res.id);
                const dfsColor = currentStep?.colors[res.id];
                const isCurrentDfs = currentStep?.currentNode === res.id;

                let stroke = "#34D399";
                let fill = "#0F1B24";
                let opacity = 1;
                let badgeText = `${allocated}/${res.instances} held`;
                let badgeColor = "#94A3B8";
                let pulseClass = "";

                if (walkthroughActive) {
                  if (dfsColor === DfsColor.Grey) {
                    stroke = "#F59E0B";
                    fill = "#291D09";
                    badgeText = "GREY (STACK)";
                    badgeColor = "#FCD34D";
                  } else if (dfsColor === DfsColor.Black) {
                    stroke = "#64748B";
                    fill = "#0D131F";
                    badgeText = "BLACK (DONE)";
                    badgeColor = "#94A3B8";
                  } else {
                    stroke = "#CBD5E1";
                    fill = "#162032";
                    badgeText = "WHITE";
                    badgeColor = "#E2E8F0";
                  }
                } else if (report.isDeadlocked) {
                  if (inCycle) {
                    stroke = "#EF4444";
                    fill = "#2A1219";
                    badgeText = "IN CYCLE";
                    badgeColor = "#FCA5A5";
                    pulseClass = "animate-cycle-pulse";
                  } else {
                    stroke = "#334155";
                    fill = "#0F172A";
                    opacity = 0.34;
                  }
                } else if (report.hasCycleButSafe && inCycle) {
                  stroke = "#F59E0B";
                  fill = "#241C0C";
                  badgeText = "CYCLE · SAFE";
                  badgeColor = "#FCD34D";
                }

                // Compute horizontal row of instance dots
                const dotSpacing = 14;
                const startDotX =
                  res.x - ((res.instances - 1) * dotSpacing) / 2;
                const dotY = res.y + 12;

                return (
                  <g
                    key={res.id}
                    style={{ opacity }}
                    className={`cursor-grab active:cursor-grabbing ${pulseClass}`}
                    onPointerDown={(e) =>
                      handleNodePointerDown(
                        e,
                        res.id,
                        res.x,
                        res.y,
                        "resource"
                      )
                    }
                  >
                    {isCurrentDfs && (
                      <rect
                        x={res.x - width / 2 - 5}
                        y={res.y - RES_HEIGHT / 2 - 5}
                        width={width + 10}
                        height={RES_HEIGHT + 10}
                        rx="11"
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="1.8"
                        strokeDasharray="4 3"
                      />
                    )}

                    <rect
                      x={res.x - width / 2}
                      y={res.y - RES_HEIGHT / 2}
                      width={width}
                      height={RES_HEIGHT}
                      rx="8"
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={inCycle && report.isDeadlocked ? 2.4 : 1.8}
                    />

                    {/* Resource ID & Label */}
                    <text
                      x={res.x}
                      y={res.y - 8}
                      textAnchor="middle"
                      fill="#F8FAFC"
                      className="font-mono text-xs font-semibold"
                    >
                      {res.label !== res.id
                        ? `${res.id} (${res.label})`
                        : res.id}
                    </text>

                    {/* Instance Dots: Filled = Allocated, Hollow = Available */}
                    {Array.from({ length: res.instances }).map((_, idx) => {
                      const isAllocated = idx < allocated;
                      const dotFill = isAllocated
                        ? inCycle && report.isDeadlocked
                          ? "#F87171"
                          : "#38BDF8"
                        : "transparent";
                      const dotStroke = isAllocated
                        ? inCycle && report.isDeadlocked
                          ? "#F87171"
                          : "#38BDF8"
                        : "#64748B";
                      return (
                        <circle
                          key={idx}
                          cx={startDotX + idx * dotSpacing}
                          cy={dotY}
                          r={4.2}
                          fill={dotFill}
                          stroke={dotStroke}
                          strokeWidth="1.5"
                        />
                      );
                    })}

                    {/* Subtitle / Queue / DFS State */}
                    <text
                      x={res.x}
                      y={res.y + RES_HEIGHT / 2 + 15}
                      textAnchor="middle"
                      fill={badgeColor}
                      className="font-mono text-[10px]"
                    >
                      {badgeText}
                      {!walkthroughActive && res.waitQueue.length > 0
                        ? ` · Q:[${res.waitQueue.join(",")}]`
                        : ""}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Process Nodes Layer (Circles) */}
            <g>
              {graph.processes.map((proc) => {
                const inCycle = cycleNodeSet.has(proc.id);
                const isProcDeadlocked = report.deadlockedProcesses.includes(
                  proc.id
                );
                const dfsColor = currentStep?.colors[proc.id];
                const isCurrentDfs = currentStep?.currentNode === proc.id;

                let stroke = "#10B981";
                let fill = "#0B221D";
                let stateLabel: string = proc.state;
                let stateColor = "#6EE7B7";
                let opacity = 1;
                let pulseClass = "";

                if (proc.state === ProcessState.Finished) {
                  stroke = "#475569";
                  fill = "#0F172A";
                  stateLabel = "FINISHED";
                  stateColor = "#64748B";
                  opacity = report.isDeadlocked ? 0.28 : 0.65;
                } else if (walkthroughActive) {
                  if (dfsColor === DfsColor.Grey) {
                    stroke = "#F59E0B";
                    fill = "#291D09";
                    stateLabel = "GREY (STACK)";
                    stateColor = "#FCD34D";
                  } else if (dfsColor === DfsColor.Black) {
                    stroke = "#64748B";
                    fill = "#0D131F";
                    stateLabel = "BLACK (DONE)";
                    stateColor = "#94A3B8";
                  } else {
                    stroke = "#E2E8F0";
                    fill = "#162032";
                    stateLabel = "WHITE";
                    stateColor = "#E2E8F0";
                  }
                } else if (report.isDeadlocked) {
                  if (inCycle || isProcDeadlocked) {
                    stroke = "#EF4444";
                    fill = "#2C1018";
                    stateLabel = inCycle ? "DEADLOCKED" : "BLOCKED";
                    stateColor = "#FCA5A5";
                    if (inCycle) pulseClass = "animate-cycle-pulse";
                  } else {
                    stroke = "#10B981";
                    fill = "#0B221D";
                    opacity = 0.34;
                  }
                } else {
                  // System Safe -> Safe nodes rendered in clean emerald green with explicit state text
                  stroke =
                    proc.state === ProcessState.Waiting ? "#34D399" : "#10B981";
                  fill = "#0B221D";
                  stateLabel =
                    proc.state === ProcessState.Waiting
                      ? "SAFE · WAITING"
                      : "SAFE · RUNNING";
                  stateColor = "#6EE7B7";
                }

                return (
                  <g
                    key={proc.id}
                    style={{ opacity }}
                    className={`cursor-grab active:cursor-grabbing ${pulseClass}`}
                    onPointerDown={(e) =>
                      handleNodePointerDown(
                        e,
                        proc.id,
                        proc.x,
                        proc.y,
                        "process"
                      )
                    }
                  >
                    {isCurrentDfs && (
                      <circle
                        cx={proc.x}
                        cy={proc.y}
                        r={PROC_RADIUS + 6}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="1.8"
                        strokeDasharray="4 3"
                      />
                    )}

                    <circle
                      cx={proc.x}
                      cy={proc.y}
                      r={PROC_RADIUS}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={
                        (inCycle || isProcDeadlocked) && report.isDeadlocked
                          ? 2.5
                          : 2
                      }
                    />

                    <text
                      x={proc.x}
                      y={proc.label !== proc.id ? proc.y - 4 : proc.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#F8FAFC"
                      className="font-mono text-sm font-bold"
                    >
                      {proc.id}
                    </text>

                    {proc.label !== proc.id && (
                      <text
                        x={proc.x}
                        y={proc.y + 11}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#CBD5E1"
                        className="text-[10px]"
                      >
                        {proc.label}
                      </text>
                    )}

                    <text
                      x={proc.x}
                      y={proc.y + PROC_RADIUS + 15}
                      textAnchor="middle"
                      fill={stateColor}
                      className="font-mono text-[10px] font-medium"
                    >
                      {stateLabel}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      {/* Animated DFS Walkthrough Deck (visible when Step Through DFS is active) */}
      {walkthroughActive && currentStep && (
        <div className="border-t border-slate-800 bg-[#111827] px-4 py-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono font-semibold text-amber-300 tabular-nums">
                DFS Step {currentStep.stepIndex + 1} / {report.dfs.steps.length}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-mono text-slate-300">
                Stack:{" "}
                {currentStep.recursionStack.length > 0
                  ? currentStep.recursionStack.join(" → ")
                  : "empty"}
              </span>
            </div>

            <button
              type="button"
              onClick={onCloseWalkthrough}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-100 rounded transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Exit Walkthrough
            </button>
          </div>

          <p
            className={`text-xs font-mono leading-relaxed ${
              currentStep.type === "back-edge"
                ? "text-rose-300 font-semibold"
                : "text-slate-200"
            }`}
          >
            {currentStep.description}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-1.5">
              <Tooltip content="Restart DFS from step 1">
                <button
                  type="button"
                  onClick={onRestartWalkthrough}
                  className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  aria-label="Restart DFS walkthrough"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </Tooltip>

              <Tooltip content="Previous DFS step">
                <button
                  type="button"
                  onClick={onStepPrev}
                  disabled={walkthroughIndex <= 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-200 border border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
              </Tooltip>

              <Tooltip content={isPlaying ? "Pause playback" : "Play DFS animation"}>
                <button
                  type="button"
                  onClick={onTogglePlay}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Play
                    </>
                  )}
                </button>
              </Tooltip>

              <Tooltip content="Next DFS step">
                <button
                  type="button"
                  onClick={onStepNext}
                  disabled={walkthroughIndex >= report.dfs.steps.length - 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-200 border border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </div>

            {/* Labeled Speed Slider with explicit numeric unit */}
            <div className="flex items-center gap-3">
              <label
                htmlFor="dfs-speed-slider"
                className="text-xs text-slate-300 font-mono tabular-nums whitespace-nowrap"
              >
                Speed: {speedMultiplier}x ({speedMs} ms/step)
              </label>
              <input
                id="dfs-speed-slider"
                type="range"
                min={200}
                max={1500}
                step={100}
                value={1700 - speedMs}
                onChange={(e) => onChangeSpeed(1700 - Number(e.target.value))}
                className="w-28 accent-sky-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
