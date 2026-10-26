import React from "react";
import { ArrowDown } from "lucide-react";

interface EducationalSectionsProps {
  onLaunchSimulator: () => void;
  onLoadPresetAndScroll: (presetId: string) => void;
}

export const TopNavBar: React.FC<{ onLaunchSimulator: () => void }> = ({
  onLaunchSimulator,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0B0F17]/90 backdrop-blur-md border-b border-slate-800/90">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#"
          className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          DeadlockLens
        </a>

        {/* Zone 2: 4 Single-line Navigation Links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400"
        >
          <a
            href="#simulator"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Simulator
          </a>
          <a
            href="#how-it-works"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            How It Works
          </a>
          <a
            href="#real-world"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Real-World Use
          </a>
          <a
            href="#shortcuts"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Shortcuts
          </a>
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onLaunchSimulator}
            className="px-4 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Launch Simulator
          </button>
        </div>
      </div>
    </header>
  );
};

export const HeroSection: React.FC<{ onLaunchSimulator: () => void }> = ({
  onLaunchSimulator,
}) => {
  return (
    <section className="border-b border-slate-800/80 bg-gradient-to-b from-[#0E1525] to-[#0B0F17]">
      <div className="max-w-[1440px] mx-auto px-6 py-12 lg:py-16 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4 max-w-3xl">
          <p className="text-xs font-medium text-sky-400 tracking-wide">
            Operating Systems Concurrency Workbench · O(V + E) Graph Verification
          </p>
          <h1
            className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-50 leading-[1.12]"
            style={{ textWrap: "balance" }}
          >
            Visualize Resource Allocation Graphs and detect deadlocks in real time.
          </h1>
          <p className="text-base text-slate-300 leading-relaxed max-w-2xl">
            Simulate how an operating system kernel tracks process resource locks, reconstructs circular waits via three-color Depth-First Search and Kahn&apos;s topological sort, and resolves multi-instance safety using Banker&apos;s matrices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onLaunchSimulator}
            className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Launch Simulator
            <ArrowDown className="w-4 h-4" />
          </button>
          <a
            href="#how-it-works"
            className="px-4 py-3 text-sm font-medium text-slate-200 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Read Algorithm Guide
          </a>
        </div>
      </div>
    </section>
  );
};

export const EducationalSections: React.FC<EducationalSectionsProps> = ({
  onLoadPresetAndScroll,
}) => {
  return (
    <div className="max-w-[1440px] mx-auto px-6 py-16 space-y-20">
      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="scroll-mt-20 space-y-8">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-sky-400">
            Foundations &amp; Graph Theory
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
            How Deadlock Detection Works
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            DeadlockLens executes two independent O(V + E) graph algorithms side-by-side on the directed Resource Allocation Graph, paired with matrix reduction when resources expose multiple identical instances.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: RAG */}
          <article className="p-6 rounded-xl bg-[#0E1420] border border-slate-800 space-y-4">
            <h3 className="font-display text-lg font-semibold text-slate-100">
              01. Resource Allocation Graph (RAG)
            </h3>
            <svg
              viewBox="0 0 280 96"
              className="w-full h-24 bg-[#0B0F17] rounded-lg border border-slate-800/80"
              aria-hidden="true"
            >
              <circle cx="58" cy="48" r="20" fill="#0B221D" stroke="#10B981" strokeWidth="1.8" />
              <text x="58" y="48" textAnchor="middle" dominantBaseline="central" fill="#F8FAFC" className="font-mono text-xs font-bold">
                P1
              </text>
              <rect x="190" y="24" width="60" height="48" rx="6" fill="#0F1B24" stroke="#38BDF8" strokeWidth="1.8" />
              <text x="220" y="41" textAnchor="middle" fill="#F8FAFC" className="font-mono text-xs font-bold">
                R1
              </text>
              <circle cx="213" cy="57" r="3.5" fill="#38BDF8" />
              <circle cx="227" cy="57" r="3.5" fill="none" stroke="#64748B" strokeWidth="1.3" />
              <line x1="82" y1="38" x2="184" y2="38" stroke="#94A3B8" strokeWidth="1.6" strokeDasharray="5 3" />
              <text x="133" y="30" textAnchor="middle" fill="#94A3B8" className="font-mono text-[9px]">
                Request (P → R)
              </text>
              <line x1="186" y1="60" x2="82" y2="60" stroke="#38BDF8" strokeWidth="1.8" />
              <text x="133" y="75" textAnchor="middle" fill="#38BDF8" className="font-mono text-[9px]">
                Assignment (R → P)
              </text>
            </svg>
            <p className="text-sm text-slate-300 leading-relaxed">
              Vertices partition into <strong className="text-slate-100">Processes</strong> (circles) and <strong className="text-slate-100">Resources</strong> (rectangles with one dot per instance). A dashed edge <span className="font-mono text-xs text-slate-200">P → R</span> indicates a blocked request; a solid edge <span className="font-mono text-xs text-sky-300">R → P</span> indicates active ownership. For single-instance resources, a directed cycle is both necessary and sufficient for deadlock.
            </p>
          </article>

          {/* Card 2: Three-Color DFS */}
          <article className="p-6 rounded-xl bg-[#0E1420] border border-slate-800 space-y-4">
            <h3 className="font-display text-lg font-semibold text-slate-100">
              02. Three-Color DFS Cycle Detection
            </h3>
            <svg
              viewBox="0 0 280 96"
              className="w-full h-24 bg-[#0B0F17] rounded-lg border border-slate-800/80"
              aria-hidden="true"
            >
              <circle cx="48" cy="48" r="18" fill="#162032" stroke="#E2E8F0" strokeWidth="1.8" />
              <text x="48" y="48" textAnchor="middle" dominantBaseline="central" fill="#E2E8F0" className="font-mono text-[10px] font-bold">
                WHITE
              </text>
              <line x1="70" y1="48" x2="112" y2="48" stroke="#64748B" strokeWidth="1.5" />
              <circle cx="136" cy="48" r="18" fill="#291D09" stroke="#F59E0B" strokeWidth="1.8" />
              <text x="136" y="48" textAnchor="middle" dominantBaseline="central" fill="#FCD34D" className="font-mono text-[10px] font-bold">
                GREY
              </text>
              <line x1="158" y1="48" x2="200" y2="48" stroke="#64748B" strokeWidth="1.5" />
              <circle cx="224" cy="48" r="18" fill="#0D131F" stroke="#64748B" strokeWidth="1.8" />
              <text x="224" y="48" textAnchor="middle" dominantBaseline="central" fill="#94A3B8" className="font-mono text-[10px] font-bold">
                BLACK
              </text>
              <path d="M 148 31 C 165 10, 108 10, 124 31" fill="none" stroke="#EF4444" strokeWidth="1.8" />
              <text x="136" y="14" textAnchor="middle" fill="#FCA5A5" className="font-mono text-[9px]">
                Back Edge → Cycle
              </text>
            </svg>
            <p className="text-sm text-slate-300 leading-relaxed">
              Every vertex starts <span className="font-mono text-xs text-slate-200">WHITE</span>. Entering a vertex marks it <span className="font-mono text-xs text-amber-300">GREY</span> (on the active recursion stack); finishing all descendants marks it <span className="font-mono text-xs text-slate-400">BLACK</span>. Any edge reaching a <span className="font-mono text-xs text-amber-300">GREY</span> ancestor is a back edge, allowing immediate cycle reconstruction via parent pointers in <span className="font-mono text-xs">O(V + E)</span>.
            </p>
          </article>

          {/* Card 3: Kahn's Algorithm */}
          <article className="p-6 rounded-xl bg-[#0E1420] border border-slate-800 space-y-4">
            <h3 className="font-display text-lg font-semibold text-slate-100">
              03. Kahn&apos;s Topological Sort (BFS)
            </h3>
            <svg
              viewBox="0 0 280 96"
              className="w-full h-24 bg-[#0B0F17] rounded-lg border border-slate-800/80"
              aria-hidden="true"
            >
              <rect x="20" y="28" width="68" height="40" rx="5" fill="#0B221D" stroke="#10B981" strokeWidth="1.5" />
              <text x="54" y="44" textAnchor="middle" fill="#6EE7B7" className="font-mono text-[10px] font-semibold">
                inDeg = 0
              </text>
              <text x="54" y="58" textAnchor="middle" fill="#94A3B8" className="font-mono text-[9px]">
                FIFO Queue
              </text>
              <line x1="94" y1="48" x2="128" y2="48" stroke="#34D399" strokeWidth="1.6" />
              <rect x="134" y="28" width="126" height="40" rx="5" fill="#1E1419" stroke="#EF4444" strokeWidth="1.5" />
              <text x="197" y="44" textAnchor="middle" fill="#FCA5A5" className="font-mono text-[10px] font-semibold">
                Processed &lt; V
              </text>
              <text x="197" y="58" textAnchor="middle" fill="#CBD5E1" className="font-mono text-[9px]">
                Leftover = Cycle Set
              </text>
            </svg>
            <p className="text-sm text-slate-300 leading-relaxed">
              Kahn&apos;s algorithm repeatedly dequeues vertices with zero incoming edges and decrements neighbor in-degrees. Because every node inside a cycle has <span className="font-mono text-xs text-rose-300">inDegree ≥ 1</span>, cycle members can never enter the queue. If processed count &lt; total vertices, the remaining nodes pinpoint the blocked set.
            </p>
          </article>
        </div>
      </section>

      {/* REAL-WORLD USE SECTION */}
      <section id="real-world" className="scroll-mt-20 space-y-8">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-emerald-400">
            Production Systems Engineering
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
            Real-World Deadlock Detection in Kernels &amp; Databases
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Operating systems and transactional storage engines balance runtime cycle detection costs against prevention invariants depending on lock contention frequency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-[#0E1420] border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <p className="text-xs font-mono text-slate-400">
                Kernel Synchronization · Linux lockdep
              </p>
              <h3 className="font-display text-lg font-semibold text-slate-100">
                OS Scheduling &amp; Lock Ordering
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                General-purpose OS kernels avoid expensive runtime Banker&apos;s checks on every mutex acquisition, instead enforcing strict lock-class ordering graphs (such as Linux&apos;s <span className="font-mono text-xs text-slate-200">CONFIG_PROVE_LOCKING</span> validator) to catch potential <span className="font-mono text-xs">P1 → R2 → P2 → R1</span> inversions before a kernel hang occurs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onLoadPresetAndScroll("dining-philosophers")}
              className="self-start text-xs font-semibold text-sky-400 hover:text-sky-300 underline underline-offset-4 cursor-pointer"
            >
              Simulate Dining Philosophers (5) →
            </button>
          </div>

          <div className="p-6 rounded-xl bg-[#0E1420] border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <p className="text-xs font-mono text-slate-400">
                Relational Storage · MySQL InnoDB &amp; Oracle
              </p>
              <h3 className="font-display text-lg font-semibold text-slate-100">
                Transaction Row-Lock Deadlocks
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                When concurrent SQL transactions <span className="font-mono text-xs text-slate-200">T1</span> and <span className="font-mono text-xs text-slate-200">T2</span> acquire exclusive row locks in opposite orders, InnoDB runs immediate depth-first cycle detection on the lock graph and rolls back the transaction with the fewest modified undo-log records—mirroring DeadlockLens&apos;s victim selector.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onLoadPresetAndScroll("db-transactions")}
              className="self-start text-xs font-semibold text-sky-400 hover:text-sky-300 underline underline-offset-4 cursor-pointer"
            >
              Simulate T1/T2 Row-Lock Deadlock →
            </button>
          </div>

          <div className="p-6 rounded-xl bg-[#0E1420] border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <p className="text-xs font-mono text-slate-400">
                PostgreSQL &amp; Distributed Lock Managers
              </p>
              <h3 className="font-display text-lg font-semibold text-slate-100">
                Wait-For Graphs (WFG)
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                For single-instance locks, engines collapse two-hop paths <span className="font-mono text-xs text-slate-200">P1 → R → P2</span> into a compact Wait-For edge <span className="font-mono text-xs text-slate-200">P1 → P2</span>. PostgreSQL sleeps for <span className="font-mono text-xs">deadlock_timeout</span> (default 1s) before running WFG cycle detection so short lock waits pay zero graph-traversal overhead.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onLoadPresetAndScroll("circular-4p")}
              className="self-start text-xs font-semibold text-sky-400 hover:text-sky-300 underline underline-offset-4 cursor-pointer"
            >
              Simulate 4-Process Circular Wait →
            </button>
          </div>
        </div>
      </section>

      {/* KEYBOARD SHORTCUTS STRIP */}
      <section
        id="shortcuts"
        className="scroll-mt-20 p-6 rounded-xl bg-[#0E1420] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Keyboard Shortcuts
          </h2>
          <p className="text-xs text-slate-400">
            Trigger common workbench operations anywhere outside text inputs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 font-mono bg-[#0B0F17] border border-slate-700 rounded text-sky-300">
              D
            </kbd>
            <span>Run Detection</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 font-mono bg-[#0B0F17] border border-slate-700 rounded text-sky-300">
              S
            </kbd>
            <span>Step Through DFS</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 font-mono bg-[#0B0F17] border border-slate-700 rounded text-sky-300">
              L
            </kbd>
            <span>Auto-Layout Graph</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 font-mono bg-[#0B0F17] border border-slate-700 rounded text-sky-300">
              R
            </kbd>
            <span>Reset Scenario</span>
          </div>
        </div>
      </section>
    </div>
  );
};
