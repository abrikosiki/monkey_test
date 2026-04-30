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
const GENERATED_LESSONS_DIR = path.join(__dirname, "generated_lessons");
const DATA_DIR = path.join(__dirname, "tutor_data");
const DRAFT_FILE = path.join(DATA_DIR, "current_draft.json");
const CHILDREN_FILE = path.join(DATA_DIR, "children.json");
const generationJobs = new Map();

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
  fs.mkdirSync(GENERATED_LESSONS_DIR, { recursive: true });
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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildGeneratedHtmlFilename(lesson) {
  const code = slugify(lesson?.meta?.student_code || "lesson");
  const topic = slugify(lesson?.meta?.topic_key || lesson?.meta?.topic_label || "math");
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${code}_${topic}_${stamp}.html`;
}

function splitValues(raw) {
  return String(raw || "")
    .split(/[,\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const IMAGE_FILE_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg"]);

function listAssetStems(relativeDir) {
  const full = path.join(__dirname, relativeDir);
  const out = [];
  try {
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!IMAGE_FILE_EXTENSIONS.has(ext)) continue;
      out.push(path.basename(entry.name, ext));
    }
  } catch {
    // Missing or unreadable folder (e.g. empty deploy)
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function buildAssetCatalog() {
  const items = listAssetStems("assets/items");
  const targets = listAssetStems("assets/targets");
  const backgrounds = listAssetStems("assets/backgrounds");
  const characters = listAssetStems("assets/characters");
  const artifacts = listAssetStems("assets/artifacts");
  return {
    items,
    targets,
    backgrounds,
    characters,
    artifacts,
    itemDefault: items[0] || "",
    targetDefault: targets[0] || "",
    bgDefault: backgrounds[0] || "",
    charDefault: characters[0] || "",
    artifactDefault: artifacts[0] || "",
  };
}

function normAssetKeyStem(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Map invented keys to the closest allowed stem, else first allowed (deterministic). */
function resolveToAllowedStems(preferred, stems) {
  const list = Array.isArray(stems) ? stems : [];
  if (!list.length) return String(preferred || "").trim();
  const p = String(preferred || "").trim();
  if (p && list.includes(p)) return p;
  const wanted = normAssetKeyStem(p);
  for (const k of list) {
    if (normAssetKeyStem(k) === wanted) return k;
  }
  for (const k of list) {
    const nk = normAssetKeyStem(k);
    if (nk.length && wanted.length && (nk.includes(wanted) || wanted.includes(nk))) return k;
  }
  return list[0];
}

function formatAllowedKeySection(title, stems) {
  if (!stems.length) {
    return `${title}\n(no image files in this folder on the server — pick another section’s keys or repeat allowed keys from non-empty lists only)\n`;
  }
  return `${title}\n${stems.join(", ")}\n\n`;
}

function buildAssetKeyConstraintBlock(catalog) {
  return [
    "ALLOWED ASSET KEYS (STRICT — copy tokens exactly, character for character):",
    "You MUST choose every background and image_key only from these lists. Do not invent, translate, abbreviate, or substitute similar English words.",
    "",
    formatAllowedKeySection("BACKGROUNDS — use only for stage field \"background\":", catalog.backgrounds),
    formatAllowedKeySection("ITEMS — draggables, items[], tap/symbol/corridor PNGs (movable or symbolic objects):", catalog.items),
    formatAllowedKeySection("TARGETS — drop_zones, goal_image_key, bowl_image_key, totem_targets (containers, bowls, chests, portals):", catalog.targets),
    formatAllowedKeySection("CHARACTERS — meta.character_key only:", catalog.characters),
    formatAllowedKeySection("ARTIFACTS — stage 6 artifact.key and images_needed.artifact.key:", catalog.artifacts),
    "Rules:",
    "- drop_zone.image_kind \"item\" only if that exact token also appears under ITEMS; otherwise omit image_kind or use a TARGET token.",
    "- If you need a jungle/beach/cave mood, still pick ONLY background tokens from BACKGROUNDS above.",
    "",
  ].join("\n");
}

function clampVisualFields(obj, cat) {
  if (!obj || typeof obj !== "object") return;
  if (typeof obj.background === "string") {
    obj.background = resolveToAllowedStems(obj.background, cat.backgrounds);
  }
  if (typeof obj.image_key === "string") {
    obj.image_key = resolveToAllowedStems(obj.image_key, cat.items);
  }
  if (typeof obj.goal_image_key === "string") {
    obj.goal_image_key = resolveToAllowedStems(obj.goal_image_key, cat.targets);
  }
  if (typeof obj.bowl_image_key === "string") {
    obj.bowl_image_key = resolveToAllowedStems(obj.bowl_image_key, cat.targets);
  }
  for (const z of obj.drop_zones || []) {
    if (!z || typeof z !== "object" || typeof z.image_key !== "string") continue;
    const stems = z.image_kind === "item" ? cat.items : cat.targets;
    z.image_key = resolveToAllowedStems(z.image_key, stems);
  }
  for (const d of obj.draggables || []) {
    if (d && typeof d.image_key === "string") {
      d.image_key = resolveToAllowedStems(d.image_key, cat.items);
    }
  }
  for (const it of obj.items || []) {
    if (it && typeof it.image_key === "string") {
      it.image_key = resolveToAllowedStems(it.image_key, cat.items);
    }
  }
  if (obj.left_path && typeof obj.left_path === "object" && typeof obj.left_path.image_key === "string") {
    const stems = obj.left_path.image_kind === "item" ? cat.items : cat.targets;
    obj.left_path.image_key = resolveToAllowedStems(obj.left_path.image_key, stems);
  }
  if (obj.right_path && typeof obj.right_path === "object" && typeof obj.right_path.image_key === "string") {
    const stems = obj.right_path.image_kind === "item" ? cat.items : cat.targets;
    obj.right_path.image_key = resolveToAllowedStems(obj.right_path.image_key, stems);
  }
  if (Array.isArray(obj.totem_targets)) {
    obj.totem_targets = obj.totem_targets.map((k) =>
      typeof k === "string" ? resolveToAllowedStems(k, cat.targets) : k,
    );
  }
}

function clampLessonAssetKeys(lesson, cat) {
  if (!lesson || typeof lesson !== "object") return;
  if (lesson.meta && typeof lesson.meta.character_key === "string") {
    lesson.meta.character_key = resolveToAllowedStems(lesson.meta.character_key, cat.characters);
  }
  if (lesson.character && typeof lesson.character.image_key === "string") {
    lesson.character.image_key = resolveToAllowedStems(lesson.character.image_key, cat.characters);
  }
  for (const stage of lesson.stages || []) {
    clampVisualFields(stage, cat);
    for (const round of stage.rounds || []) {
      clampVisualFields(round, cat);
    }
    if (stage.type === "animation" && stage.artifact && typeof stage.artifact === "object" && typeof stage.artifact.key === "string") {
      stage.artifact.key = resolveToAllowedStems(stage.artifact.key, cat.artifacts);
    }
  }
  const im = lesson.images_needed;
  if (!im || typeof im !== "object") return;
  if (Array.isArray(im.library)) {
    im.library = im.library.map((k) => (typeof k === "string" ? resolveToAllowedStems(k, cat.items) : k));
  }
  if (Array.isArray(im.backgrounds)) {
    im.backgrounds = im.backgrounds.map((k) =>
      typeof k === "string" ? resolveToAllowedStems(k, cat.backgrounds) : k,
    );
  }
  if (Array.isArray(im.items)) {
    im.items = im.items.map((k) => (typeof k === "string" ? resolveToAllowedStems(k, cat.items) : k));
  }
  if (Array.isArray(im.targets)) {
    im.targets = im.targets.map((k) => (typeof k === "string" ? resolveToAllowedStems(k, cat.targets) : k));
  }
  if (im.artifact && typeof im.artifact === "object" && typeof im.artifact.key === "string") {
    im.artifact.key = resolveToAllowedStems(im.artifact.key, cat.artifacts);
  }
  const unionJobKeys = [...new Set([...cat.items, ...cat.artifacts])].sort((a, b) => a.localeCompare(b));
  if (Array.isArray(im.generate_with_dalle)) {
    for (const job of im.generate_with_dalle) {
      if (job && typeof job === "object" && typeof job.key === "string") {
        job.key = resolveToAllowedStems(job.key, unionJobKeys.length ? unionJobKeys : cat.items);
      }
    }
  }
}

function applyDraftToLessonStages(lesson, draft) {
  if (!lesson || !Array.isArray(lesson.stages) || !draft || !Array.isArray(draft.stages)) return lesson;
  const stageCount = Math.min(lesson.stages.length, draft.stages.length);
  for (let i = 0; i < stageCount; i++) {
    const lStage = lesson.stages[i] || {};
    const dStage = draft.stages[i] || {};
    lStage.type = dStage.mechanic || lStage.type;
    lStage.background = dStage.background || lStage.background;
    const dExamples = Array.isArray(dStage.examples) ? dStage.examples : [];
    if (!Array.isArray(lStage.rounds)) lStage.rounds = [];
    const rounds = [];
    for (let j = 0; j < Math.max(5, dExamples.length, lStage.rounds.length); j++) {
      const ex = dExamples[j] || {};
      const existing = lStage.rounds[j] || {};
      const mech = dStage.mechanic || lStage.type;
      const r = { ...existing };

      if (ex.titleText && !lStage.title) lStage.title = ex.titleText;
      if (ex.prompt) r.instruction = ex.prompt;

      if (mech === "fill_blank" || mech === "pattern_input") {
        r.example = ex.prompt || r.example || "";
        r.prompt = ex.prompt || r.prompt || "";
        r.answer = String(ex.answer ?? r.answer ?? "");
      } else if (mech === "multi_choice") {
        r.instruction = ex.prompt || r.instruction || "";
        r.options = [
          { id: "A", label: String(ex.choiceA ?? "") },
          { id: "B", label: String(ex.choiceB ?? "") },
          { id: "C", label: String(ex.choiceC ?? "") },
        ];
        r.correct_option = String(ex.correctOption || "A").toUpperCase();
      } else if (mech === "corridor_choice") {
        r.question = ex.prompt || r.question || "";
        r.left_expression = ex.leftExpression || r.left_expression || "";
        r.right_expression = ex.rightExpression || r.right_expression || "";
        r.correct_side = String(ex.correctSide || "left").toLowerCase();
      } else if (mech === "match_pairs") {
        r.pair_a = ex.pairA || r.pair_a || "";
        r.pair_b = ex.pairB || r.pair_b || "";
        r.pair_c = ex.pairC || r.pair_c || "";
        r.pair_d = ex.pairD || r.pair_d || "";
        r.correct_pair_1 = String(ex.correctPair1 || "A").toUpperCase();
        r.correct_pair_2 = String(ex.correctPair2 || "B").toUpperCase();
      } else if (mech === "tap_count") {
        r.question = ex.prompt || r.question || "Tap this item";
        r.target_count = toNumber(ex.answer, toNumber(r.target_count, 2));
      } else if (mech === "balance_scale") {
        r.left_expression = ex.leftExpression || r.left_expression || "3 + ?";
        r.right_expression = ex.rightExpression || r.right_expression || "7";
        r.answer = String(ex.answer ?? r.answer ?? "");
      } else if (mech === "build_number") {
        r.base_number = toNumber(ex.baseNumber, toNumber(r.base_number, 24));
        r.parts_count = toNumber(ex.partsCount, toNumber(r.parts_count, 3));
      } else if (mech === "timer_challenge") {
        r.timer_example_a = ex.timerExampleA || r.timer_example_a || "";
        r.timer_example_b = ex.timerExampleB || r.timer_example_b || "";
        r.timer_example_c = ex.timerExampleC || r.timer_example_c || "";
        r.timer_answer_a = String(ex.timerAnswerA ?? r.timer_answer_a ?? "");
        r.timer_answer_b = String(ex.timerAnswerB ?? r.timer_answer_b ?? "");
        r.timer_answer_c = String(ex.timerAnswerC ?? r.timer_answer_c ?? "");
        r.timer_seconds = toNumber(ex.timerSeconds, toNumber(r.timer_seconds, 30));
      } else if (mech === "symbol_calc") {
        r.symbol_a = toNumber(ex.symbolA, toNumber(r.symbol_a, 4));
        r.symbol_b = toNumber(ex.symbolB, toNumber(r.symbol_b, 3));
        r.symbol_c = toNumber(ex.symbolC, toNumber(r.symbol_c, 2));
        r.symbol_expression = ex.symbolExpression || r.symbol_expression || "A + B × C";
        r.answer = String(ex.answer ?? r.answer ?? "");
      } else if (mech === "find_unknown") {
        r.unknown_a = toNumber(ex.unknownA, toNumber(r.unknown_a, 4));
        r.unknown_b = toNumber(ex.unknownB, toNumber(r.unknown_b, 6));
        r.unknown_equation = ex.unknownEquation || r.unknown_equation || "A + B + C = 15";
        r.answer = String(ex.answer ?? r.answer ?? "");
      } else if (mech === "drag_group") {
        r.numbers_text = ex.numbersText || r.numbers_text || "";
        r.group1_name = ex.group1Name || r.group1_name || "Group 1";
        r.group2_name = ex.group2Name || r.group2_name || "Group 2";
        r.group1_values = ex.group1Values || r.group1_values || "";
        r.group2_values = ex.group2Values || r.group2_values || "";
      } else if (mech === "drag_sort") {
        const nums = splitValues(ex.prompt || "");
        const rule = splitValues(ex.answer || "");
        if (nums.length) {
          r.items = nums.map((t, idx) => ({ id: `i${idx + 1}`, value: t, text: t }));
        }
        if (rule.length) {
          r.correct_order = rule;
        }
      } else if (mech === "drag_drop") {
        r.screen_item_count = toNumber(ex.screenItemCount, toNumber(r.screen_item_count, 6));
        r.target_count = toNumber(ex.targetCount, toNumber(r.target_count, 2));
        if (Array.isArray(ex.zoneCounts) && ex.zoneCounts.length) {
          r.zone_counts = ex.zoneCounts.map((v) => toNumber(v, 0));
        }
      }

      rounds.push(r);
      if (rounds.length >= 5) break;
    }
    lStage.rounds = rounds.slice(0, 5);
    lesson.stages[i] = lStage;
  }
  return lesson;
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

function buildUserPromptFromDraft(draft, assetCatalog) {
  const catalog = assetCatalog || buildAssetCatalog();
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
- Tutor input includes mechanics and math examples only. Invent story, villain, artifact names (text), instructions, and tutor notes — but every visual key (backgrounds, image_key, character_key, artifact image key) MUST be copied exactly from the ALLOWED ASSET KEYS block below. Never invent asset filenames or keys.
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

${buildAssetKeyConstraintBlock(catalog)}
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

async function generateLessonFromDraft(draft) {
  if (draft && !draft.child && draft.childCode) {
    try {
      draft.child = await fetchChildRecord(draft.childCode);
    } catch {
      // Keep validation behavior below if child lookup fails.
    }
  }
  const draftErrors = validateDraft(draft);
  if (draftErrors.length) {
    const err = new Error("Draft is invalid");
    err.details = draftErrors;
    throw err;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment/.env");
  }

  const assetCatalog = buildAssetCatalog();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 7000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPromptFromDraft(draft, assetCatalog) }],
  });
  const text = msg.content?.find((c) => c.type === "text")?.text || "";
  const lesson = parseClaudeJson(text);
  applyDraftToLessonStages(lesson, draft);
  clampLessonAssetKeys(lesson, assetCatalog);
  const errors = validateLessonShape(lesson);
  if (errors.length) {
    const err = new Error("Generated lesson shape is invalid");
    err.details = errors;
    throw err;
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(lesson, null, 2), "utf-8");
  draft.updatedAt = new Date().toISOString();
  writeJson(DRAFT_FILE, draft);
  return lesson;
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

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".woff2") return "font/woff2";
  if (ext === ".woff") return "font/woff";
  if (ext === ".ttf") return "font/ttf";
  return "application/octet-stream";
}

function resolveSafeAssetPath(urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  const rel = decoded.replace(/^\/+/, "");
  const candidate = path.normalize(path.join(__dirname, rel));
  const root = path.normalize(__dirname);
  if (!candidate.startsWith(root)) return "";
  if (!candidate.startsWith(path.join(root, "assets"))) return "";
  return candidate;
}

function serveStaticAsset(req, res, url) {
  const filePath = resolveSafeAssetPath(url.pathname);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(res, 404, { ok: false, error: "Asset not found" });
    return;
  }
  const mime = guessMimeType(filePath);
  if (req.method === "HEAD") {
    const size = fs.statSync(filePath).size;
    res.writeHead(200, { "Content-Type": mime, "Content-Length": String(size), "Cache-Control": "public, max-age=3600" });
    res.end();
    return;
  }
  const buf = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": mime, "Content-Length": String(buf.length), "Cache-Control": "public, max-age=3600" });
  res.end(buf);
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

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/assets/")) {
      serveStaticAsset(req, res, url);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/generated-lessons/")) {
      const fileName = path.basename(url.pathname.replace("/generated-lessons/", ""));
      const filePath = path.join(GENERATED_LESSONS_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        sendJson(res, 404, { ok: false, error: "Generated lesson file not found" });
        return;
      }
      let html = fs.readFileSync(filePath, "utf-8");
      if (!html.includes("<base href=\"/\">")) {
        html = html.replace("<head>", "<head>\n  <base href=\"/\">");
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
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
      const payload = JSON.parse((await readBody(req)) || "{}");
      const draft = payload.draft;
      const jobId = "gen_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      generationJobs.set(jobId, { status: "pending", createdAt: Date.now() });
      sendJson(res, 200, { ok: true, jobId });
      (async () => {
        try {
          const lesson = await generateLessonFromDraft(draft);
          generationJobs.set(jobId, { status: "succeeded", lesson, finishedAt: Date.now() });
        } catch (err) {
          generationJobs.set(jobId, {
            status: "failed",
            error: err.message || "Generation failed",
            details: err.details || null,
            finishedAt: Date.now(),
          });
        }
      })();
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/generate-status") {
      const jobId = String(url.searchParams.get("jobId") || "");
      const job = generationJobs.get(jobId);
      if (!job) {
        sendJson(res, 404, { ok: false, error: "Generation job not found" });
        return;
      }
      sendJson(res, 200, { ok: true, ...job });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/build-lesson") {
      const lesson = readCurrentLesson();
      if (!lesson) {
        sendJson(res, 422, { ok: false, error: "No output_lesson.json yet. Create Lesson first." });
        return;
      }
      const fileName = buildGeneratedHtmlFilename(lesson);
      const outputRelativePath = path.join("generated_lessons", fileName);
      const output = await runNodeScript(["builder.mjs", "output_lesson.json", outputRelativePath]);
      const latestOutput = await runNodeScript(["builder.mjs", "output_lesson.json", "lesson_game.html"]);
      sendJson(res, 200, {
        ok: true,
        output,
        latestOutput,
        generatedFileName: fileName,
        generatedFileUrl: `/generated-lessons/${fileName}`,
      });
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
