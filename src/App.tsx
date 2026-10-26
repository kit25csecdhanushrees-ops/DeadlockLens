import React, { useCallback, useEffect, useRef, useState } from "react";
import { ControlsPanel } from "./components/ControlsPanel";
import {
  EducationalSections,
  HeroSection,
  TopNavBar,
} from "./components/EducationalSections";
import { RAGCanvas } from "./components/RAGCanvas";
import { ResultsPanel } from "./components/ResultsPanel";
import { runDetectionSuite } from "./core/algorithms";
import { PRESET_SCENARIOS } from "./core/presets";
import {
  addProcessNode,
  addResourceNode,
  autoLayoutRAG,
  createEmptyRAG,
  deserializeRAG,
  getVisualEdges,
  moveNode,
  releaseResource,
  requestResource,
  serializeRAG,
  terminateProcess,
} from "./core/ragGraph";
import {
  DetectionReport,
  EventLogEntry,
  EventLogType,
  RAGState,
} from "./core/types";

function formatTimestamp(): string {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

function createLogEntry(type: EventLogType, message: string): EventLogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: formatTimestamp(),
    type,
    message,
  };
}

export default function App() {
  const initialPreset = PRESET_SCENARIOS[0];
  const initialBuild = initialPreset.build();
  const initialEvaluated = runDetectionSuite(
    initialBuild,
    initialPreset.recommendedMultiInstance
  );

  const [activePresetId, setActivePresetId] = useState<string>(
    initialPreset.id
  );
  const [graph, setGraph] = useState<RAGState>(initialEvaluated.state);
  const [report, setReport] = useState<DetectionReport>(
    initialEvaluated.report
  );
  const [multiInstanceMode, setMultiInstanceMode] = useState<boolean>(
    initialPreset.recommendedMultiInstance
  );
  const [autoDetect, setAutoDetect] = useState<boolean>(true);

  const [selectedProcess, setSelectedProcess] = useState<string>(
    initialEvaluated.state.processes[0]?.id ?? ""
  );
  const [selectedResource, setSelectedResource] = useState<string>(
    initialEvaluated.state.resources[0]?.id ?? ""
  );
  const [actionMode, setActionMode] = useState<"request" | "release">(
    "request"
  );
  const [feedbackBanner, setFeedbackBanner] = useState<{
    kind: "error" | "info";
    text: string;
  } | null>(null);

  const [eventLog, setEventLog] = useState<EventLogEntry[]>([
    createLogEntry(
      "system",
      `Loaded preset "${initialPreset.name}" (${initialEvaluated.state.processes.length} processes, ${initialEvaluated.state.resources.length} resources).`
    ),
    createLogEntry(
      "detect",
      initialEvaluated.report.isDeadlocked
        ? `Detection complete: DEADLOCK DETECTED (${initialEvaluated.report.dfs.cycles[0]?.join(" -> ")}).`
        : "Detection complete: System Safe."
    ),
  ]);

  // Animated DFS Walkthrough state
  const [walkthroughActive, setWalkthroughActive] = useState<boolean>(false);
  const [walkthroughIndex, setWalkthroughIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(700);

  // Gemini Explanation state
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const simulatorRef = useRef<HTMLElement | null>(null);

  const appendEvents = useCallback(
    (items: Array<{ type: EventLogType; message: string }>) => {
      if (items.length === 0) return;
      setEventLog((prev) => [
        ...items.map((item) => createLogEntry(item.type, item.message)),
        ...prev,
      ]);
    },
    []
  );

  // Keep selected dropdown values valid whenever nodes change
  useEffect(() => {
    if (
      graph.processes.length > 0 &&
      !graph.processes.some((p) => p.id === selectedProcess)
    ) {
      setSelectedProcess(graph.processes[0].id);
    } else if (graph.processes.length === 0 && selectedProcess !== "") {
      setSelectedProcess("");
    }

    if (
      graph.resources.length > 0 &&
      !graph.resources.some((r) => r.id === selectedResource)
    ) {
      setSelectedResource(graph.resources[0].id);
    } else if (graph.resources.length === 0 && selectedResource !== "") {
      setSelectedResource("");
    }
  }, [graph.processes, graph.resources, selectedProcess, selectedResource]);

  // DFS Walkthrough playback timer
  useEffect(() => {
    if (!walkthroughActive || !isPlaying) return;
    const totalSteps = report.dfs.steps.length;
    if (walkthroughIndex >= totalSteps - 1) {
      setIsPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setWalkthroughIndex((idx) => Math.min(idx + 1, totalSteps - 1));
    }, speedMs);

    return () => window.clearTimeout(timer);
  }, [walkthroughActive, isPlaying, walkthroughIndex, speedMs, report.dfs.steps.length]);

  const executeDetection = useCallback(
    (targetGraph: RAGState, targetMulti: boolean, logRun = true) => {
      const evaluated = runDetectionSuite(targetGraph, targetMulti);
      setGraph(evaluated.state);
      setReport(evaluated.report);
      if (logRun) {
        const msg = evaluated.report.isDeadlocked
          ? `Detection run: DEADLOCK DETECTED — blocked [${evaluated.report.deadlockedProcesses.join(", ")}], cycle ${evaluated.report.dfs.cycles.map((c) => c.join(" -> ")).join(" | ")}.`
          : evaluated.report.hasCycleButSafe
            ? `Detection run: Cycle found, but Banker's matrix verified System Safe (${evaluated.report.bankers.safeSequence.join(" -> ")}).`
            : `Detection run: System Safe (DFS & Kahn's verified acyclic in O(V+E)).`;
        appendEvents([{ type: "detect", message: msg }]);
      }
      return evaluated;
    },
    [appendEvents]
  );

  const commitGraphMutation = useCallback(
    (
      nextGraph: RAGState,
      events: Array<{ type: EventLogType; message: string }>,
      forceDetect = false,
      markCustom = true
    ) => {
      setWalkthroughActive(false);
      setIsPlaying(false);
      setAiExplanation(null);
      setAiError(null);
      if (markCustom) {
        setActivePresetId("custom");
      }
      appendEvents(events);

      if (autoDetect || forceDetect) {
        executeDetection(nextGraph, multiInstanceMode, forceDetect);
      } else {
        setGraph(nextGraph);
      }
    },
    [appendEvents, autoDetect, executeDetection, multiInstanceMode]
  );

  const handleSelectPreset = useCallback(
    (presetId: string) => {
      if (presetId === "custom") {
        setActivePresetId("custom");
        return;
      }
      const found = PRESET_SCENARIOS.find((p) => p.id === presetId);
      if (!found) return;

      const built = found.build();
      const nextMulti = found.recommendedMultiInstance;
      setMultiInstanceMode(nextMulti);
      setActivePresetId(found.id);
      setWalkthroughActive(false);
      setIsPlaying(false);
      setFeedbackBanner(null);
      setAiExplanation(null);
      setAiError(null);

      const evaluated = runDetectionSuite(built, nextMulti);
      setGraph(evaluated.state);
      setReport(evaluated.report);
      appendEvents([
        {
          type: "system",
          message: `Loaded preset "${found.name}".`,
        },
        {
          type: "detect",
          message: evaluated.report.isDeadlocked
            ? `Auto-detected deadlock: ${evaluated.report.dfs.cycles.map((c) => c.join(" -> ")).join(" | ")}.`
            : "Verified System Safe.",
        },
      ]);
    },
    [appendEvents]
  );

  const handleAddProcess = useCallback(
    (customId?: string) => {
      const outcome = addProcessNode(graph, customId);
      setFeedbackBanner({
        kind: outcome.ok ? "info" : "error",
        text: outcome.message,
      });
      if (!outcome.ok) {
        appendEvents(outcome.events);
        return;
      }
      commitGraphMutation(outcome.state, outcome.events);
    },
    [appendEvents, commitGraphMutation, graph]
  );

  const handleAddResource = useCallback(
    (instances: number, customId?: string) => {
      const outcome = addResourceNode(graph, instances, customId);
      setFeedbackBanner({
        kind: outcome.ok ? "info" : "error",
        text: outcome.message,
      });
      if (!outcome.ok) {
        appendEvents(outcome.events);
        return;
      }
      // Automatically enable multi-instance mode if adding a multi-instance resource
      const nextMulti = instances > 1 ? true : multiInstanceMode;
      if (instances > 1 && !multiInstanceMode) {
        setMultiInstanceMode(true);
      }
      setWalkthroughActive(false);
      setIsPlaying(false);
      setAiExplanation(null);
      setAiError(null);
      setActivePresetId("custom");
      appendEvents(outcome.events);
      if (autoDetect) {
        executeDetection(outcome.state, nextMulti, false);
      } else {
        setGraph(outcome.state);
      }
    },
    [appendEvents, autoDetect, executeDetection, graph, multiInstanceMode]
  );

  const handleExecuteAction = useCallback(() => {
    const outcome =
      actionMode === "request"
        ? requestResource(graph, selectedProcess, selectedResource)
        : releaseResource(graph, selectedProcess, selectedResource);

    if (!outcome.ok) {
      setFeedbackBanner({ kind: "error", text: outcome.message });
      appendEvents(outcome.events);
      return;
    }

    setFeedbackBanner({ kind: "info", text: outcome.message });
    commitGraphMutation(outcome.state, outcome.events);
  }, [
    actionMode,
    appendEvents,
    commitGraphMutation,
    graph,
    selectedProcess,
    selectedResource,
  ]);

  const handleRunDetection = useCallback(() => {
    setFeedbackBanner(null);
    executeDetection(graph, multiInstanceMode, true);
  }, [executeDetection, graph, multiInstanceMode]);

  const handleStartDfsWalkthrough = useCallback(() => {
    const evaluated = executeDetection(graph, multiInstanceMode, false);
    if (evaluated.report.dfs.steps.length === 0) return;
    setWalkthroughIndex(0);
    setWalkthroughActive(true);
    setIsPlaying(true);
    appendEvents([
      {
        type: "detect",
        message: `Started animated 3-color DFS walkthrough (${evaluated.report.dfs.steps.length} steps).`,
      },
    ]);
  }, [appendEvents, executeDetection, graph, multiInstanceMode]);

  const handleReset = useCallback(() => {
    setWalkthroughActive(false);
    setIsPlaying(false);
    setFeedbackBanner(null);
    setAiExplanation(null);
    setAiError(null);

    if (activePresetId !== "custom") {
      handleSelectPreset(activePresetId);
    } else {
      const empty = createEmptyRAG();
      const evaluated = runDetectionSuite(empty, multiInstanceMode);
      setGraph(evaluated.state);
      setReport(evaluated.report);
      appendEvents([
        { type: "system", message: "Reset custom graph to empty state." },
      ]);
    }
  }, [activePresetId, appendEvents, handleSelectPreset, multiInstanceMode]);

  const handleAutoLayout = useCallback(() => {
    const arranged = autoLayoutRAG(graph, 760, 480);
    setGraph(arranged);
  }, [graph]);

  const handleMoveNode = useCallback((nodeId: string, x: number, y: number) => {
    setGraph((prev) => moveNode(prev, nodeId, x, y));
  }, []);

  const handleToggleMultiInstance = useCallback(
    (next: boolean) => {
      setMultiInstanceMode(next);
      setAiExplanation(null);
      executeDetection(graph, next, true);
    },
    [executeDetection, graph]
  );

  const handleApplyRecovery = useCallback(
    (victimId: string) => {
      const outcome = terminateProcess(graph, victimId);
      setFeedbackBanner({
        kind: outcome.ok ? "info" : "error",
        text: outcome.message,
      });
      if (!outcome.ok) return;

      setWalkthroughActive(false);
      setIsPlaying(false);
      setAiExplanation(null);
      setActivePresetId("custom");
      appendEvents(outcome.events);
      executeDetection(outcome.state, multiInstanceMode, true);
    },
    [appendEvents, executeDetection, graph, multiInstanceMode]
  );

  const handleExportJson = useCallback(() => {
    const json = serializeRAG(graph, multiInstanceMode);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `deadlocklens-${activePresetId || "graph"}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setFeedbackBanner({
      kind: "info",
      text: "Exported Resource Allocation Graph as JSON.",
    });
    appendEvents([{ type: "system", message: "Exported graph state to JSON." }]);
  }, [activePresetId, appendEvents, graph, multiInstanceMode]);

  const handleImportJson = useCallback(
    (jsonText: string) => {
      try {
        const parsed = deserializeRAG(jsonText);
        const nextMulti =
          typeof parsed.multiInstanceMode === "boolean"
            ? parsed.multiInstanceMode
            : multiInstanceMode;
        setMultiInstanceMode(nextMulti);
        setActivePresetId("custom");
        setWalkthroughActive(false);
        setIsPlaying(false);
        setAiExplanation(null);
        setAiError(null);

        const evaluated = runDetectionSuite(parsed.state, nextMulti);
        setGraph(evaluated.state);
        setReport(evaluated.report);
        setFeedbackBanner({
          kind: "info",
          text: `Imported graph (${evaluated.state.processes.length}P, ${evaluated.state.resources.length}R).`,
        });
        appendEvents([
          {
            type: "system",
            message: `Imported JSON graph (${evaluated.state.processes.length} processes, ${evaluated.state.resources.length} resources).`,
          },
        ]);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to parse JSON graph.";
        setFeedbackBanner({ kind: "error", text: msg });
        appendEvents([{ type: "error", message: `JSON import failed: ${msg}` }]);
      }
    },
    [appendEvents, multiInstanceMode]
  );

  const handleExplainDeadlock = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const edges = getVisualEdges(graph).map((e) => ({
        from: e.from,
        to: e.to,
        type: e.kind,
        count: e.count,
      }));

      const res = await fetch("/api/explain-deadlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          multiInstanceMode,
          isDeadlocked: report.isDeadlocked,
          processes: graph.processes.map((p) => ({
            id: p.id,
            state: p.state,
          })),
          resources: graph.resources.map((r) => ({
            id: r.id,
            instances: r.instances,
            waitQueue: r.waitQueue,
          })),
          edges,
          cycles: report.dfs.cycles,
          deadlockedProcesses: report.deadlockedProcesses,
          victimSuggestion: report.recovery
            ? {
                processId: report.recovery.victimProcessId,
                reason: report.recovery.reason,
              }
            : null,
        }),
      });

      const data = (await res.json()) as {
        explanation?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        throw new Error(
          data.error || `Request failed with status ${res.status}`
        );
      }

      setAiExplanation(data.explanation ?? "");
    } catch (err: unknown) {
      setAiError(
        err instanceof Error
          ? err.message
          : "Unable to generate explanation right now."
      );
    } finally {
      setAiLoading(false);
    }
  }, [graph, multiInstanceMode, report]);

  // Global keyboard shortcuts: D (Detect), S (Step DFS), L (Auto-Layout), R (Reset)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "d") {
        e.preventDefault();
        handleRunDetection();
      } else if (key === "s") {
        e.preventDefault();
        handleStartDfsWalkthrough();
      } else if (key === "l") {
        e.preventDefault();
        handleAutoLayout();
      } else if (key === "r") {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleAutoLayout,
    handleReset,
    handleRunDetection,
    handleStartDfsWalkthrough,
  ]);

  const scrollToSimulator = useCallback(() => {
    simulatorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleLoadPresetAndScroll = useCallback(
    (presetId: string) => {
      handleSelectPreset(presetId);
      scrollToSimulator();
    },
    [handleSelectPreset, scrollToSimulator]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F17] text-slate-100">
      <TopNavBar onLaunchSimulator={scrollToSimulator} />

      <main className="flex-1">
        <HeroSection onLaunchSimulator={scrollToSimulator} />

        {/* THREE-PANEL SIMULATOR DASHBOARD */}
        <section
          id="simulator"
          ref={simulatorRef}
          className="scroll-mt-16 max-w-[1440px] mx-auto px-4 sm:px-6 pt-8 pb-6"
          aria-label="Deadlock Detection Simulator"
        >
          <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_380px] gap-4 items-stretch">
            {/* LEFT PANEL: Controls */}
            <ControlsPanel
              graph={graph}
              activePresetId={activePresetId}
              selectedProcess={selectedProcess}
              selectedResource={selectedResource}
              actionMode={actionMode}
              autoDetect={autoDetect}
              multiInstanceMode={multiInstanceMode}
              feedbackBanner={feedbackBanner}
              onSelectPreset={handleSelectPreset}
              onChangeSelectedProcess={setSelectedProcess}
              onChangeSelectedResource={setSelectedResource}
              onChangeActionMode={setActionMode}
              onAddProcess={handleAddProcess}
              onAddResource={handleAddResource}
              onExecuteAction={handleExecuteAction}
              onRunDetection={handleRunDetection}
              onStartDfsWalkthrough={handleStartDfsWalkthrough}
              onReset={handleReset}
              onToggleAutoDetect={setAutoDetect}
              onToggleMultiInstance={handleToggleMultiInstance}
              onExportJson={handleExportJson}
              onImportJson={handleImportJson}
            />

            {/* CENTER PANEL: Interactive SVG RAG Visualization */}
            <RAGCanvas
              graph={graph}
              report={report}
              onMoveNode={handleMoveNode}
              onAutoLayout={handleAutoLayout}
              walkthroughActive={walkthroughActive}
              walkthroughIndex={walkthroughIndex}
              isPlaying={isPlaying}
              speedMs={speedMs}
              onTogglePlay={() => {
                if (
                  !isPlaying &&
                  walkthroughIndex >= report.dfs.steps.length - 1
                ) {
                  setWalkthroughIndex(0);
                }
                setIsPlaying((prev) => !prev);
              }}
              onStepPrev={() => {
                setIsPlaying(false);
                setWalkthroughIndex((idx) => Math.max(0, idx - 1));
              }}
              onStepNext={() => {
                setIsPlaying(false);
                setWalkthroughIndex((idx) =>
                  Math.min(report.dfs.steps.length - 1, idx + 1)
                );
              }}
              onRestartWalkthrough={() => {
                setWalkthroughIndex(0);
                setIsPlaying(true);
              }}
              onCloseWalkthrough={() => {
                setWalkthroughActive(false);
                setIsPlaying(false);
              }}
              onChangeSpeed={setSpeedMs}
              onSelectNodeForAction={(nodeId, kind) => {
                if (kind === "process") setSelectedProcess(nodeId);
                else setSelectedResource(nodeId);
              }}
            />

            {/* RIGHT PANEL: Detection Results, Matrices, Tables & Event Log */}
            <ResultsPanel
              graph={graph}
              report={report}
              eventLog={eventLog}
              aiExplanation={aiExplanation}
              aiLoading={aiLoading}
              aiError={aiError}
              onApplyRecovery={handleApplyRecovery}
              onExplainDeadlock={handleExplainDeadlock}
              onClearLog={() => setEventLog([])}
            />
          </div>
        </section>

        {/* EDUCATIONAL & REAL-WORLD SECTIONS */}
        <EducationalSections
          onLaunchSimulator={scrollToSimulator}
          onLoadPresetAndScroll={handleLoadPresetAndScroll}
        />
      </main>

      <footer className="border-t border-slate-800/80 py-8 px-6 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>
            DeadlockLens · Operating System Resource Allocation Graph Simulator
          </span>
          <div className="flex items-center gap-6">
            <a
              href="#simulator"
              className="hover:text-slate-300 transition-colors"
            >
              Simulator
            </a>
            <a
              href="#how-it-works"
              className="hover:text-slate-300 transition-colors"
            >
              Algorithms
            </a>
            <a
              href="#real-world"
              className="hover:text-slate-300 transition-colors"
            >
              Real-World Systems
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
