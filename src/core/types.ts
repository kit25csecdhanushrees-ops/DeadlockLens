/**
 * Pure TypeScript data model types for DeadlockLens Resource Allocation Graph (RAG).
 * Kept completely decoupled from React/UI layers.
 */

export enum ProcessState {
  Running = "Running",
  Waiting = "Waiting",
  Deadlocked = "Deadlocked",
  Finished = "Finished",
}

export enum DfsColor {
  White = "WHITE",
  Grey = "GREY",
  Black = "BLACK",
}

export interface ProcessNode {
  id: string;
  label: string;
  state: ProcessState;
  x: number;
  y: number;
}

export interface ResourceNode {
  id: string;
  label: string;
  instances: number;
  /** FIFO wait queue of process IDs waiting to acquire an instance of this resource */
  waitQueue: string[];
  x: number;
  y: number;
}

export type EdgeKind = "request" | "assignment";

export interface VisualEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  count: number;
  hasReverse: boolean;
}

export type EventLogType =
  | "request"
  | "acquire"
  | "release"
  | "detect"
  | "recovery"
  | "system"
  | "error";

export interface EventLogEntry {
  id: string;
  timestamp: string;
  type: EventLogType;
  message: string;
}

/**
 * Core Resource Allocation Graph state.
 * Directed edges are stored in an adjacency list Map<string, string[]>:
 * - Request edge: Process -> Resource (process is waiting for an instance)
 * - Assignment edge: Resource -> Process (resource instance is held by process)
 */
export interface RAGState {
  processes: ProcessNode[];
  resources: ResourceNode[];
  adjacency: Map<string, string[]>;
}

export interface ActionOutcome {
  ok: boolean;
  state: RAGState;
  message: string;
  events: Array<{ type: EventLogType; message: string }>;
}

export type DfsStepType =
  | "start"
  | "discover"
  | "inspect-edge"
  | "back-edge"
  | "tree-advance"
  | "skip-visited"
  | "finish";

export interface DfsStep {
  stepIndex: number;
  type: DfsStepType;
  currentNode: string | null;
  edge?: { from: string; to: string };
  colors: Record<string, DfsColor>;
  recursionStack: string[];
  cycleFound?: string[];
  description: string;
}

export interface DfsResult {
  hasCycle: boolean;
  /** Reconstructed cycle paths, e.g. [["P1", "R2", "P2", "R1", "P1"]] */
  cycles: string[][];
  cycleNodes: string[];
  cycleEdges: Array<{ from: string; to: string }>;
  steps: DfsStep[];
  vertexCount: number;
  edgeCount: number;
  complexity: string;
}

export interface KahnsQueueStep {
  step: number;
  dequeued: string;
  queueAfterDequeue: string[];
  decremented: Array<{ nodeId: string; newInDegree: number }>;
  enqueued: string[];
}

export interface KahnsResult {
  hasCycle: boolean;
  initialInDegrees: Record<string, number>;
  finalInDegrees: Record<string, number>;
  queueSteps: KahnsQueueStep[];
  topologicalOrder: string[];
  /** Leftover nodes with remaining in-degree > 0 when processed count < total nodes */
  stuckNodes: string[];
  stuckProcesses: string[];
  processedCount: number;
  vertexCount: number;
  edgeCount: number;
  complexity: string;
}

export interface BankersStep {
  step: number;
  processId: string;
  requestRow: number[];
  workBefore: number[];
  allocationRow: number[];
  workAfter: number[];
}

export interface BankersResult {
  isDeadlocked: boolean;
  processIds: string[];
  resourceIds: string[];
  totalInstances: number[];
  available: number[];
  allocation: number[][];
  request: number[][];
  safeSequence: string[];
  deadlockedProcesses: string[];
  steps: BankersStep[];
}

export interface RecoverySuggestion {
  victimProcessId: string;
  heldResourcesCount: number;
  heldResourcesSummary: string;
  waitingProcessesUnblocked: string[];
  reason: string;
}

export interface DetectionReport {
  multiInstanceMode: boolean;
  isDeadlocked: boolean;
  hasCycleButSafe: boolean;
  algorithmsAgree: boolean;
  deadlockedProcesses: string[];
  dfs: DfsResult;
  kahns: KahnsResult;
  bankers: BankersResult;
  recovery: RecoverySuggestion | null;
}

export interface SerializedRAG {
  version: number;
  multiInstanceMode?: boolean;
  processes: ProcessNode[];
  resources: ResourceNode[];
  adjacency: Record<string, string[]>;
}

export interface PresetDefinition {
  id: string;
  name: string;
  subtitle: string;
  recommendedMultiInstance: boolean;
  build: () => RAGState;
}
