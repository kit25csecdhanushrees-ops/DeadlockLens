import {
  addProcessNode,
  addResourceNode,
  autoLayoutRAG,
  createEmptyRAG,
  requestResource,
} from "./ragGraph";
import { PresetDefinition, RAGState } from "./types";

function applySequence(
  initial: RAGState,
  ops: Array<(s: RAGState) => RAGState>
): RAGState {
  return ops.reduce((acc, fn) => fn(acc), initial);
}

/**
 * Curated preset scenarios covering safe execution, 2-process mutual deadlock,
 * 4-process circular wait, Dining Philosophers (5), Database row-lock deadlock (T1/T2),
 * and multi-instance cycle without deadlock.
 */
export const PRESET_SCENARIOS: PresetDefinition[] = [
  {
    id: "classic-2p",
    name: "Classic 2-Process Deadlock",
    subtitle: "P1 holds R1 & waits for R2; P2 holds R2 & waits for R1",
    recommendedMultiInstance: false,
    build: () => {
      let s = createEmptyRAG();
      s = applySequence(s, [
        (g) => addProcessNode(g, "P1", "P1", { x: 240, y: 130 }).state,
        (g) => addProcessNode(g, "P2", "P2", { x: 520, y: 130 }).state,
        (g) => addResourceNode(g, 1, "R1", "R1", { x: 240, y: 350 }).state,
        (g) => addResourceNode(g, 1, "R2", "R2", { x: 520, y: 350 }).state,
        (g) => requestResource(g, "P1", "R1").state, // R1 -> P1
        (g) => requestResource(g, "P2", "R2").state, // R2 -> P2
        (g) => requestResource(g, "P1", "R2").state, // P1 -> R2 (wait)
        (g) => requestResource(g, "P2", "R1").state, // P2 -> R1 (wait)
      ]);
      return s;
    },
  },
  {
    id: "safe-system",
    name: "Safe System (Acyclic Wait Chain)",
    subtitle: "P3 waits on R2 held by P2, which waits on R1 held by running P1",
    recommendedMultiInstance: false,
    build: () => {
      let s = createEmptyRAG();
      s = applySequence(s, [
        (g) => addProcessNode(g, "P1", "P1", { x: 180, y: 130 }).state,
        (g) => addProcessNode(g, "P2", "P2", { x: 380, y: 130 }).state,
        (g) => addProcessNode(g, "P3", "P3", { x: 580, y: 130 }).state,
        (g) => addResourceNode(g, 1, "R1", "R1", { x: 180, y: 350 }).state,
        (g) => addResourceNode(g, 1, "R2", "R2", { x: 380, y: 350 }).state,
        (g) => addResourceNode(g, 1, "R3", "R3", { x: 580, y: 350 }).state,
        (g) => requestResource(g, "P1", "R1").state, // R1 -> P1 (P1 Running!)
        (g) => requestResource(g, "P2", "R2").state, // R2 -> P2
        (g) => requestResource(g, "P3", "R3").state, // R3 -> P3
        (g) => requestResource(g, "P2", "R1").state, // P2 -> R1 (P2 waits for P1)
        (g) => requestResource(g, "P3", "R2").state, // P3 -> R2 (P3 waits for P2)
      ]);
      return s;
    },
  },
  {
    id: "circular-4p",
    name: "Circular Wait Among 4 Processes",
    subtitle: "4-way ring: P1 -> R2 -> P2 -> R3 -> P3 -> R4 -> P4 -> R1 -> P1",
    recommendedMultiInstance: false,
    build: () => {
      let s = createEmptyRAG();
      for (let i = 1; i <= 4; i++) {
        s = addProcessNode(s, `P${i}`, `P${i}`).state;
        s = addResourceNode(s, 1, `R${i}`, `R${i}`).state;
      }
      // Each Pi acquires Ri first
      for (let i = 1; i <= 4; i++) {
        s = requestResource(s, `P${i}`, `R${i}`).state;
      }
      // Each Pi requests R_{(i % 4) + 1}
      for (let i = 1; i <= 4; i++) {
        const nextR = (i % 4) + 1;
        s = requestResource(s, `P${i}`, `R${nextR}`).state;
      }
      return autoLayoutRAG(s, 760, 480);
    },
  },
  {
    id: "dining-philosophers",
    name: "Dining Philosophers (5)",
    subtitle: "All 5 philosophers hold their left fork and wait on their right fork",
    recommendedMultiInstance: false,
    build: () => {
      let s = createEmptyRAG();
      for (let i = 1; i <= 5; i++) {
        s = addProcessNode(s, `P${i}`, `Phil ${i}`).state;
        s = addResourceNode(s, 1, `R${i}`, `Fork ${i}`).state;
      }
      for (let i = 1; i <= 5; i++) {
        s = requestResource(s, `P${i}`, `R${i}`).state;
      }
      for (let i = 1; i <= 5; i++) {
        const rightFork = (i % 5) + 1;
        s = requestResource(s, `P${i}`, `R${rightFork}`).state;
      }
      return autoLayoutRAG(s, 760, 480);
    },
  },
  {
    id: "db-transactions",
    name: "Database Transactions Locking Rows (T1/T2)",
    subtitle: "T1 locks Row_Accounts & waits for Row_Orders; T2 locks Row_Orders & waits for Row_Accounts",
    recommendedMultiInstance: false,
    build: () => {
      let s = createEmptyRAG();
      s = applySequence(s, [
        (g) => addProcessNode(g, "T1", "Txn T1", { x: 240, y: 130 }).state,
        (g) => addProcessNode(g, "T2", "Txn T2", { x: 520, y: 130 }).state,
        (g) =>
          addResourceNode(g, 1, "RowA", "Row_Accounts", { x: 240, y: 350 })
            .state,
        (g) =>
          addResourceNode(g, 1, "RowB", "Row_Orders", { x: 520, y: 350 }).state,
        (g) => requestResource(g, "T1", "RowA").state,
        (g) => requestResource(g, "T2", "RowB").state,
        (g) => requestResource(g, "T1", "RowB").state,
        (g) => requestResource(g, "T2", "RowA").state,
      ]);
      return s;
    },
  },
  {
    id: "multi-instance-safe-cycle",
    name: "Multi-Instance Cycle (No Deadlock)",
    subtitle: "RAG has cycle P1 -> R1 -> P2 -> R2 -> P1, but P3/P4 free instances",
    recommendedMultiInstance: true,
    build: () => {
      let s = createEmptyRAG();
      s = applySequence(s, [
        (g) => addProcessNode(g, "P1", "P1", { x: 160, y: 130 }).state,
        (g) => addProcessNode(g, "P2", "P2", { x: 320, y: 130 }).state,
        (g) => addProcessNode(g, "P3", "P3", { x: 480, y: 130 }).state,
        (g) => addProcessNode(g, "P4", "P4", { x: 640, y: 130 }).state,
        (g) => addResourceNode(g, 2, "R1", "R1", { x: 260, y: 350 }).state,
        (g) => addResourceNode(g, 2, "R2", "R2", { x: 500, y: 350 }).state,
        // R1 (2 instances): held by P2 and P3
        (g) => requestResource(g, "P2", "R1").state,
        (g) => requestResource(g, "P3", "R1").state,
        // R2 (2 instances): held by P1 and P4
        (g) => requestResource(g, "P1", "R2").state,
        (g) => requestResource(g, "P4", "R2").state,
        // P1 requests R1 (creates P1 -> R1 -> P2) and P2 requests R2 (closes -> R2 -> P1)
        (g) => requestResource(g, "P1", "R1").state,
        (g) => requestResource(g, "P2", "R2").state,
      ]);
      return s;
    },
  },
];
