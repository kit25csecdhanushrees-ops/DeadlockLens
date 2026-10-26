import { cloneRAGState } from "./ragGraph";
import {
  BankersResult,
  BankersStep,
  DetectionReport,
  DfsColor,
  DfsResult,
  DfsStep,
  KahnsQueueStep,
  KahnsResult,
  ProcessState,
  RAGState,
  RecoverySuggestion,
} from "./types";

/**
 * Returns active graph node IDs in deterministic order (non-Finished Processes, then Resources).
 */
function getActiveNodeIds(state: RAGState): string[] {
  const activeProcesses = state.processes
    .filter((p) => p.state !== ProcessState.Finished)
    .map((p) => p.id);
  const resources = state.resources.map((r) => r.id);
  return [...activeProcesses, ...resources];
}

/**
 * Rotates a reconstructed cycle [v, ..., u, v] so that it begins with the lexicographically
 * first Process node (e.g., P1 -> R2 -> P2 -> R1 -> P1) for clear, canonical presentation.
 */
function canonicalizeCyclePath(
  rawCycle: string[],
  processSet: Set<string>
): string[] {
  if (rawCycle.length <= 2) return rawCycle;
  const ring = rawCycle.slice(0, -1); // exclude closing duplicate

  let bestIdx = 0;
  let foundProcess = false;
  for (let i = 0; i < ring.length; i++) {
    const node = ring[i];
    if (processSet.has(node)) {
      if (!foundProcess || node.localeCompare(ring[bestIdx]) < 0) {
        bestIdx = i;
        foundProcess = true;
      }
    }
  }

  const rotated = [...ring.slice(bestIdx), ...ring.slice(0, bestIdx)];
  rotated.push(rotated[0]);
  return rotated;
}

/**
 * ============================================================================
 * ALGORITHM 1: Three-Color Depth-First Search (DFS) Cycle Detection
 * ============================================================================
 * Complexity: Time O(V + E), Auxiliary Space O(V)
 *
 * Coloring invariant:
 * - WHITE: Node has not been visited yet.
 * - GREY:  Node is currently in the active DFS recursion stack (ancestors of current node).
 * - BLACK: Node and all its reachable descendants have been completely explored.
 *
 * Back-edge theorem:
 * In a directed graph, encountering an edge (u -> v) where color[v] === GREY proves
 * v is an ancestor of u in the current DFS tree, closing a directed cycle.
 * Using `parent` pointers, we walk backwards from `u` to `v` to reconstruct the exact cycle path.
 * We initiate DFS from every remaining WHITE vertex to cover all disconnected components.
 */
export function detectCyclesDFS(state: RAGState): DfsResult {
  const activeIds = getActiveNodeIds(state);
  const activeSet = new Set(activeIds);
  const processSet = new Set(state.processes.map((p) => p.id));

  const colors: Record<string, DfsColor> = {};
  for (const id of activeIds) {
    colors[id] = DfsColor.White;
  }

  const parent = new Map<string, string | null>();
  const recursionStack: string[] = [];
  const steps: DfsStep[] = [];
  const cycles: string[][] = [];
  const seenCycleSignatures = new Set<string>();
  const cycleNodeSet = new Set<string>();
  const cycleEdgeKeys = new Set<string>();
  const cycleEdges: Array<{ from: string; to: string }> = [];

  let totalEdges = 0;
  for (const id of activeIds) {
    const targets = (state.adjacency.get(id) ?? []).filter((t) =>
      activeSet.has(t)
    );
    totalEdges += targets.length;
  }

  const recordStep = (
    partial: Omit<DfsStep, "stepIndex" | "colors" | "recursionStack">
  ) => {
    steps.push({
      stepIndex: steps.length,
      colors: { ...colors },
      recursionStack: [...recursionStack],
      ...partial,
    });
  };

  recordStep({
    type: "start",
    currentNode: null,
    description: `Initialized ${activeIds.length} nodes to WHITE (unvisited).`,
  });

  function dfsVisit(u: string) {
    colors[u] = DfsColor.Grey;
    recursionStack.push(u);

    recordStep({
      type: "discover",
      currentNode: u,
      description: `Enter ${u}: mark WHITE -> GREY. Active stack: [${recursionStack.join(" -> ")}].`,
    });

    // Deduplicate parallel multi-edges for graph reachability while preserving order
    const rawNeighbors = (state.adjacency.get(u) ?? []).filter((v) =>
      activeSet.has(v)
    );
    const uniqueNeighbors = Array.from(new Set(rawNeighbors));

    for (const v of uniqueNeighbors) {
      recordStep({
        type: "inspect-edge",
        currentNode: u,
        edge: { from: u, to: v },
        description: `Inspect directed edge ${u} -> ${v} (${v} is ${colors[v]}).`,
      });

      if (colors[v] === DfsColor.Grey) {
        // Back edge to an active ancestor in the recursion stack -> CYCLE FOUND!
        const chain: string[] = [u];
        let cursor: string | null | undefined = u;
        const guard = new Set<string>([u]);

        while (cursor && cursor !== v) {
          const prev: string | null = parent.get(cursor) ?? null;
          if (!prev || guard.has(prev)) break;
          guard.add(prev);
          chain.push(prev);
          cursor = prev;
        }

        chain.reverse(); // [v, ..., u]
        const rawCycle = [...chain, v];
        const canonical = canonicalizeCyclePath(rawCycle, processSet);
        const signature = canonical.join("->");

        if (!seenCycleSignatures.has(signature)) {
          seenCycleSignatures.add(signature);
          cycles.push(canonical);

          for (let i = 0; i < canonical.length - 1; i++) {
            const a = canonical[i];
            const b = canonical[i + 1];
            cycleNodeSet.add(a);
            cycleNodeSet.add(b);
            const eKey = `${a}->${b}`;
            if (!cycleEdgeKeys.has(eKey)) {
              cycleEdgeKeys.add(eKey);
              cycleEdges.push({ from: a, to: b });
            }
          }
        }

        recordStep({
          type: "back-edge",
          currentNode: u,
          edge: { from: u, to: v },
          cycleFound: canonical,
          description: `BACK EDGE ${u} -> ${v} (${v} is GREY)! Cycle reconstructed: ${canonical.join(" -> ")}.`,
        });
      } else if (colors[v] === DfsColor.White) {
        parent.set(v, u);
        dfsVisit(v);
      } else {
        recordStep({
          type: "skip-visited",
          currentNode: u,
          edge: { from: u, to: v },
          description: `Target ${v} is already BLACK (fully explored); cross/forward edge causes no cycle.`,
        });
      }
    }

    colors[u] = DfsColor.Black;
    recursionStack.pop();

    recordStep({
      type: "finish",
      currentNode: u,
      description: `Finish ${u}: mark GREY -> BLACK and pop from recursion stack.`,
    });
  }

  // Launch DFS from every WHITE vertex so disconnected components are fully covered
  for (const nodeId of activeIds) {
    if (colors[nodeId] === DfsColor.White) {
      parent.set(nodeId, null);
      dfsVisit(nodeId);
    }
  }

  return {
    hasCycle: cycles.length > 0,
    cycles,
    cycleNodes: Array.from(cycleNodeSet),
    cycleEdges,
    steps,
    vertexCount: activeIds.length,
    edgeCount: totalEdges,
    complexity: `O(V + E) — V=${activeIds.length}, E=${totalEdges}`,
  };
}

/**
 * ============================================================================
 * ALGORITHM 2: Kahn's Algorithm (BFS Topological Sort)
 * ============================================================================
 * Complexity: Time O(V + E), Auxiliary Space O(V)
 *
 * Procedure:
 * 1. Compute initial in-degree for every active vertex in the RAG.
 * 2. Enqueue all vertices with in-degree 0 into a FIFO queue.
 * 3. Repeatedly dequeue vertex `u`, append `u` to `topologicalOrder`, and decrement
 *    the in-degree of each outgoing neighbor `v`. Whenever `inDegree[v]` reaches 0, enqueue `v`.
 * 4. If `topologicalOrder.length < V`, at least one cycle exists, and the leftover
 *    unprocessed vertices (`inDegree > 0`) form the cycle/blocked set.
 */
export function detectDeadlockKahns(state: RAGState): KahnsResult {
  const activeIds = getActiveNodeIds(state);
  const activeSet = new Set(activeIds);
  const processSet = new Set(state.processes.map((p) => p.id));

  const inDegree: Record<string, number> = {};
  for (const id of activeIds) {
    inDegree[id] = 0;
  }

  let totalEdges = 0;
  for (const u of activeIds) {
    const targets = (state.adjacency.get(u) ?? []).filter((v) =>
      activeSet.has(v)
    );
    totalEdges += targets.length;
    for (const v of targets) {
      inDegree[v] = (inDegree[v] ?? 0) + 1;
    }
  }

  const initialInDegrees = { ...inDegree };
  const queue: string[] = activeIds.filter((id) => inDegree[id] === 0);
  const topologicalOrder: string[] = [];
  const queueSteps: KahnsQueueStep[] = [];

  let stepCounter = 1;
  while (queue.length > 0) {
    const u = queue.shift()!;
    topologicalOrder.push(u);

    const targets = (state.adjacency.get(u) ?? []).filter((v) =>
      activeSet.has(v)
    );

    // Group multiplicity per neighbor so step logs are crisp and readable
    const multMap = new Map<string, number>();
    for (const v of targets) {
      multMap.set(v, (multMap.get(v) ?? 0) + 1);
    }

    const decremented: Array<{ nodeId: string; newInDegree: number }> = [];
    const enqueued: string[] = [];

    for (const [v, count] of multMap.entries()) {
      inDegree[v] -= count;
      decremented.push({ nodeId: v, newInDegree: inDegree[v] });
      if (inDegree[v] === 0) {
        queue.push(v);
        enqueued.push(v);
      }
    }

    queueSteps.push({
      step: stepCounter++,
      dequeued: u,
      queueAfterDequeue: [...queue],
      decremented,
      enqueued,
    });
  }

  const hasCycle = topologicalOrder.length < activeIds.length;
  const processedSet = new Set(topologicalOrder);
  const stuckNodes = activeIds.filter((id) => !processedSet.has(id));
  const stuckProcesses = stuckNodes.filter((id) => processSet.has(id));

  return {
    hasCycle,
    initialInDegrees,
    finalInDegrees: { ...inDegree },
    queueSteps,
    topologicalOrder,
    stuckNodes,
    stuckProcesses,
    processedCount: topologicalOrder.length,
    vertexCount: activeIds.length,
    edgeCount: totalEdges,
    complexity: `O(V + E) — V=${activeIds.length}, E=${totalEdges}`,
  };
}

/**
 * ============================================================================
 * ALGORITHM 3: Multi-Instance Banker's-Style Deadlock Detection Matrix
 * ============================================================================
 * When resources have multiple instances, a cycle in the RAG is a NECESSARY
 * condition for deadlock, NOT a SUFFICIENT condition.
 *
 * Uses Available (1 x m), Allocation (n x m), and Request (n x m) matrices:
 * 1. Work = Available. Mark Finish[i] = true for processes holding & requesting 0 instances.
 * 2. Find an unfinished process P_i whose Request[i] <= Work (element-wise).
 * 3. Simulate P_i finishing and releasing its resources: Work += Allocation[i], Finish[i] = true.
 * 4. Repeat until no such P_i exists. Any P_i with Finish[i] === false is confirmed deadlocked.
 */
export function detectMultiInstanceBankers(state: RAGState): BankersResult {
  const activeProcs = state.processes.filter(
    (p) => p.state !== ProcessState.Finished
  );
  const resources = state.resources;

  const n = activeProcs.length;
  const m = resources.length;

  const processIds = activeProcs.map((p) => p.id);
  const resourceIds = resources.map((r) => r.id);
  const totalInstances = resources.map((r) => r.instances);

  const allocation: number[][] = Array.from({ length: n }, () =>
    Array(m).fill(0)
  );
  const request: number[][] = Array.from({ length: n }, () =>
    Array(m).fill(0)
  );

  const procIndex = new Map<string, number>();
  processIds.forEach((id, i) => procIndex.set(id, i));

  const resIndex = new Map<string, number>();
  resourceIds.forEach((id, j) => resIndex.set(id, j));

  // Populate Allocation[i][j] from assignment edges R_j -> P_i
  for (let j = 0; j < m; j++) {
    const rId = resourceIds[j];
    const assignedProcs = state.adjacency.get(rId) ?? [];
    for (const pId of assignedProcs) {
      const i = procIndex.get(pId);
      if (i !== undefined) {
        allocation[i][j] += 1;
      }
    }
  }

  // Populate Request[i][j] from request edges P_i -> R_j
  for (let i = 0; i < n; i++) {
    const pId = processIds[i];
    const requestedResources = state.adjacency.get(pId) ?? [];
    for (const rId of requestedResources) {
      const j = resIndex.get(rId);
      if (j !== undefined) {
        request[i][j] += 1;
      }
    }
  }

  // Available[j] = Total[j] - sum_i(Allocation[i][j])
  const available: number[] = totalInstances.map((tot, j) => {
    let allocatedSum = 0;
    for (let i = 0; i < n; i++) {
      allocatedSum += allocation[i][j];
    }
    return Math.max(0, tot - allocatedSum);
  });

  const work = [...available];
  const finish: boolean[] = Array(n).fill(false);
  const safeSequence: string[] = [];
  const steps: BankersStep[] = [];

  // Processes holding 0 and requesting 0 cannot be deadlocked; include them cleanly in safe sequence
  for (let i = 0; i < n; i++) {
    const hasAlloc = allocation[i].some((val) => val > 0);
    const hasReq = request[i].some((val) => val > 0);
    if (!hasAlloc && !hasReq) {
      finish[i] = true;
      safeSequence.push(processIds[i]);
    }
  }

  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < n; i++) {
      if (finish[i]) continue;

      const canSatisfy = request[i].every((reqCount, j) => reqCount <= work[j]);
      if (canSatisfy) {
        const workBefore = [...work];
        for (let j = 0; j < m; j++) {
          work[j] += allocation[i][j];
        }
        finish[i] = true;
        safeSequence.push(processIds[i]);
        steps.push({
          step: steps.length + 1,
          processId: processIds[i],
          requestRow: [...request[i]],
          workBefore,
          allocationRow: [...allocation[i]],
          workAfter: [...work],
        });
        progress = true;
      }
    }
  }

  const deadlockedProcesses = processIds.filter((_, i) => !finish[i]);

  return {
    isDeadlocked: deadlockedProcesses.length > 0,
    processIds,
    resourceIds,
    totalInstances,
    available,
    allocation,
    request,
    safeSequence,
    deadlockedProcesses,
    steps,
  };
}

/**
 * Selects an optimal victim process for recovery (fewest resources held among cycle participants)
 * to minimize rollback cost while breaking at least one circular wait.
 */
export function computeRecoverySuggestion(
  state: RAGState,
  isDeadlocked: boolean,
  deadlockedProcesses: string[],
  cycles: string[][]
): RecoverySuggestion | null {
  if (!isDeadlocked || deadlockedProcesses.length === 0) {
    return null;
  }

  const processSet = new Set(state.processes.map((p) => p.id));
  const cycleProcesses = new Set<string>();
  for (const cycle of cycles) {
    for (const nodeId of cycle) {
      if (processSet.has(nodeId)) {
        cycleProcesses.add(nodeId);
      }
    }
  }

  // Prefer candidates directly inside a cycle that hold >= 1 resource so terminating them breaks the cycle
  const candidates = deadlockedProcesses.map((pid) => {
    const heldList: string[] = [];
    const unblockedSet = new Set<string>();

    for (const r of state.resources) {
      const assigned = (state.adjacency.get(r.id) ?? []).filter(
        (target) => target === pid
      ).length;
      if (assigned > 0) {
        heldList.push(assigned > 1 ? `${assigned}x ${r.id}` : r.id);
        for (const waiter of r.waitQueue) {
          if (waiter !== pid) unblockedSet.add(waiter);
        }
      }
    }

    const totalHeld = state.resources.reduce((acc, r) => {
      return (
        acc +
        (state.adjacency.get(r.id) ?? []).filter((target) => target === pid)
          .length
      );
    }, 0);

    return {
      pid,
      inCycle: cycleProcesses.has(pid),
      totalHeld,
      heldSummary: heldList.length > 0 ? heldList.join(", ") : "none",
      unblocked: Array.from(unblockedSet),
    };
  });

  const cycleHoldingCandidates = candidates.filter(
    (c) => c.inCycle && c.totalHeld > 0
  );
  const pool =
    cycleHoldingCandidates.length > 0
      ? cycleHoldingCandidates
      : candidates.filter((c) => c.totalHeld > 0).length > 0
        ? candidates.filter((c) => c.totalHeld > 0)
        : candidates;

  pool.sort((a, b) => {
    if (a.totalHeld !== b.totalHeld) return a.totalHeld - b.totalHeld;
    if (b.unblocked.length !== a.unblocked.length) {
      return b.unblocked.length - a.unblocked.length;
    }
    return a.pid.localeCompare(b.pid);
  });

  const best = pool[0];
  const unblockedNote =
    best.unblocked.length > 0
      ? `immediately waking ${best.unblocked.join(", ")}`
      : "releasing locked resources back to the pool";

  return {
    victimProcessId: best.pid,
    heldResourcesCount: best.totalHeld,
    heldResourcesSummary: best.heldSummary,
    waitingProcessesUnblocked: best.unblocked,
    reason: `${best.pid} holds the fewest allocated resources (${best.totalHeld} instance${best.totalHeld === 1 ? "" : "s"}: ${best.heldSummary}) among cycle participants, minimizing state rollback cost while ${unblockedNote}.`,
  };
}

/**
 * Runs DFS, Kahn's algorithm, and Banker's matrix detection together, returning both
 * the comprehensive DetectionReport and an updated RAGState with accurate ProcessStates.
 */
export function runDetectionSuite(
  state: RAGState,
  multiInstanceMode: boolean
): { state: RAGState; report: DetectionReport } {
  const dfs = detectCyclesDFS(state);
  const kahns = detectDeadlockKahns(state);
  const bankers = detectMultiInstanceBankers(state);

  // DFS and Kahn's both test directed cycle existence in O(V+E); verify agreement
  const algorithmsAgree = dfs.hasCycle === kahns.hasCycle;

  let isDeadlocked: boolean;
  let deadlockedProcesses: string[];

  if (multiInstanceMode) {
    // Cycle is necessary, Banker's confirms sufficiency
    isDeadlocked = dfs.hasCycle && bankers.isDeadlocked;
    deadlockedProcesses = isDeadlocked ? bankers.deadlockedProcesses : [];
  } else {
    // Single-instance RAG rule: a cycle is both necessary and sufficient for deadlock.
    // Processes in any cycle (plus any processes transitively blocked waiting on them, captured by bankers) are deadlocked.
    isDeadlocked = dfs.hasCycle;
    if (isDeadlocked) {
      const procSet = new Set(state.processes.map((p) => p.id));
      const cycleProcs = dfs.cycleNodes.filter((id) => procSet.has(id));
      const combined = new Set([...cycleProcs, ...bankers.deadlockedProcesses]);
      deadlockedProcesses = Array.from(combined);
    } else {
      deadlockedProcesses = [];
    }
  }

  const hasCycleButSafe = multiInstanceMode && dfs.hasCycle && !isDeadlocked;
  const recovery = computeRecoverySuggestion(
    state,
    isDeadlocked,
    deadlockedProcesses,
    dfs.cycles
  );

  // Sync ProcessState on cloned graph
  const nextState = cloneRAGState(state);
  const deadlockedSet = new Set(deadlockedProcesses);

  for (const proc of nextState.processes) {
    if (proc.state === ProcessState.Finished) continue;
    if (deadlockedSet.has(proc.id)) {
      proc.state = ProcessState.Deadlocked;
    } else {
      const pendingRequests = (nextState.adjacency.get(proc.id) ?? []).length;
      proc.state =
        pendingRequests > 0 ? ProcessState.Waiting : ProcessState.Running;
    }
  }

  return {
    state: nextState,
    report: {
      multiInstanceMode,
      isDeadlocked,
      hasCycleButSafe,
      algorithmsAgree,
      deadlockedProcesses,
      dfs,
      kahns,
      bankers,
      recovery,
    },
  };
}
