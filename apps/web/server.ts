import express from "express";
import path from "node:path";
import { promises as fs } from "node:fs";

type CardStatus = "todo" | "in_progress" | "done";

type KanbanCard = {
  id: string;
  title: string;
  description: string;
  stage: string;
  priority: "P1" | "P2" | "P3";
  status: CardStatus;
  source: string;
};

type KanbanData = {
  meta: {
    project: string;
    lastUpdated: string;
    version: number;
  };
  columns: Array<{ id: CardStatus; name: string }>;
  cards: KanbanCard[];
};

const app = express();

const repoRoot = process.cwd();
const webRoot = path.join(repoRoot, "apps", "web");
const dataFilePath = path.join(webRoot, "data", "kanban-backlog.json");
const publicDir = path.join(webRoot, "public");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

async function readBoard(): Promise<KanbanData> {
  const raw = await fs.readFile(dataFilePath, "utf8");
  return JSON.parse(raw) as KanbanData;
}

async function writeBoard(next: KanbanData): Promise<void> {
  const withMeta: KanbanData = {
    ...next,
    meta: {
      ...next.meta,
      lastUpdated: new Date().toISOString().slice(0, 10),
      version: next.meta.version + 1
    }
  };

  await fs.writeFile(dataFilePath, JSON.stringify(withMeta, null, 2), "utf8");
}

app.get("/api/board", async (_req, res) => {
  try {
    const board = await readBoard();
    res.json(board);
  } catch (error) {
    console.error("Error reading board", error);
    res.status(500).json({ error: "Cannot read board data" });
  }
});

app.put("/api/board", async (req, res) => {
  try {
    const payload = req.body as KanbanData;

    if (!payload || !Array.isArray(payload.cards) || !Array.isArray(payload.columns) || !payload.meta) {
      res.status(400).json({ error: "Invalid board payload" });
      return;
    }

    await writeBoard(payload);
    const updated = await readBoard();
    res.json(updated);
  } catch (error) {
    console.error("Error writing board", error);
    res.status(500).json({ error: "Cannot write board data" });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const port = Number(process.env.KANBAN_PORT ?? 4173);
app.listen(port, () => {
  console.log(`[kanban-web] running on http://localhost:${port}`);
  console.log(`[kanban-web] data file ${dataFilePath}`);
});
