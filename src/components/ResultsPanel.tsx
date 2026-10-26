import React, { useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  Cpu,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import { getAllocatedCount } from "../core/ragGraph";
import {
  DetectionReport,
  EventLogEntry,
  ProcessState,
  RAGState,
} from "../core/types";
import { Tooltip } from "./Tooltip";

interface ResultsPanelProps {
  graph: RAGState;
  report: DetectionReport;
  eventLog: EventLogEntry[];
  aiExplanation: string | null;
  aiLoading: boolean;
  aiError: string | null;
  onApplyRecovery: (victimId: string) => void;
  onExplainDeadlock: () => void;
  onClearLog: () => void;
}

type InspectorTab = "algorithms" | "tables" | "log";

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  graph,
  report,
  eventLog,
  aiExplanation,
  aiLoading,
  aiError,
  onApplyRecovery,
  onExplainDeadlock,
  onClearLog,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>("algorithms");

  const { dfs, kahns, bankers, recovery, isDeadlocked, hasCycleButSafe } =
    report;

  return (
    <aside className="flex flex-col bg-[#0E1420] border border-slate-800 rounded-xl divide-y divide-slate-800/90">
      {/* 1. Primary System Status Banner (Explicit Icon + Text Label, never color alone) */}
      <div className="p-4 space-y-3">
        {isDeadlocked ? (
          <div
            role="alert"
            className="p-3.5 rounded-lg border border-rose-500/50 bg-rose-950/35 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
                <span className="font-display text-sm font-bold tracking-wide text-rose-200">
                  DEADLOCK DETECTED
                </span>
              </div>
              <span className="font-mono text-xs text-rose-300 tabular-nums">
                {report.deadlockedProcesses.length} blocked
              </span>
            </div>
            <p className="text-xs text-rose-200/90 leading-relaxed">
              Deadlocked processes:{" "}
              <span className="font-mono font-semibold text-white">
                {report.deadlockedProcesses.join(", ")}
              </span>
            </p>
            {dfs.cycles.length > 0 && (
              <div className="pt-1 space-y-1">
                <span className="block text-[11px] text-rose-300/80">
                  Reconstructed Cycle Path{dfs.cycles.length > 1 ? "s" : ""}:
                </span>
                {dfs.cycles.map((cycle, idx) => (
                  <div
                    key={idx}
                    className="font-mono text-xs text-rose-100 bg-rose-950/60 border border-rose-500/30 rounded px-2.5 py-1.5 overflow-x-auto whitespace-nowrap"
                  >
                    {cycle.join(" → ")}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : hasCycleButSafe ? (
          <div
            role="status"
            className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-950/25 space-y-1.5"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-display text-sm font-bold text-amber-100">
                System Safe · Multi-Instance Escape
              </span>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              RAG contains cycle{" "}
              <span className="font-mono">
                {dfs.cycles[0]?.join(" → ") || ""}
              </span>
              , but Banker&apos;s matrix confirms safe completion order:{" "}
              <span className="font-mono font-semibold text-emerald-300">
                {bankers.safeSequence.join(" → ")}
              </span>
              .
            </p>
          </div>
        ) : (
          <div
            role="status"
            className="p-3.5 rounded-lg border border-emerald-500/40 bg-emerald-950/25 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-display text-sm font-bold text-emerald-100">
                  System Safe
                </span>
              </div>
              <span className="font-mono text-xs text-emerald-300">
                Acyclic RAG
              </span>
            </div>
            <p className="text-xs text-emerald-200/85 leading-relaxed">
              No circular wait exists. All active processes can acquire needed
              resources and finish cleanly.
            </p>
          </div>
        )}

        {/* 2. Side-by-Side DFS & Kahn's Comparison */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">
              Algorithm Cross-Check
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {report.algorithmsAgree ? "DFS & Kahn's Agree" : "Divergent"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-[#0B0F17] border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>3-Color DFS</span>
                <span className="font-mono tabular-nums">O(V+E)</span>
              </div>
              <p
                className={`text-xs font-semibold ${
                  dfs.hasCycle ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {dfs.hasCycle
                  ? `Cycle (${dfs.cycles.length} found)`
                  : "No Back Edge"}
              </p>
              <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                V={dfs.vertexCount} · E={dfs.edgeCount}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0B0F17] border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Kahn&apos;s BFS</span>
                <span className="font-mono tabular-nums">O(V+E)</span>
              </div>
              <p
                className={`text-xs font-semibold ${
                  kahns.hasCycle ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {kahns.hasCycle
                  ? `${kahns.stuckNodes.length} Stuck Nodes`
                  : "Valid Topo Sort"}
              </p>
              <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                Sorted {kahns.processedCount}/{kahns.vertexCount}
              </p>
            </div>
          </div>
        </div>

        {/* 3. Recovery Suggestion Card (when deadlocked) */}
        {recovery && (
          <div className="p-3 rounded-lg bg-[#0B0F17] border border-amber-500/35 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <Wrench className="w-3.5 h-3.5" />
                Recovery Victim: {recovery.victimProcessId}
              </div>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                Holds {recovery.heldResourcesCount} res
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {recovery.reason}
            </p>
            <Tooltip content="Terminate victim process, release held resources via FIFO, and re-run detection">
              <button
                type="button"
                onClick={() => onApplyRecovery(recovery.victimProcessId)}
                className="w-full py-2 px-3 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Apply Recovery (Terminate {recovery.victimProcessId})
              </button>
            </Tooltip>
          </div>
        )}

        {/* 4. Gemini-Powered Plain-English Explanation */}
        <div className="pt-1 space-y-2">
          <Tooltip content="Analyze current graph state and prevention strategies via Gemini">
            <button
              type="button"
              onClick={onExplainDeadlock}
              disabled={aiLoading || (graph.processes.length === 0 && graph.resources.length === 0)}
              className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-sky-300 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              {aiLoading
                ? "Analyzing Graph State..."
                : isDeadlocked
                  ? "Explain This Deadlock"
                  : "Explain Current Graph State"}
            </button>
          </Tooltip>

          {aiLoading && (
            <div className="p-3 rounded-lg bg-[#0B0F17] border border-slate-800 space-y-2 animate-pulse">
              <div className="h-3 bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-slate-800 rounded w-full" />
              <div className="h-3 bg-slate-800 rounded w-5/6" />
            </div>
          )}

          {aiError && !aiLoading && (
            <div className="p-2.5 rounded-lg bg-rose-950/35 border border-rose-500/40 text-xs text-rose-200">
              {aiError}
            </div>
          )}

          {aiExplanation && !aiLoading && (
            <div className="p-3 rounded-lg bg-[#0B0F17] border border-sky-500/30 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-sky-300 font-medium">
                <span>Concurrency Diagnostic</span>
                <span className="text-slate-500">Plain-English Analysis</span>
              </div>
              <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                {aiExplanation}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Segmented Inspector Tabs: Kahn's & Matrices | Allocations | Event Log */}
      <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
        <div
          className="grid grid-cols-3 gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "algorithms"}
            onClick={() => setActiveTab("algorithms")}
            className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === "algorithms"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Kahn&apos;s &amp; Matrix
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tables"}
            onClick={() => setActiveTab("tables")}
            className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === "tables"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Allocations
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "log"}
            onClick={() => setActiveTab("log")}
            className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
              activeTab === "log"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Log ({eventLog.length})
          </button>
        </div>

        {/* TAB 1: Kahn's In-Degree Table, Queue Steps, Topological Order, and Banker's Matrix */}
        {activeTab === "algorithms" && (
          <div className="space-y-4 overflow-y-auto max-h-[420px] pr-1">
            {/* Topological Order or Stuck Set */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-slate-200">
                {kahns.hasCycle
                  ? "Kahn's Leftover Stuck Nodes (In-Degree > 0)"
                  : "Kahn's Valid Topological Order"}
              </h4>
              <div className="p-2.5 rounded-lg bg-[#0B0F17] border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto whitespace-nowrap">
                {kahns.hasCycle
                  ? kahns.stuckNodes.join(", ") || "None"
                  : kahns.topologicalOrder.join(" → ") || "Empty graph"}
              </div>
              {!kahns.hasCycle && bankers.safeSequence.length > 0 && (
                <p className="text-[11px] text-slate-400">
                  Safe Process Completion Sequence:{" "}
                  <span className="font-mono text-emerald-300">
                    {bankers.safeSequence.join(" → ")}
                  </span>
                </p>
              )}
            </div>

            {/* Kahn's In-Degree Table */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-slate-200">
                Kahn&apos;s In-Degree Table
              </h4>
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead className="bg-[#0B0F17] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-1.5 px-2.5 font-medium">Node</th>
                      <th className="py-1.5 px-2.5 font-medium text-right">
                        Initial In-Deg
                      </th>
                      <th className="py-1.5 px-2.5 font-medium text-right">
                        Final In-Deg
                      </th>
                      <th className="py-1.5 px-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {Object.keys(kahns.initialInDegrees).map((nodeId) => {
                      const initDeg = kahns.initialInDegrees[nodeId];
                      const finalDeg = kahns.finalInDegrees[nodeId];
                      const isStuck = finalDeg > 0;
                      return (
                        <tr key={nodeId} className="hover:bg-slate-800/30">
                          <td className="py-1.5 px-2.5 font-semibold text-slate-100">
                            {nodeId}
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-slate-300">
                            {initDeg}
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-slate-300">
                            {finalDeg}
                          </td>
                          <td
                            className={`py-1.5 px-2.5 ${
                              isStuck ? "text-rose-400" : "text-emerald-400"
                            }`}
                          >
                            {isStuck ? "Stuck" : "Dequeued"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Kahn's BFS Queue Trace */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-slate-200">
                BFS Zero In-Degree Queue Steps
              </h4>
              {kahns.queueSteps.length === 0 ? (
                <p className="text-xs text-rose-300 bg-[#0B0F17] border border-slate-800 rounded-lg p-2.5">
                  0 nodes had initial in-degree 0 — queue started empty (immediate cycle).
                </p>
              ) : (
                <div className="space-y-1">
                  {kahns.queueSteps.map((qs) => (
                    <div
                      key={qs.step}
                      className="px-2.5 py-1.5 rounded bg-[#0B0F17] border border-slate-800/80 text-[11px] font-mono text-slate-300 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>
                        #{qs.step} Pop{" "}
                        <strong className="text-sky-300">{qs.dequeued}</strong>
                        {qs.enqueued.length > 0
                          ? ` → Enqueue [${qs.enqueued.join(", ")}]`
                          : ""}
                      </span>
                      <span className="text-slate-500">
                        Q:[{qs.queueAfterDequeue.join(", ")}]
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Multi-Instance Banker's Matrices */}
            {(report.multiInstanceMode ||
              graph.resources.some((r) => r.instances > 1)) &&
              bankers.resourceIds.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" />
                      Banker&apos;s Detection Matrices
                    </h4>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      Avail: [{bankers.available.join(", ")}]
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-800 rounded-lg">
                    <table className="w-full text-left text-[11px] font-mono tabular-nums">
                      <thead className="bg-[#0B0F17] text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-1.5 px-2">Proc</th>
                          <th className="py-1.5 px-2">
                            Alloc ({bankers.resourceIds.join(",")})
                          </th>
                          <th className="py-1.5 px-2">
                            Req ({bankers.resourceIds.join(",")})
                          </th>
                          <th className="py-1.5 px-2">Finish</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {bankers.processIds.map((pid, idx) => {
                          const isDead =
                            bankers.deadlockedProcesses.includes(pid);
                          return (
                            <tr key={pid}>
                              <td className="py-1.5 px-2 font-semibold text-slate-100">
                                {pid}
                              </td>
                              <td className="py-1.5 px-2 text-slate-300">
                                [{bankers.allocation[idx].join(", ")}]
                              </td>
                              <td className="py-1.5 px-2 text-slate-300">
                                [{bankers.request[idx].join(", ")}]
                              </td>
                              <td
                                className={`py-1.5 px-2 font-semibold ${
                                  isDead ? "text-rose-400" : "text-emerald-400"
                                }`}
                              >
                                {isDead ? "false" : "true"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* TAB 2: Per-Process & Per-Resource Allocation and Waiting Tables */}
        {activeTab === "tables" && (
          <div className="space-y-4 overflow-y-auto max-h-[420px] pr-1">
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-slate-200">
                Per-Process State &amp; Edges
              </h4>
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead className="bg-[#0B0F17] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-1.5 px-2.5">Process</th>
                      <th className="py-1.5 px-2.5">State</th>
                      <th className="py-1.5 px-2.5">Holding</th>
                      <th className="py-1.5 px-2.5">Waiting For</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {graph.processes.map((proc) => {
                      const held: string[] = [];
                      for (const r of graph.resources) {
                        const c = (graph.adjacency.get(r.id) ?? []).filter(
                          (t) => t === proc.id
                        ).length;
                        if (c > 0) held.push(c > 1 ? `${c}×${r.id}` : r.id);
                      }
                      const waiting = graph.adjacency.get(proc.id) ?? [];

                      return (
                        <tr key={proc.id} className="hover:bg-slate-800/30">
                          <td className="py-1.5 px-2.5 font-semibold text-slate-100">
                            {proc.id}
                          </td>
                          <td
                            className={`py-1.5 px-2.5 ${
                              proc.state === ProcessState.Deadlocked
                                ? "text-rose-400 font-semibold"
                                : proc.state === ProcessState.Waiting
                                  ? "text-amber-300"
                                  : proc.state === ProcessState.Finished
                                    ? "text-slate-500"
                                    : "text-emerald-400"
                            }`}
                          >
                            {proc.state}
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-300">
                            {held.length > 0 ? held.join(", ") : "—"}
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-300">
                            {waiting.length > 0 ? waiting.join(", ") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-slate-200">
                Per-Resource Instances &amp; FIFO Wait Queues
              </h4>
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead className="bg-[#0B0F17] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-1.5 px-2.5">Resource</th>
                      <th className="py-1.5 px-2.5 text-right">Used/Tot</th>
                      <th className="py-1.5 px-2.5">Holders</th>
                      <th className="py-1.5 px-2.5">FIFO Queue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {graph.resources.map((res) => {
                      const used = getAllocatedCount(graph, res.id);
                      const holders = graph.adjacency.get(res.id) ?? [];
                      return (
                        <tr key={res.id} className="hover:bg-slate-800/30">
                          <td className="py-1.5 px-2.5 font-semibold text-slate-100">
                            {res.id}
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-slate-300">
                            {used}/{res.instances}
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-300">
                            {holders.length > 0 ? holders.join(", ") : "Free"}
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-300">
                            {res.waitQueue.length > 0
                              ? res.waitQueue.join(" → ")
                              : "Empty"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Timestamped Event Log */}
        {activeTab === "log" && (
          <div className="space-y-2 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Kernel Simulation Event Log
              </span>
              {eventLog.length > 0 && (
                <button
                  type="button"
                  onClick={onClearLog}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[380px] pr-1">
              {eventLog.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No events logged yet. Execute a request, release, or detection run.
                </p>
              ) : (
                eventLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2 rounded bg-[#0B0F17] border border-slate-800/80 text-[11px] font-mono space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-slate-500 tabular-nums">
                      <span
                        className={
                          entry.type === "error"
                            ? "text-rose-400 font-semibold"
                            : entry.type === "recovery"
                              ? "text-amber-300 font-semibold"
                              : entry.type === "detect"
                                ? "text-sky-300 font-semibold"
                                : entry.type === "acquire"
                                  ? "text-emerald-400 font-semibold"
                                  : "text-slate-300"
                        }
                      >
                        [{entry.type.toUpperCase()}]
                      </span>
                      <span>{entry.timestamp}</span>
                    </div>
                    <p className="text-slate-200 leading-snug font-sans text-xs">
                      {entry.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
