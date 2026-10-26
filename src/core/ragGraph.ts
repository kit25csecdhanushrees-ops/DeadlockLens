import {
  ActionOutcome,
  EventLogType,
  ProcessNode,
  ProcessState,
  RAGState,
  ResourceNode,
  SerializedRAG,
  VisualEdge,
} from "./types";

/**
 * Creates a deep clone of a RAGState so every state transition remains pure and immutable.
 */
export function cloneRAGState(state: RAGState): RAGState {
  const adjacency = new Map<string, string[]>();
  for (const [key, targets] of state.adjacency.entries()) {
    adjacency.set(key, [...targets]);
  }
  return {
    processes: state.processes.map((p) => ({ ...p })),
    resources: state.resources.map((r) => ({
      ...r,
      waitQueue: [...r.waitQueue],
    })),
    adjacency,
  };
}

export function createEmptyRAG(): RAGState {
  return {
    processes: [],
    resources: [],
    adjacency: new Map<string, string[]>(),
  };
}

/**
 * Generates the next available sequential ID (e.g. P1, P2, ... or R1, R2, ...).
 */
export function getNextNodeId(
  existingIds: string[],
  prefix: "P" | "R"
): string {
  const used = new Set(existingIds.map((id) => id.toUpperCase()));
  let index = 1;
  while (used.has(`${prefix}${index}`)) {
    index += 1;
  }
  return `${prefix}${index}`;
}

export function isProcessId(state: RAGState, nodeId: string): boolean {
  return state.processes.some((p) => p.id === nodeId);
}

export function isResourceId(state: RAGState, nodeId: string): boolean {
  return state.resources.some((r) => r.id === nodeId);
}

/**
 * Counts how many instances of `resourceId` are currently allocated across all processes.
 */
export function getAllocatedCount(state: RAGState, resourceId: string): number {
  return (state.adjacency.get(resourceId) ?? []).length;
}

/**
 * Counts how many instances of `resourceId` are held specifically by `processId`.
 */
export function getHeldByProcessCount(
  state: RAGState,
  processId: string,
  resourceId: string
): number {
  return (state.adjacency.get(resourceId) ?? []).filter(
    (pid) => pid === processId
  ).length;
}

/**
 * Adds a new Process node to the Resource Allocation Graph.
 */
export function addProcessNode(
  state: RAGState,
  customId?: string,
  customLabel?: string,
  coords?: { x: number; y: number }
): ActionOutcome {
  const next = cloneRAGState(state);
  const allIds = [
    ...next.processes.map((p) => p.id),
    ...next.resources.map((r) => r.id),
  ];

  const id = (customId?.trim() || getNextNodeId(allIds, "P")).replace(
    /\s+/g,
    "_"
  );
  if (allIds.some((existing) => existing.toLowerCase() === id.toLowerCase())) {
    return {
      ok: false,
      state,
      message: `Cannot add process "${id}": a node with that ID already exists.`,
      events: [
        {
          type: "error",
          message: `Blocked duplicate node ID "${id}".`,
        },
      ],
    };
  }

  const count = next.processes.length;
  const defaultX = 140 + (count % 5) * 145;
  const defaultY = 125 + Math.floor(count / 5) * 90;

  const newProcess: ProcessNode = {
    id,
    label: customLabel?.trim() || id,
    state: ProcessState.Running,
    x: coords?.x ?? defaultX,
    y: coords?.y ?? defaultY,
  };

  next.processes.push(newProcess);
  next.adjacency.set(id, []);

  return {
    ok: true,
    state: next,
    message: `Added process ${id} (Running).`,
    events: [{ type: "system", message: `Created process ${id} (Running).` }],
  };
}

/**
 * Adds a new Resource node with a configurable instance count (default 1).
 */
export function addResourceNode(
  state: RAGState,
  instances = 1,
  customId?: string,
  customLabel?: string,
  coords?: { x: number; y: number }
): ActionOutcome {
  const sanitizedInstances = Math.max(1, Math.min(8, Math.floor(instances)));
  const next = cloneRAGState(state);
  const allIds = [
    ...next.processes.map((p) => p.id),
    ...next.resources.map((r) => r.id),
  ];

  const id = (customId?.trim() || getNextNodeId(allIds, "R")).replace(
    /\s+/g,
    "_"
  );
  if (allIds.some((existing) => existing.toLowerCase() === id.toLowerCase())) {
    return {
      ok: false,
      state,
      message: `Cannot add resource "${id}": a node with that ID already exists.`,
      events: [
        {
          type: "error",
          message: `Blocked duplicate node ID "${id}".`,
        },
      ],
    };
  }

  const count = next.resources.length;
  const defaultX = 140 + (count % 5) * 145;
  const defaultY = 345 + Math.floor(count / 5) * 95;

  const newResource: ResourceNode = {
    id,
    label: customLabel?.trim() || id,
    instances: sanitizedInstances,
    waitQueue: [],
    x: coords?.x ?? defaultX,
    y: coords?.y ?? defaultY,
  };

  next.resources.push(newResource);
  next.adjacency.set(id, []);

  return {
    ok: true,
    state: next,
    message: `Added resource ${id} with ${sanitizedInstances} instance${sanitizedInstances > 1 ? "s" : ""}.`,
    events: [
      {
        type: "system",
        message: `Created resource ${id} (${sanitizedInstances} instance${sanitizedInstances > 1 ? "s" : ""}).`,
      },
    ],
  };
}

/**
 * Simulation Rule: request(p, r)
 * - Blocks invalid actions (missing nodes, finished process, duplicate pending request,
 *   or requesting a resource when the process already holds all total instances of it).
 * - If an instance of `r` is free, grants it immediately via assignment edge `R -> P`.
 * - Otherwise adds request edge `P -> R`, enqueues `P` in `R`'s FIFO wait queue, and marks `P` as Waiting.
 */
export function requestResource(
  state: RAGState,
  processId: string,
  resourceId: string
): ActionOutcome {
  const next = cloneRAGState(state);
  const proc = next.processes.find((p) => p.id === processId);
  const res = next.resources.find((r) => r.id === resourceId);

  if (!proc || !res) {
    return {
      ok: false,
      state,
      message: `Invalid request: select both a valid Process and Resource.`,
      events: [
        {
          type: "error",
          message: `Invalid request(${processId}, ${resourceId}): node not found.`,
        },
      ],
    };
  }

  if (proc.state === ProcessState.Finished) {
    return {
      ok: false,
      state,
      message: `Action blocked: ${proc.id} is Finished (terminated) and cannot request resources.`,
      events: [
        {
          type: "error",
          message: `Blocked request(${proc.id}, ${res.id}): ${proc.id} is already Finished.`,
        },
      ],
    };
  }

  const procOut = next.adjacency.get(proc.id) ?? [];
  if (procOut.includes(res.id)) {
    return {
      ok: false,
      state,
      message: `Duplicate request blocked: ${proc.id} already has a pending request edge (${proc.id} -> ${res.id}) in ${res.id}'s wait queue.`,
      events: [
        {
          type: "error",
          message: `Blocked duplicate request(${proc.id}, ${res.id}): already waiting.`,
        },
      ],
    };
  }

  const heldByProc = getHeldByProcessCount(next, proc.id, res.id);
  if (heldByProc >= res.instances) {
    return {
      ok: false,
      state,
      message: `Invalid request blocked: ${proc.id} already holds all ${res.instances}/${res.instances} instance${res.instances > 1 ? "s" : ""} of ${res.id}.`,
      events: [
        {
          type: "error",
          message: `Blocked request(${proc.id}, ${res.id}): ${proc.id} already holds ${heldByProc}/${res.instances} instances.`,
        },
      ],
    };
  }

  const resOut = next.adjacency.get(res.id) ?? [];
  const freeInstances = res.instances - resOut.length;

  if (freeInstances > 0) {
    resOut.push(proc.id);
    next.adjacency.set(res.id, resOut);
    // Keep Waiting if waiting on some other resource, else Running
    proc.state =
      procOut.length > 0 ? ProcessState.Waiting : ProcessState.Running;

    return {
      ok: true,
      state: next,
      message: `Granted ${res.id} to ${proc.id} immediately (assignment edge ${res.id} -> ${proc.id}).`,
      events: [
        {
          type: "acquire",
          message: `${proc.id} requested ${res.id} -> granted immediately (${res.id} -> ${proc.id}).`,
        },
      ],
    };
  } else {
    procOut.push(res.id);
    next.adjacency.set(proc.id, procOut);
    if (!res.waitQueue.includes(proc.id)) {
      res.waitQueue.push(proc.id);
    }
    proc.state = ProcessState.Waiting;

    return {
      ok: true,
      state: next,
      message: `${res.id} has 0 free instances. Added request edge ${proc.id} -> ${res.id}; ${proc.id} is now Waiting (FIFO #${res.waitQueue.indexOf(proc.id) + 1}).`,
      events: [
        {
          type: "request",
          message: `${proc.id} requested ${res.id} -> busy; ${proc.id} queued (Waiting, ${proc.id} -> ${res.id}).`,
        },
      ],
    };
  }
}

/**
 * Simulation Rule: release(p, r)
 * - Blocks releasing a resource not currently held by `p`.
 * - Removes one assignment edge `R -> P`, frees the instance, and if processes are waiting
 *   in `R`'s FIFO wait queue, immediately grants the freed instance to the first waiting process.
 */
export function releaseResource(
  state: RAGState,
  processId: string,
  resourceId: string
): ActionOutcome {
  const next = cloneRAGState(state);
  const proc = next.processes.find((p) => p.id === processId);
  const res = next.resources.find((r) => r.id === resourceId);

  if (!proc || !res) {
    return {
      ok: false,
      state,
      message: `Invalid release: select both a valid Process and Resource.`,
      events: [
        {
          type: "error",
          message: `Invalid release(${processId}, ${resourceId}): node not found.`,
        },
      ],
    };
  }

  const resOut = next.adjacency.get(res.id) ?? [];
  const assignIdx = resOut.indexOf(proc.id);
  if (assignIdx === -1) {
    return {
      ok: false,
      state,
      message: `Release blocked: ${proc.id} does not currently hold any instance of ${res.id}.`,
      events: [
        {
          type: "error",
          message: `Blocked release(${proc.id}, ${res.id}): resource not held by ${proc.id}.`,
        },
      ],
    };
  }

  // Remove one assignment edge R -> P
  resOut.splice(assignIdx, 1);
  next.adjacency.set(res.id, resOut);

  const events: Array<{ type: EventLogType; message: string }> = [
    {
      type: "release",
      message: `${proc.id} released 1 instance of ${res.id}.`,
    },
  ];

  // Grant freed instance to the first valid waiting process in FIFO waitQueue
  let grantedTo: string | null = null;
  while (res.waitQueue.length > 0) {
    const candidateId = res.waitQueue.shift()!;
    const candidateProc = next.processes.find((p) => p.id === candidateId);
    const candidateOut = next.adjacency.get(candidateId) ?? [];
    const reqIdx = candidateOut.indexOf(res.id);

    if (
      candidateProc &&
      candidateProc.state !== ProcessState.Finished &&
      reqIdx !== -1
    ) {
      // Remove request edge candidate -> res
      candidateOut.splice(reqIdx, 1);
      next.adjacency.set(candidateId, candidateOut);

      // Add assignment edge res -> candidate
      resOut.push(candidateId);
      next.adjacency.set(res.id, resOut);

      // Update candidate state
      candidateProc.state =
        candidateOut.length === 0 ? ProcessState.Running : ProcessState.Waiting;

      grantedTo = candidateId;
      events.push({
        type: "acquire",
        message: `FIFO wake-up: ${res.id} granted to waiting ${candidateId} (${res.id} -> ${candidateId}); ${candidateId} is now ${candidateProc.state}.`,
      });
      break;
    }
  }

  const summary = grantedTo
    ? `${proc.id} released ${res.id}; freed instance automatically granted to ${grantedTo} via FIFO queue.`
    : `${proc.id} released ${res.id}; instance is now free.`;

  return {
    ok: true,
    state: next,
    message: summary,
    events,
  };
}

/**
 * Terminates a victim process for deadlock recovery:
 * - Marks victim as Finished.
 * - Cancels all pending requests from the victim and removes it from wait queues.
 * - Releases every resource instance held by the victim, granting each to FIFO waiters.
 */
export function terminateProcess(
  state: RAGState,
  victimId: string
): ActionOutcome {
  let next = cloneRAGState(state);
  const victim = next.processes.find((p) => p.id === victimId);

  if (!victim) {
    return {
      ok: false,
      state,
      message: `Cannot terminate ${victimId}: process not found.`,
      events: [],
    };
  }

  // Cancel all outgoing request edges from victim
  next.adjacency.set(victim.id, []);
  for (const r of next.resources) {
    r.waitQueue = r.waitQueue.filter((pid) => pid !== victim.id);
  }

  const events: Array<{ type: EventLogType; message: string }> = [
    {
      type: "recovery",
      message: `Recovery initiated: terminated victim process ${victim.id} -> Finished.`,
    },
  ];

  // Release every held resource instance via standard FIFO release rules
  for (const r of [...next.resources]) {
    let heldCount = getHeldByProcessCount(next, victim.id, r.id);
    while (heldCount > 0) {
      const rel = releaseResource(next, victim.id, r.id);
      next = rel.state;
      events.push(...rel.events);
      heldCount -= 1;
    }
  }

  const updatedVictim = next.processes.find((p) => p.id === victimId);
  if (updatedVictim) {
    updatedVictim.state = ProcessState.Finished;
  }

  return {
    ok: true,
    state: next,
    message: `Terminated ${victimId} (Finished) and reclaimed all held resources.`,
    events,
  };
}

/**
 * Updates node coordinates during interactive drag on the SVG canvas.
 */
export function moveNode(
  state: RAGState,
  nodeId: string,
  x: number,
  y: number
): RAGState {
  const next = cloneRAGState(state);
  const p = next.processes.find((item) => item.id === nodeId);
  if (p) {
    p.x = x;
    p.y = y;
    return next;
  }
  const r = next.resources.find((item) => item.id === nodeId);
  if (r) {
    r.x = x;
    r.y = y;
  }
  return next;
}

/**
 * Computes clean geometric positions for all Processes and Resources.
 * Uses an alternating circular ring when #P == #R >= 3 and edges form a ring,
 * otherwise uses balanced bipartite horizontal tiers.
 */
export function autoLayoutRAG(
  state: RAGState,
  width = 760,
  height = 480
): RAGState {
  const next = cloneRAGState(state);
  const pCount = next.processes.length;
  const rCount = next.resources.length;

  if (pCount === 0 && rCount === 0) return next;

  const cx = width / 2;
  const cy = height / 2;

  // Use alternating radial ring layout for symmetric ring topologies (e.g. 4-process cycle, Dining Philosophers)
  if (pCount >= 3 && pCount === rCount) {
    const total = pCount + rCount;
    const radius = Math.min(width, height) * 0.36;
    for (let i = 0; i < pCount; i++) {
      const angleP = -Math.PI / 2 + ((2 * i) / total) * Math.PI * 2;
      const angleR = -Math.PI / 2 + ((2 * i + 1) / total) * Math.PI * 2;
      next.processes[i].x = Math.round(cx + radius * Math.cos(angleP));
      next.processes[i].y = Math.round(cy + radius * Math.sin(angleP));
      next.resources[i].x = Math.round(cx + radius * Math.cos(angleR));
      next.resources[i].y = Math.round(cy + radius * Math.sin(angleR));
    }
    return next;
  }

  // Balanced two-tier bipartite layout: Processes on top tier, Resources on bottom tier
  const usableWidth = Math.max(320, width - 180);
  const topY = rCount > 0 ? Math.round(height * 0.27) : Math.round(cy);
  const bottomY = pCount > 0 ? Math.round(height * 0.73) : Math.round(cy);

  next.processes.forEach((p, idx) => {
    const fraction = pCount === 1 ? 0.5 : idx / (pCount - 1);
    p.x = Math.round((width - usableWidth) / 2 + fraction * usableWidth);
    p.y = topY;
  });

  next.resources.forEach((r, idx) => {
    const fraction = rCount === 1 ? 0.5 : idx / (rCount - 1);
    r.x = Math.round((width - usableWidth) / 2 + fraction * usableWidth);
    r.y = bottomY;
  });

  return next;
}

/**
 * Aggregates parallel edges in `adjacency` into VisualEdge descriptors for SVG rendering.
 */
export function getVisualEdges(state: RAGState): VisualEdge[] {
  const pairCounts = new Map<string, { from: string; to: string; count: number }>();

  for (const [from, targets] of state.adjacency.entries()) {
    for (const to of targets) {
      const key = `${from}->${to}`;
      const existing = pairCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        pairCounts.set(key, { from, to, count: 1 });
      }
    }
  }

  const processSet = new Set(state.processes.map((p) => p.id));
  const edges: VisualEdge[] = [];

  for (const [key, item] of pairCounts.entries()) {
    const reverseKey = `${item.to}->${item.from}`;
    const kind = processSet.has(item.from) ? "request" : "assignment";
    edges.push({
      id: key,
      from: item.from,
      to: item.to,
      kind,
      count: item.count,
      hasReverse: pairCounts.has(reverseKey),
    });
  }

  return edges;
}

/**
 * Serializes a RAGState to clean JSON for Export.
 */
export function serializeRAG(
  state: RAGState,
  multiInstanceMode: boolean
): string {
  const adjacencyObj: Record<string, string[]> = {};
  for (const [key, list] of state.adjacency.entries()) {
    adjacencyObj[key] = [...list];
  }

  const payload: SerializedRAG = {
    version: 1,
    multiInstanceMode,
    processes: state.processes,
    resources: state.resources,
    adjacency: adjacencyObj,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Parses and validates an imported JSON string back into a valid RAGState.
 */
export function deserializeRAG(jsonText: string): {
  state: RAGState;
  multiInstanceMode?: boolean;
} {
  const parsed = JSON.parse(jsonText) as Partial<SerializedRAG>;
  if (
    !parsed ||
    !Array.isArray(parsed.processes) ||
    !Array.isArray(parsed.resources) ||
    typeof parsed.adjacency !== "object" ||
    parsed.adjacency === null
  ) {
    throw new Error(
      "Invalid RAG JSON schema: expected processes[], resources[], and adjacency object."
    );
  }

  const processes: ProcessNode[] = parsed.processes.map((p, idx) => ({
    id: String(p.id || `P${idx + 1}`),
    label: String(p.label || p.id || `P${idx + 1}`),
    state: Object.values(ProcessState).includes(p.state as ProcessState)
      ? (p.state as ProcessState)
      : ProcessState.Running,
    x: typeof p.x === "number" ? p.x : 140 + idx * 140,
    y: typeof p.y === "number" ? p.y : 130,
  }));

  const resources: ResourceNode[] = parsed.resources.map((r, idx) => ({
    id: String(r.id || `R${idx + 1}`),
    label: String(r.label || r.id || `R${idx + 1}`),
    instances: Math.max(1, Math.min(8, Number(r.instances) || 1)),
    waitQueue: Array.isArray(r.waitQueue) ? r.waitQueue.map(String) : [],
    x: typeof r.x === "number" ? r.x : 140 + idx * 140,
    y: typeof r.y === "number" ? r.y : 340,
  }));

  const validIds = new Set([
    ...processes.map((p) => p.id),
    ...resources.map((r) => r.id),
  ]);

  const adjacency = new Map<string, string[]>();
  for (const id of validIds) {
    const rawTargets = parsed.adjacency[id];
    const cleanTargets = Array.isArray(rawTargets)
      ? rawTargets.map(String).filter((target) => validIds.has(target))
      : [];
    adjacency.set(id, cleanTargets);
  }

  return {
    state: { processes, resources, adjacency },
    multiInstanceMode: parsed.multiInstanceMode,
  };
}
