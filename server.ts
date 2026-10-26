import dotenv from "dotenv";
import express from "express";
import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ExplainPayload {
  multiInstanceMode?: boolean;
  isDeadlocked?: boolean;
  processes?: Array<{ id: string; state: string }>;
  resources?: Array<{ id: string; instances: number; waitQueue: string[] }>;
  edges?: Array<{ from: string; to: string; type: string; count: number }>;
  cycles?: string[][];
  deadlockedProcesses?: string[];
  victimSuggestion?: { processId: string; reason: string } | null;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "256kb" }));

  app.post("/api/explain-deadlock", async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(503).json({
          error:
            "Gemini API key is not configured on the server. Ensure GEMINI_API_KEY is set in your environment secrets.",
        });
        return;
      }

      const body = (req.body || {}) as ExplainPayload;
      const processesText = (body.processes || [])
        .map((p) => `${p.id} (${p.state})`)
        .join(", ");
      const resourcesText = (body.resources || [])
        .map(
          (r) =>
            `${r.id} [${r.instances} instance${r.instances > 1 ? "s" : ""}${
              r.waitQueue?.length ? `, queue: ${r.waitQueue.join(" -> ")}` : ""
            }]`
        )
        .join(", ");
      const edgesText = (body.edges || [])
        .map((e) =>
          e.type === "assignment"
            ? `${e.from} -> ${e.to} (Assignment: ${e.to} holds ${e.count}x ${e.from})`
            : `${e.from} -> ${e.to} (Request: ${e.from} waits for ${e.to})`
        )
        .join("\n");
      const cyclesText =
        body.cycles && body.cycles.length > 0
          ? body.cycles.map((c) => c.join(" -> ")).join(" | ")
          : "None";

      const prompt = `Analyze the following Operating System Resource Allocation Graph (RAG) state and provide a concise, plain-English developer diagnostic.

Mode: ${body.multiInstanceMode ? "Multi-Instance (Banker's Matrix Verification)" : "Single-Instance RAG"}
System Status: ${body.isDeadlocked ? "DEADLOCK DETECTED" : "SYSTEM SAFE"}
Processes: ${processesText || "None"}
Resources: ${resourcesText || "None"}
Directed Edges:
${edgesText || "None"}
Detected Cycle(s): ${cyclesText}
Deadlocked Processes: ${(body.deadlockedProcesses || []).join(", ") || "None"}

Respond in plain text with 3 short, crisp paragraphs (under 150 words total, no markdown code blocks):
1. Root Cause: Explain clearly why the system is ${body.isDeadlocked ? "deadlocked (tracing who holds what and who is waiting on whom in the Coffman circular wait)" : "safe (and why any existing cycle does or does not cause a deadlock)"}.
2. Prevention Strategy: Give 2 concrete ways this specific scenario could be prevented in code (e.g., strict lock/resource ordering, try-lock with timeout, or eliminating hold-and-wait).
3. Immediate Recovery: Explain the cleanest runtime recovery step (such as aborting/rolling back ${body.victimSuggestion?.processId || "a minimum-cost victim process"} or preempting a lock).`;

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "You are a senior operating systems and database concurrency engineer explaining Resource Allocation Graph states clearly, accurately, and concisely without markdown clutter.",
          temperature: 0.3,
        },
      });

      const explanation = response.text?.trim();
      if (!explanation) {
        res.status(502).json({
          error: "Received an empty explanation from the model.",
        });
        return;
      }

      res.json({ explanation });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to generate deadlock explanation.";
      res.status(500).json({ error: message });
    }
  });

  const distPath = path.resolve(__dirname, "dist");
  const isProd =
    process.env.NODE_ENV === "production" ||
    (fs.existsSync(distPath) && process.argv[1]?.endsWith("server.ts") && process.env.VITE_DEV !== "true" && process.env.npm_lifecycle_event === "start");

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DeadlockLens server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
