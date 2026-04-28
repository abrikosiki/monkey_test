import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.TUTOR_UI_HOST || "0.0.0.0";
const PREFERRED_PORT = Number(process.env.PORT || process.env.TUTOR_UI_PORT || 8787);
const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, "system_prompt.txt"), "utf-8");
const UI_FILE = path.join(__dirname, "tutor_ui.html");
const OUT_FILE = path.join(__dirname, "output_lesson.json");

const DEFAULT_FORM = {
  child_name: "Cleo",
  child_code: "MONKEY-8801",
  age: 8,
  difficulty: "medium",
  topic: "number_division",
  topic_label: "Division",
  lesson_number: 1,
  island: 4,
  weak_points: "Confuses division with subtraction",
  focus: "Equal groups and the ÷ sign",
  knows: "Times tables 2-5, fair sharing",
  notes: "All content in English",
  character_key: "fairy_purple",
};

function loadDotEnv() {
  try {
    const text = fs.readFileSync(path.join(__dirname, ".env"), "utf-8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx <= 0) continue;
      const k = line.slice(0, eqIdx).trim();
      let v = line.slice(eqIdx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    // optional
  }
}

function buildUserPrompt(form) {
  return `Create one Monkey Archipelago lesson (JSON only).

CHILD:
- Name: ${form.child_name} (use in story.act3)
- Code: ${form.child_code}
- Age: ${form.age}
- Difficulty: ${form.difficulty}
- Topic: ${form.topic_label} (topic_key: ${form.topic})
- Lesson #${form.lesson_number} of 5, Island #${form.island}
- Character key: ${form.character_key}
- Weak: ${form.weak_points}
- Focus: ${form.focus}
- Knows: ${form.knows}
- Notes: ${form.notes}

STRICT:
- English only
- Return ONLY valid JSON
- Use root fields: meta, story, stages, images_needed, tutor_notes
- Exactly 6 stages with rounds (5 each where required by prompt)
- Stage 6 should be finale/boss style but still kid-friendly
`;
}

function parseClaudeJson(rawText) {
  let cleaned = String(rawText || "").trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end >= 0 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return JSON.parse(cleaned);
}

function validateLessonShape(lesson) {
  const errors = [];
  if (!lesson || typeof lesson !== "object") errors.push("Lesson must be a JSON object");
  if (!lesson.meta) errors.push("Missing meta");
  if (!lesson.story) errors.push("Missing story");
  if (!Array.isArray(lesson.stages) || lesson.stages.length !== 6) errors.push("stages must be exactly 6");
  return errors;
}

function readCurrentLesson() {
  try {
    return JSON.parse(fs.readFileSync(OUT_FILE, "utf-8"));
  } catch {
    return null;
  }
}

async function runBuildLesson() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["builder.mjs", "output_lesson.json", "lesson_game.html"], {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || stdout || `build failed with code ${code}`));
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 2_000_000) reject(new Error("Request too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

loadDotEnv();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PREFERRED_PORT}`);

    if (req.method === "GET" && url.pathname === "/") {
      const html = fs.readFileSync(UI_FILE, "utf-8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && url.pathname === "/lesson_game.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(path.join(__dirname, "lesson_game.html"), "utf-8"));
      return;
    }

    if (req.method === "GET" && url.pathname === "/output_lesson.json") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(fs.readFileSync(OUT_FILE, "utf-8"));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/default-form") {
      sendJson(res, 200, { ok: true, form: DEFAULT_FORM });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/current-lesson") {
      sendJson(res, 200, { ok: true, lesson: readCurrentLesson() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/generate") {
      if (!process.env.ANTHROPIC_API_KEY) {
        sendJson(res, 400, { ok: false, error: "ANTHROPIC_API_KEY is not set in environment/.env" });
        return;
      }

      const rawBody = await readBody(req);
      const payload = JSON.parse(rawBody || "{}");
      const form = { ...DEFAULT_FORM, ...(payload.form || {}) };

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(form) }],
      });

      const text = msg.content?.find((c) => c.type === "text")?.text || "";
      const lesson = parseClaudeJson(text);
      const errors = validateLessonShape(lesson);
      if (errors.length) {
        sendJson(res, 422, { ok: false, error: "Generated lesson shape is invalid", details: errors });
        return;
      }

      fs.writeFileSync(OUT_FILE, JSON.stringify(lesson, null, 2), "utf-8");
      sendJson(res, 200, { ok: true, lesson });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/build-lesson") {
      const output = await runBuildLesson();
      sendJson(res, 200, { ok: true, output });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/save-lesson") {
      const rawBody = await readBody(req);
      const payload = JSON.parse(rawBody || "{}");
      const lesson = payload.lesson;
      const errors = validateLessonShape(lesson);
      if (errors.length) {
        sendJson(res, 422, { ok: false, error: "Lesson shape is invalid", details: errors });
        return;
      }
      fs.writeFileSync(OUT_FILE, JSON.stringify(lesson, null, 2), "utf-8");
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || "Server error" });
  }
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    const fallbackPort = PREFERRED_PORT + 1;
    server.listen(fallbackPort, HOST, () => {
      console.log(`Tutor UI: http://${HOST}:${fallbackPort}`);
    });
    return;
  }
  throw err;
});

server.listen(PREFERRED_PORT, HOST, () => {
  console.log(`Tutor UI: http://${HOST}:${PREFERRED_PORT}`);
});
