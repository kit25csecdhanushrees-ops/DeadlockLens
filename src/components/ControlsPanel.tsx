import React, { useRef, useState } from "react";
import {
  Download,
  Play,
  Plus,
  RotateCcw,
  StepForward,
  Upload,
} from "lucide-react";
import { PRESET_SCENARIOS } from "../core/presets";
import { ProcessState, RAGState } from "../core/types";
import { Tooltip } from "./Tooltip";

interface ControlsPanelProps {
  graph: RAGState;
  activePresetId: string;
  selectedProcess: string;
  selectedResource: string;
  actionMode: "request" | "release";
  autoDetect: boolean;
  multiInstanceMode: boolean;
  feedbackBanner: { kind: "error" | "info"; text: string } | null;
  onSelectPreset: (presetId: string) => void;
  onChangeSelectedProcess: (id: string) => void;
  onChangeSelectedResource: (id: string) => void;
  onChangeActionMode: (mode: "request" | "release") => void;
  onAddProcess: (customId?: string) => void;
  onAddResource: (instances: number, customId?: string) => void;
  onExecuteAction: () => void;
  onRunDetection: () => void;
  onStartDfsWalkthrough: () => void;
  onReset: () => void;
  onToggleAutoDetect: (next: boolean) => void;
  onToggleMultiInstance: (next: boolean) => void;
  onExportJson: () => void;
  onImportJson: (jsonText: string) => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  graph,
  activePresetId,
  selectedProcess,
  selectedResource,
  actionMode,
  autoDetect,
  multiInstanceMode,
  feedbackBanner,
  onSelectPreset,
  onChangeSelectedProcess,
  onChangeSelectedResource,
  onChangeActionMode,
  onAddProcess,
  onAddResource,
  onExecuteAction,
  onRunDetection,
  onStartDfsWalkthrough,
  onReset,
  onToggleAutoDetect,
  onToggleMultiInstance,
  onExportJson,
  onImportJson,
}) => {
  const [newResourceInstances, setNewResourceInstances] = useState<number>(1);
  const [customProcName, setCustomProcName] = useState<string>("");
  const [customResName, setCustomResName] = useState<string>("");
  const [showPasteDrawer, setShowPasteDrawer] = useState<boolean>(false);
  const [pasteBuffer, setPasteBuffer] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onImportJson(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteBuffer.trim()) return;
    onImportJson(pasteBuffer);
    setPasteBuffer("");
    setShowPasteDrawer(false);
  };

  const activePreset = PRESET_SCENARIOS.find((p) => p.id === activePresetId);

  return (
    <aside className="flex flex-col bg-[#0E1420] border border-slate-800 rounded-xl divide-y divide-slate-800/90">
      {/* Section 1: Preset Scenarios */}
      <div className="p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="preset-select"
            className="text-xs font-semibold text-slate-200"
          >
            Preset Scenarios
          </label>
          <span className="text-[11px] text-slate-500">Load topology</span>
        </div>

        <Tooltip content="Load a pre-built OS or database deadlock scenario">
          <select
            id="preset-select"
            value={activePresetId}
            onChange={(e) => onSelectPreset(e.target.value)}
            className="w-full px-3 py-2 text-xs font-medium bg-[#0B0F17] text-slate-100 border border-slate-700 rounded-lg focus:outline-none focus:border-sky-400 cursor-pointer"
          >
            {PRESET_SCENARIOS.map((preset, index) => (
              <option key={preset.id} value={preset.id}>
                {index + 1}. {preset.name}
              </option>
            ))}
            <option value="custom">Custom Graph State</option>
          </select>
        </Tooltip>

        {activePreset && (
          <p className="text-[12px] text-slate-400 leading-snug">
            {activePreset.subtitle}
          </p>
        )}
      </div>

      {/* Section 2: Add Nodes (Processes & Resources) */}
      <div className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-200">
          Graph Topology Builder
        </h3>

        {/* Add Process Row */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customProcName}
            onChange={(e) => setCustomProcName(e.target.value)}
            placeholder="Auto ID (e.g. P3)"
            maxLength={10}
            aria-label="Optional process ID"
            className="w-full min-w-0 px-2.5 py-2 text-xs font-mono bg-[#0B0F17] text-slate-100 placeholder:text-slate-500 border border-slate-700 rounded-lg focus:outline-none focus:border-sky-400"
          />
          <Tooltip content="Add a new Process node to the graph">
            <button
              type="button"
              onClick={() => {
                onAddProcess(customProcName || undefined);
                setCustomProcName("");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              Add Process
            </button>
          </Tooltip>
        </div>

        {/* Add Resource Row with Instance Count */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customResName}
              onChange={(e) => setCustomResName(e.target.value)}
              placeholder="Auto ID (e.g. R3)"
              maxLength={10}
              aria-label="Optional resource ID"
              className="w-full min-w-0 px-2.5 py-2 text-xs font-mono bg-[#0B0F17] text-slate-100 placeholder:text-slate-500 border border-slate-700 rounded-lg focus:outline-none focus:border-sky-400"
            />
            <Tooltip content="Number of identical instances for this resource (1–6)">
              <div className="flex items-center bg-[#0B0F17] border border-slate-700 rounded-lg px-2 py-1.5 shrink-0">
                <label
                  htmlFor="res-instances-input"
                  className="text-[11px] text-slate-400 mr-1.5"
                >
                  Inst:
                </label>
                <input
                  id="res-instances-input"
                  type="number"
                  min={1}
                  max={6}
                  value={newResourceInstances}
                  onChange={(e) =>
                    setNewResourceInstances(
                      Math.max(1, Math.min(6, Number(e.target.value) || 1))
                    )
                  }
                  className="w-9 text-xs font-mono tabular-nums text-center bg-transparent text-slate-100 focus:outline-none"
                />
              </div>
            </Tooltip>
          </div>

          <Tooltip content="Add a new Resource node with the specified instance count">
            <button
              type="button"
              onClick={() => {
                onAddResource(
                  newResourceInstances,
                  customResName || undefined
                );
                setCustomResName("");
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              Add Resource ({newResourceInstances} Instance
              {newResourceInstances > 1 ? "s" : ""})
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Section 3: Action Form (Request / Release) */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-200">
            Dispatch Resource Action
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            FIFO Queue
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="action-proc-select"
              className="block text-[11px] text-slate-400 mb-1"
            >
              Process
            </label>
            <select
              id="action-proc-select"
              value={selectedProcess}
              onChange={(e) => onChangeSelectedProcess(e.target.value)}
              disabled={graph.processes.length === 0}
              className="w-full px-2.5 py-2 text-xs font-mono bg-[#0B0F17] text-slate-100 border border-slate-700 rounded-lg focus:outline-none focus:border-sky-400 disabled:opacity-40 cursor-pointer"
            >
              {graph.processes.length === 0 ? (
                <option value="">None</option>
              ) : (
                graph.processes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} ({p.state === ProcessState.Finished ? "Fin" : p.state.slice(0, 4)})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="action-res-select"
              className="block text-[11px] text-slate-400 mb-1"
            >
              Resource
            </label>
            <select
              id="action-res-select"
              value={selectedResource}
              onChange={(e) => onChangeSelectedResource(e.target.value)}
              disabled={graph.resources.length === 0}
              className="w-full px-2.5 py-2 text-xs font-mono bg-[#0B0F17] text-slate-100 border border-slate-700 rounded-lg focus:outline-none focus:border-sky-400 disabled:opacity-40 cursor-pointer"
            >
              {graph.resources.length === 0 ? (
                <option value="">None</option>
              ) : (
                graph.resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} ({r.instances} inst)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Segmented Control: Request vs Release */}
        <div
          className="grid grid-cols-2 gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg"
          role="group"
          aria-label="Action operation type"
        >
          <button
            type="button"
            onClick={() => onChangeActionMode("request")}
            className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              actionMode === "request"
                ? "bg-slate-800 text-sky-300 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Request (P → R)
          </button>
          <button
            type="button"
            onClick={() => onChangeActionMode("release")}
            className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              actionMode === "release"
                ? "bg-slate-800 text-emerald-300 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Release (R ↛ P)
          </button>
        </div>

        <Tooltip
          content={
            actionMode === "request"
              ? "Grant free instance immediately or queue process as Waiting"
              : "Release held instance and wake first waiting process in FIFO order"
          }
        >
          <button
            type="button"
            onClick={onExecuteAction}
            disabled={
              graph.processes.length === 0 || graph.resources.length === 0
            }
            className="w-full py-2.5 px-4 text-xs font-semibold bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Execute {actionMode === "request" ? "Request" : "Release"}
          </button>
        </Tooltip>

        {feedbackBanner && (
          <div
            role="status"
            className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
              feedbackBanner.kind === "error"
                ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
                : "bg-slate-900/90 border-slate-700 text-slate-300"
            }`}
          >
            {feedbackBanner.text}
          </div>
        )}
      </div>

      {/* Section 4: Detection Controls & Toggles */}
      <div className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-200">
          Detection & Walkthrough
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <Tooltip
            content="Run DFS, Kahn's, and Banker's deadlock detection"
            shortcut="D"
          >
            <button
              type="button"
              onClick={onRunDetection}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-white text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Detection
            </button>
          </Tooltip>

          <Tooltip
            content="Animate White-Grey-Black DFS traversal step by step"
            shortcut="S"
          >
            <button
              type="button"
              onClick={onStartDfsWalkthrough}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <StepForward className="w-3.5 h-3.5" />
              Step DFS
            </button>
          </Tooltip>
        </div>

        <Tooltip content="Reset current preset or clear custom graph" shortcut="R">
          <button
            type="button"
            onClick={onReset}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Graph
          </button>
        </Tooltip>

        {/* Toggles */}
        <div className="pt-1 space-y-2.5">
          <Tooltip content="Automatically re-run detection algorithms after every graph edit">
            <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
              <span className="text-xs text-slate-300">
                Auto-detect after actions
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={autoDetect}
                onClick={() => onToggleAutoDetect(!autoDetect)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  autoDetect ? "bg-sky-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    autoDetect ? "translate-x-4.5" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          </Tooltip>

          <Tooltip content="Verify cycles with Banker's Available/Allocation/Request matrices when resources have >1 instance">
            <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
              <div>
                <span className="block text-xs text-slate-300">
                  Multi-instance mode (Banker&apos;s)
                </span>
                <span className="block text-[11px] text-slate-500">
                  Cycle necessary, matrix confirms sufficiency
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={multiInstanceMode}
                onClick={() => onToggleMultiInstance(!multiInstanceMode)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  multiInstanceMode ? "bg-sky-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    multiInstanceMode ? "translate-x-4.5" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          </Tooltip>
        </div>
      </div>

      {/* Section 5: JSON Export / Import */}
      <div className="p-4 space-y-2.5">
        <h3 className="text-xs font-semibold text-slate-200">
          Graph Serialization (JSON)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Tooltip content="Download current Resource Allocation Graph as JSON">
            <button
              type="button"
              onClick={onExportJson}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              Export JSON
            </button>
          </Tooltip>

          <Tooltip content="Upload a saved JSON graph file">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              Import JSON
            </button>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowPasteDrawer((prev) => !prev)}
          className="text-[11px] text-slate-400 hover:text-sky-300 underline underline-offset-2 transition-colors cursor-pointer"
        >
          {showPasteDrawer ? "Hide JSON paste box" : "Or paste raw JSON directly"}
        </button>

        {showPasteDrawer && (
          <form onSubmit={handlePasteSubmit} className="space-y-2 pt-1">
            <textarea
              rows={4}
              value={pasteBuffer}
              onChange={(e) => setPasteBuffer(e.target.value)}
              placeholder='{"version":1,"processes":[...],"resources":[...],"adjacency":{...}}'
              className="w-full p-2 text-[11px] font-mono bg-[#0B0F17] text-slate-200 border border-slate-700 rounded-lg focus:outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              className="w-full py-1.5 px-3 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md cursor-pointer"
            >
              Load Pasted JSON
            </button>
          </form>
        )}
      </div>
    </aside>
  );
};
