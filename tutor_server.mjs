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
const DATA_DIR = path.join(__dirname, "tutor_data");
const DRAFT_FILE = path.join(DATA_DIR, "current_draft.json");
const CHILDREN_FILE = path.join(DATA_DIR, "children.json");

const MECHANICS = [
  { id: "drag_drop", label: "Drag Drop", description: "Drag items into target zones." },
  { id: "drag_sort", label: "Drag Sort", description: "Arrange values in the correct order." },
  { id: "drag_group", label: "Drag Group", description: "Sort objects into two groups." },
  { id: "pattern_input", label: "Pattern Input", description: "Continue a number pattern." },
  { id: "fill_blank", label: "Fill Blank", description: "Type the missing number." },
  { id: "multi_choice", label: "Multi Choice", description: "Pick one correct option." },
  { id: "corridor_choice", label: "Left Or Right", description: "Choose correct side between two examples." },
  { id: "match_pairs", label: "Find Two Pairs", description: "Pick two correct pairs from A/B/C/D options." },
  { id: "tap_count", label: "Tap Count", description: "Tap target N times." },
  { id: "balance_scale", label: "Balance Scale", description: "Make both sides equal." },
  { id: "build_number", label: "Build Number", description: "Build a number from parts." },
  { id: "timer_challenge", label: "Timer Challenge", description: "Solve as many as possible in 30 sec." },
  { id: "symbol_calc", label: "Symbol Calc", description: "Substitute A/B/C values and compute expression." },
  { id: "find_unknown", label: "Find Unknown", description: "Find C from equation with known A and B." },
];

const FIXED_BACKGROUNDS = {
  1: "stage1_generated",
  2: "cave_entrance",
  3: "cave_deep",
  4: "jungle_path",
  5: "jungle_temple",
  6: "stage6_generated",
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CHILDREN_FILE)) {
    fs.writeFileSync(CHILDREN_FILE, JSON.stringify([
      {
        child_code: "MONKEY-4821",
        name: "Pirate",
        coins: 165,
        level: 2,
        character_key: "pirate_green",
      },
      {
        child_code: "MONKEY-8801",
        name: "Cleo",
        coins: 92,
        level: 1,
        character_key: "fairy_purple",
      }
    ], null, 2));
  }
  if (!fs.existsSync(DRAFT_FILE)) {
    fs.writeFileSync(DRAFT_FILE, JSON.stringify(buildDefaultDraft(), null, 2));
  }
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function stageTemplate(stageNumber) {
  return {
    stageNumber,
    mechanic: stageNumber === 1 ? "drag_drop" : stageNumber === 6 ? "balance_scale" : "fill_blank",
    background: FIXED_BACKGROUNDS[stageNumber],
    examples: Array.from({ length: 5 }, (_, idx) => exampleTemplate(stageNumber, idx + 1)),
  };
}

function exampleTemplate(stageNumber, roundNumber) {
  return {
    roundNumber,
    instruction: `Round ${roundNumber} instruction seed`,
    prompt: "",
    answer: "",
    options: [],
    leftExpression: "",
    rightExpression: "",
    correctSide: "",
    itemHints: "",
    targetHints: "",
    note: "",
  };
}

function buildDefaultDraft() {
  return {
    draftId: "current",
    childCode: "MONKEY-4821",
    child: null,
    context: {
      difficulty: "medium",
      topicLabel: "Tutor-made lesson",
      topicKey: "custom_math_lesson",
    },
    stages: Array.from({ length: 6 }, (_, idx) => stageTemplate(idx + 1)),
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}

function normalizeChild(child) {
  if (!child) return null;
  const key = String(child.character_key || child.characterKey || "pirate_green");
  return {
    childCode: child.child_code || child.childCode,
    name: child.name || "Hero",
    coins: Number(child.coins || 0),
    level: Number(child.level || 1),
    characterKey: key,
    characterImagePath: `assets/characters/${key}.webp`,
  };
}

async function fetchChildRecord(code) {
  const childCode = String(code || "").trim();
  if (!childCode) throw new Error("Child code is required");

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const table = process.env.SUPABASE_CHILDREN_TABLE || "children";

  if (supabaseUrl && serviceKey) {
    const url = `${supabaseUrl}/rest/v1/${table}?child_code=eq.${encodeURIComponent(childCode)}&select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase lookup failed (${res.status})`);
    const rows = await res.json();
    const record = Array.isArray(rows) ? rows[0] : null;
    if (!record) throw new Error(`Child ${childCode} not found`);
    return normalizeChild(record);
  }

  const local = readJson(CHILDREN_FILE, []);
  const record = Array.isArray(local) ? local.find((item) => String(item.child_code) === childCode) : null;
  if (!record) throw new Error(`Child ${childCode} not found in local tutor_data/children.json`);
  return normalizeChild(record);
}

function buildUserPromptFromDraft(draft) {
  const child = draft.child || {};
  const context = draft.context || {};
  const stageLines = (draft.stages || []).map((stage) => {
    const examples = (stage.examples || []).map((example, idx) => {
      const parts = [
        `Example ${idx + 1}: ${example.titleText || example.instruction || "No title"}`,
        example.prompt ? `prompt=${example.prompt}` : "",
        example.answer ? `answer=${example.answer}` : "",
        example.options?.length ? `options=${example.options.join(" | ")}` : "",
        example.choiceA ? `choice_a=${example.choiceA}` : "",
        example.choiceB ? `choice_b=${example.choiceB}` : "",
        example.choiceC ? `choice_c=${example.choiceC}` : "",
        example.correctOption ? `correct_option=${example.correctOption}` : "",
        example.pairA ? `pair_a=${example.pairA}` : "",
        example.pairB ? `pair_b=${example.pairB}` : "",
        example.pairC ? `pair_c=${example.pairC}` : "",
        example.pairD ? `pair_d=${example.pairD}` : "",
        example.correctPair1 ? `correct_pair_1=${example.correctPair1}` : "",
        example.correctPair2 ? `correct_pair_2=${example.correctPair2}` : "",
        example.leftExpression ? `left=${example.leftExpression}` : "",
        example.rightExpression ? `right=${example.rightExpression}` : "",
        example.correctSide ? `correct_side=${example.correctSide}` : "",
        example.screenItemCount != null ? `screen_item_count=${example.screenItemCount}` : "",
        example.targetCount != null ? `target_count=${example.targetCount}` : "",
        Array.isArray(example.zoneCounts) && example.zoneCounts.length ? `zone_counts=${example.zoneCounts.join(",")}` : "",
        example.numbersText ? `numbers=${example.numbersText}` : "",
        example.group1Name ? `group1_name=${example.group1Name}` : "",
        example.group1Values ? `group1_values=${example.group1Values}` : "",
        example.group2Name ? `group2_name=${example.group2Name}` : "",
        example.group2Values ? `group2_values=${example.group2Values}` : "",
        example.baseNumber != null ? `base_number=${example.baseNumber}` : "",
        example.partsCount != null ? `parts_count=${example.partsCount}` : "",
        example.readyFlag != null ? `ready_flag=${example.readyFlag}` : "",
        example.timerExampleA ? `timer_example_a=${example.timerExampleA}` : "",
        example.timerExampleB ? `timer_example_b=${example.timerExampleB}` : "",
        example.timerExampleC ? `timer_example_c=${example.timerExampleC}` : "",
        example.timerAnswerA ? `timer_answer_a=${example.timerAnswerA}` : "",
        example.timerAnswerB ? `timer_answer_b=${example.timerAnswerB}` : "",
        example.timerAnswerC ? `timer_answer_c=${example.timerAnswerC}` : "",
        example.timerSeconds != null ? `timer_seconds=${example.timerSeconds}` : "",
        example.symbolA != null ? `symbol_a=${example.symbolA}` : "",
        example.symbolB != null ? `symbol_b=${example.symbolB}` : "",
        example.symbolC != null ? `symbol_c=${example.symbolC}` : "",
        example.symbolExpression ? `symbol_expression=${example.symbolExpression}` : "",
        example.unknownA != null ? `unknown_a=${example.unknownA}` : "",
        example.unknownB != null ? `unknown_b=${example.unknownB}` : "",
        example.unknownEquation ? `unknown_equation=${example.unknownEquation}` : "",
        example.note ? `note=${example.note}` : "",
      ].filter(Boolean);
      return `  - ${parts.join(" ; ")}`;
    }).join("\n");
    return `Stage ${stage.stageNumber}
- mechanic: ${stage.mechanic}
- background: ${stage.background}
- examples:
${examples}`;
  }).join("\n\n");

  return `Create one Monkey Archipelago lesson (JSON only).

CHILD FROM SYSTEM:
- Name: ${child.name}
- Code: ${child.childCode}
- Coins balance: ${child.coins}
- Level: ${child.level}
- Character key: ${child.characterKey}
- Character image path: ${child.characterImagePath}

LESSON CONTEXT:
- Difficulty: ${context.difficulty}
- Topic label: ${context.topicLabel}
- Topic key: ${context.topicKey}

RULES:
- English only
- Return ONLY valid JSON
- Use root fields: meta, story, stages, images_needed, tutor_notes
- Exactly 6 stages
- Exactly 5 rounds per stage
- Keep the tutor's mechanics and example math content
- Tutor input includes only mechanics and math examples. Claude must invent story, villain, artifact, instructions, tutor notes, and asset choices by itself.
- Use child system data in meta and completion flow
- For drag_drop, follow strict beach_lesson template: top draggable area + bottom target row, exactly 2 target PNGs per round, draggable count must match tutor screen_item_count, and use drag_drop backgrounds that are NOT cave_entrance/cave_deep/jungle_path/jungle_temple.
- Global: tutor "Title text" is always the centered stage title.
- Global: never show intermediate '+2' round popup; after correct round move directly to next round.
- Opening screen story must be highly engaging for kids 5-9: cinematic island intro, silly-not-scary monkey villain with a specific ridiculous action causing the math problem, personal hero mission by child name, and clear artifact treasure with magical power.
- Story JSON should include: island_name, villain, artifact_name, artifact_emoji, artifact_power, greeting, act1, act2, act3, goal.
- drag_sort template: one draggable PNG per number from tutor numbers list, each token has its own number badge, tokens start in lower area, target lines centered higher, rule defines exact final order.
- drag_group template: two large group squares with centered names from group1/group2 names; numbers list defines exact token count; correct drop glows green and token (image+number) disappears; wrong drop flashes red and token returns.
- pattern_input template: sequence_inline like beach_lesson stage 3; red only after input finish (blur/change); green on correct; show NEXT button after correct; NEXT opens next round immediately with no +2 round popup.
- fill_blank template: same card style as beach_lesson stage 5; example text inside card; answer exact.
- multi_choice template: task text is large inside interactive zone; render exactly 3 options (A/B/C); exactly one option is correct by tutor setting.
- corridor_choice template: task text in centered card; left/right examples are math text only (no placeholder icons); correct side from tutor field; correct=green then next round, wrong=red.
- match_pairs template: render A/B/C/D options as four tappable choices; exactly two correct options from tutor settings; correct=green+lock, wrong=red; once both correct are found, advance immediately to next round.
- tap_count template: centered card with task text and one tappable item PNG; required taps from tutor field; each tap has short pulse animation; on completion move immediately to next round (no 'Correct' interstitial, no +2 popup).
- balance_scale template: use scale_down first, expressions in framed pills near bowls, left includes ? input and right is fixed value/expression, correct input triggers magical transform to scale, expressions disappear, NEXT button appears, NEXT jumps directly to next round.
- build_number template: large base-number card in upper-middle, N empty input cards below (N from tutor parts count, clamp 2..5), arrows from lower cards to base card, tutor checkmark immediately advances to next round.
- timer_challenge template: main card has 3 rows A/B/C with ? inputs; timer and START are shown in a separate panel below the card; time from tutor seconds field; correct rows glow green, wrong rows red; when all 3 correct -> immediate next round, no interstitial popup.
- symbol_calc template: three upper rows with unique item PNG per symbol and shown numeric value; lower card expression replaces A/B/C letters with their mapped PNG icons; answer checked by tutor answer field; correct=green then next round, wrong=red.
- find_unknown template: upper rows show PNG=A value, PNG=B value, and PNG=[input for C]; in one round all three PNGs are different; lower equation replaces A/B/C letters with mapped PNG icons; input is checked against tutor Answer for C; correct=green then next round, wrong=red.

TUTOR STAGE INPUT:
${stageLines}
`;
}

function parseClaudeJson(rawText) {
  let cleaned = String(rawText || "").trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
}

function validateDraft(draft) {
  const errors = [];
  if (!draft?.childCode) errors.push("Child code is required");
  if (!draft?.child) errors.push("Child must be fetched before generation");
  if (!Array.isArray(draft?.stages) || draft.stages.length !== 6) errors.push("Draft must have 6 stages");
  for (const stage of draft?.stages || []) {
    if (!stage.mechanic) errors.push(`Stage ${stage.stageNumber} must have a mechanic`);
    if (!Array.isArray(stage.examples) || stage.examples.length !== 5) errors.push(`Stage ${stage.stageNumber} must have exactly 5 examples`);
  }
  return errors;
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
  return readJson(OUT_FILE, null);
}

async function runNodeScript(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: __dirname, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || stdout || `script failed with code ${code}`));
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
      if (body.length > 3_000_000) reject(new Error("Request too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

loadDotEnv();
ensureDataFiles();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PREFERRED_PORT}`);

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(UI_FILE, "utf-8"));
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

    if (req.method === "GET" && url.pathname === "/api/bootstrap") {
      sendJson(res, 200, {
        ok: true,
        draft: readJson(DRAFT_FILE, buildDefaultDraft()),
        lesson: readCurrentLesson(),
        mechanics: MECHANICS,
        fixedBackgrounds: FIXED_BACKGROUNDS,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/current-lesson") {
      sendJson(res, 200, { ok: true, lesson: readCurrentLesson() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/child/fetch") {
      const payload = JSON.parse((await readBody(req)) || "{}");
      const child = await fetchChildRecord(payload.childCode);
      sendJson(res, 200, { ok: true, child });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/drafts/save") {
      const payload = JSON.parse((await readBody(req)) || "{}");
      const draft = payload.draft;
      if (!draft || typeof draft !== "object") {
        sendJson(res, 422, { ok: false, error: "Draft payload is required" });
        return;
      }
      draft.updatedAt = new Date().toISOString();
      writeJson(DRAFT_FILE, draft);
      sendJson(res, 200, { ok: true, savedAt: draft.updatedAt });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/generate") {
      if (!process.env.ANTHROPIC_API_KEY) {
        sendJson(res, 400, { ok: false, error: "ANTHROPIC_API_KEY is not set in environment/.env" });
        return;
      }
      const payload = JSON.parse((await readBody(req)) || "{}");
      const draft = payload.draft;
      if (draft && !draft.child && draft.childCode) {
        try {
          draft.child = await fetchChildRecord(draft.childCode);
        } catch {
          // Keep validation behavior below if child lookup fails.
        }
      }
      const draftErrors = validateDraft(draft);
      if (draftErrors.length) {
        sendJson(res, 422, { ok: false, error: "Draft is invalid", details: draftErrors });
        return;
      }

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPromptFromDraft(draft) }],
      });
      const text = msg.content?.find((c) => c.type === "text")?.text || "";
      const lesson = parseClaudeJson(text);
      const errors = validateLessonShape(lesson);
      if (errors.length) {
        sendJson(res, 422, { ok: false, error: "Generated lesson shape is invalid", details: errors });
        return;
      }
      fs.writeFileSync(OUT_FILE, JSON.stringify(lesson, null, 2), "utf-8");
      draft.updatedAt = new Date().toISOString();
      writeJson(DRAFT_FILE, draft);
      sendJson(res, 200, { ok: true, lesson });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/build-lesson") {
      const output = await runNodeScript(["builder.mjs", "output_lesson.json", "lesson_game.html"]);
      sendJson(res, 200, { ok: true, output });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/generate-assets") {
      const output = await runNodeScript(["generate_assets.mjs", "output_lesson.json"]);
      sendJson(res, 200, { ok: true, output });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/save-lesson") {
      const payload = JSON.parse((await readBody(req)) || "{}");
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
