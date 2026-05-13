import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { spawn } from "child_process";
import {
  CANONICAL_ISLAND_KEYS,
  applyIslandLessonCanon,
  getIslandStageBgMap,
} from "./island_canon.mjs";

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
  { id: "key_lock", label: "Key Lock Box", description: "Three sum locks and six numbered keys." },
  { id: "balance_scale", label: "Balance Scale", description: "Make both sides equal." },
  { id: "build_number", label: "Build Number", description: "Build a number from parts." },
  { id: "timer_challenge", label: "Timer Challenge", description: "Solve as many as possible in 30 sec." },
  { id: "symbol_calc", label: "Symbol Calc", description: "Substitute A/B/C values and compute expression." },
  { id: "find_unknown", label: "Find Unknown", description: "Find C from equation with known A and B." },
  { id: "true_false", label: "True or False", description: "Say whether the statement is true or false." },
  { id: "text_task", label: "Text Task", description: "Type the correct text answer." },
  { id: "five_tasks", label: "Five Tasks", description: "Solve all 5 tasks shown at once." },
  { id: "boss_mix", label: "⚔️ Boss Stage", description: "Final battle — 2 hard examples per each of the 5 stage mechanics (10 rounds total)." },
];

const DEFAULT_STAGE_BACKGROUNDS = {
  3: "2",
  4: "3",
};

function getIslandStageBackgroundKeys(islandKey) {
  return getIslandStageBgMap(islandKey);
}

function stageBackgroundFor(stageNumber, islandKey) {
  const islandMap = getIslandStageBackgroundKeys(islandKey);
  if (islandMap && islandMap[stageNumber]) return islandMap[stageNumber];
  return DEFAULT_STAGE_BACKGROUNDS[stageNumber] || "";
}

function syncDraftStageBackgroundsFromIslandKey(draft) {
  if (!draft || typeof draft !== "object") return;
  const key = String(draft.context?.islandKey || "").trim();
  const map = getIslandStageBgMap(key);
  if (!map) return;
  const stages = Array.isArray(draft.stages) ? draft.stages : [];
  for (let i = 0; i < stages.length; i++) {
    const row = stages[i];
    if (!row || typeof row !== "object") continue;
    const sn = Number(row.stageNumber) || i + 1;
    if (map[sn]) row.background = map[sn];
  }
}

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

function hasCyrillic(value) {
  return /[\u0400-\u04FF]/.test(String(value || ""));
}

function enforceEnglishText(lesson) {
  if (!lesson || typeof lesson !== "object") return;
  const story = lesson.story || (lesson.story = {});
  if (hasCyrillic(story.island_name)) story.island_name = "Blue Island";
  if (hasCyrillic(story.villain)) story.villain = "Blue Crab Monkey";
  if (hasCyrillic(story.artifact_name)) story.artifact_name = "Mind Glasses";
  if (hasCyrillic(story.artifact_power)) story.artifact_power = "Reveals hidden numbers instantly.";
  if (hasCyrillic(story.greeting)) story.greeting = "Welcome, hero! Let's start the adventure.";
  if (hasCyrillic(story.act1)) story.act1 = "You arrive on a glowing island where math puzzles guard the treasure.";
  if (hasCyrillic(story.act2)) story.act2 = "A silly monkey villain mixed everything up, so the island needs your help.";
  if (hasCyrillic(story.act3)) story.act3 = "Solve every challenge to restore balance and unlock the artifact.";
  if (hasCyrillic(story.goal)) story.goal = "Use math to make fair choices and complete the mission.";
  for (const stage of lesson.stages || []) {
    if (!stage || typeof stage !== "object") continue;
    if (hasCyrillic(stage.title)) stage.title = `Stage ${Number(stage.id || stage._stageNo || 1)} Challenge`;
    if (hasCyrillic(stage.success_message)) stage.success_message = "Great job! You solved this round.";
    for (const round of stage.rounds || []) {
      if (!round || typeof round !== "object") continue;
      if (hasCyrillic(round.instruction)) round.instruction = "Solve the task to continue.";
      if (hasCyrillic(round.question)) round.question = "Choose the correct answer.";
    }
  }
  const imgArtifact = lesson.images_needed?.artifact;
  if (imgArtifact && typeof imgArtifact === "object" && hasCyrillic(imgArtifact.name)) {
    imgArtifact.name = "Mind Glasses";
  }
}

const IMAGE_FILE_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg"]);

function listAssetStems(relativeDir) {
  const full = path.join(__dirname, relativeDir);
  const out = [];
  try {
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const extRaw = path.extname(entry.name);
      const ext = extRaw.toLowerCase();
      if (!IMAGE_FILE_EXTENSIONS.has(ext)) continue;
      out.push(extRaw ? entry.name.slice(0, -extRaw.length) : entry.name);
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

/** Like resolveToAllowedStems but never picks an unrelated first catalog entry for unknown keys. */
function resolveBackgroundStem(preferred, stems) {
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
    if (wanted.length >= 3 && nk.length >= 3 && (nk.includes(wanted) || wanted.includes(nk))) return k;
  }
  return p;
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
    obj.background = resolveBackgroundStem(obj.background, cat.backgrounds);
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
      typeof k === "string" ? resolveBackgroundStem(k, cat.backgrounds) : k,
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

function mapExampleToRound(mech, ex, existing) {
  const r = {};
  if (ex.prompt) r.instruction = ex.prompt;

  if (mech === "fill_blank" || mech === "pattern_input") {
    r.example = ex.prompt || "";
    r.prompt = ex.prompt || "";
    r.answer = String(ex.answer ?? "");
  } else if (mech === "multi_choice") {
    r.instruction = ex.prompt || "";
    r.options = [
      { id: "A", label: String(ex.choiceA ?? "") },
      { id: "B", label: String(ex.choiceB ?? "") },
      { id: "C", label: String(ex.choiceC ?? "") },
    ];
    r.correct_option = String(ex.correctOption || "A").toUpperCase();
  } else if (mech === "corridor_choice") {
    r.question = ex.prompt || "";
    r.left_expression = ex.leftExpression || "";
    r.right_expression = ex.rightExpression || "";
    r.correct_side = String(ex.correctSide || "left").toLowerCase();
  } else if (mech === "match_pairs") {
    r.pair_a = ex.pairA || "";
    r.pair_b = ex.pairB || "";
    r.pair_c = ex.pairC || "";
    r.pair_d = ex.pairD || "";
    r.correct_pair_1 = String(ex.correctPair1 || "A").toUpperCase();
    r.correct_pair_2 = String(ex.correctPair2 || "B").toUpperCase();
  } else if (mech === "tap_count") {
    r.question = ex.prompt || "Tap this item";
    r.target_count = toNumber(ex.answer, 2);
  } else if (mech === "balance_scale") {
    r.left_expression = ex.leftExpression || "3 + ?";
    r.right_expression = ex.rightExpression || "7";
    r.answer = String(ex.answer ?? "");
  } else if (mech === "build_number") {
    r.base_number = toNumber(ex.baseNumber, 24);
    r.parts_count = toNumber(ex.partsCount, 3);
  } else if (mech === "timer_challenge") {
    r.timer_example_a = ex.timerExampleA || "";
    r.timer_example_b = ex.timerExampleB || "";
    r.timer_example_c = ex.timerExampleC || "";
    r.timer_answer_a = String(ex.timerAnswerA ?? "");
    r.timer_answer_b = String(ex.timerAnswerB ?? "");
    r.timer_answer_c = String(ex.timerAnswerC ?? "");
    r.timer_seconds = toNumber(ex.timerSeconds, 30);
  } else if (mech === "symbol_calc") {
    r.symbol_a = toNumber(ex.symbolA, 4);
    r.symbol_b = toNumber(ex.symbolB, 3);
    r.symbol_c = toNumber(ex.symbolC, 2);
    r.symbol_expression = ex.symbolExpression || "A + B × C";
    r.answer = String(ex.answer ?? "");
  } else if (mech === "find_unknown") {
    r.unknown_a = toNumber(ex.unknownA, 4);
    r.unknown_b = toNumber(ex.unknownB, 6);
    r.unknown_equation = ex.unknownEquation || "A + B + C = 15";
    r.answer = String(ex.answer ?? "");
  } else if (mech === "drag_group") {
    r.numbers_text = ex.numbersText || "";
    r.group1_name = ex.group1Name || "Group 1";
    r.group2_name = ex.group2Name || "Group 2";
    r.group1_values = ex.group1Values || "";
    r.group2_values = ex.group2Values || "";
  } else if (mech === "drag_sort") {
    const nums = splitValues(ex.prompt || "");
    const rule = splitValues(ex.answer || "");
    if (nums.length) {
      r.items = nums.map((t, idx) => ({
        id: `i${idx + 1}`,
        value: t,
        text: t,
        image_key: existing.items?.[idx]?.image_key || "banana",
      }));
    }
    if (rule.length) {
      r.correct_order = rule;
    }
  } else if (mech === "drag_drop") {
    r.screen_item_count = toNumber(ex.screenItemCount, 6);
    r.target_count = toNumber(ex.targetCount, 2);
    if (Array.isArray(ex.zoneCounts) && ex.zoneCounts.length) {
      r.zone_counts = ex.zoneCounts.map((v) => toNumber(v, 0));
    }
  } else if (mech === "key_lock") {
    r.lock_sum_1 = toNumber(ex.lock1Sum, 0);
    r.lock_sum_2 = toNumber(ex.lock2Sum, 0);
    r.lock_sum_3 = toNumber(ex.lock3Sum, 0);
    r.pair_1 = [toNumber(ex.lock1KeyA, 0), toNumber(ex.lock1KeyB, 0)];
    r.pair_2 = [toNumber(ex.lock2KeyA, 0), toNumber(ex.lock2KeyB, 0)];
    r.pair_3 = [toNumber(ex.lock3KeyA, 0), toNumber(ex.lock3KeyB, 0)];
    const fromPairs = [...r.pair_1, ...r.pair_2, ...r.pair_3]
      .map((v) => toNumber(v, NaN))
      .filter((n) => Number.isFinite(n));
    if (fromPairs.length >= 6) {
      r.key_lock_keys = fromPairs.slice(0, 6);
    } else {
      const rawKeys = splitValues(ex.keysSixText || ex.keys_six_text || "");
      const keyNums = rawKeys.map((v) => toNumber(v, NaN)).filter((n) => Number.isFinite(n));
      r.key_lock_keys = keyNums.slice(0, 6);
    }
    while (r.key_lock_keys.length < 6) r.key_lock_keys.push(0);
  } else if (mech === "true_false") {
    r.statement = ex.statement || "";
    r.correct_answer = String(ex.trueOrFalse || "true");
  } else if (mech === "text_task") {
    r.prompt = ex.prompt || "";
    r.answer = String(ex.answer ?? "");
  } else if (mech === "five_tasks") {
    r.tasks = [
      { q: ex.task1 || "", a: String(ex.answer1 ?? "") },
      { q: ex.task2 || "", a: String(ex.answer2 ?? "") },
      { q: ex.task3 || "", a: String(ex.answer3 ?? "") },
      { q: ex.task4 || "", a: String(ex.answer4 ?? "") },
      { q: ex.task5 || "", a: String(ex.answer5 ?? "") },
    ];
  }
  return r;
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
    const stageTitleFromDraft = String(dExamples[0]?.titleText || "").trim();
    if (stageTitleFromDraft) lStage.title = stageTitleFromDraft;
    if (!Array.isArray(lStage.rounds)) lStage.rounds = [];

    const mech = dStage.mechanic || lStage.type;

    if (mech === "boss_mix") {
      const bossRounds = [];
      for (const ex of dExamples) {
        if (!ex || typeof ex !== "object") continue;
        const srcMech = ex.bossMechanic || "fill_blank";
        const r = mapExampleToRound(srcMech, ex, {});
        r.type = srcMech;
        if (ex.titleText) r.instruction = ex.titleText;
        bossRounds.push(r);
      }
      lStage.rounds = bossRounds;
    } else {
      const rounds = [];
      for (let j = 0; j < Math.max(5, dExamples.length, lStage.rounds.length); j++) {
        const ex = dExamples[j] || {};
        const existing = lStage.rounds[j] || {};
        if (ex.titleText && !lStage.title) lStage.title = ex.titleText;
        const r = mapExampleToRound(mech, ex, existing);
        rounds.push(r);
        if (rounds.length >= 5) break;
      }
      lStage.rounds = rounds.slice(0, 5);
    }

    lesson.stages[i] = lStage;
  }
  return lesson;
}

function buildStrictManualStageShell(lesson, draft) {
  const srcStages = Array.isArray(lesson?.stages) ? lesson.stages : [];
  const out = [];
  for (let i = 0; i < 6; i++) {
    const fromLesson = srcStages[i] || {};
    const fromDraft = draft?.stages?.[i] || {};
    out.push({
      id: i + 1,
      type: fromDraft.mechanic || fromLesson.type || "fill_blank",
      title: String(fromLesson.title || "").trim() || `Stage ${i + 1}`,
      background: fromDraft.background || fromLesson.background || stageBackgroundFor(i + 1, draft?.context?.islandKey || ""),
      coins: Number(fromLesson.coins ?? 10),
      mechanic_reason: String(fromLesson.mechanic_reason || ""),
      success_message: String(fromLesson.success_message || ""),
      rounds: [],
    });
  }
  lesson.stages = out;
}

function stageTemplate(stageNumber, islandKey = "") {
  const isBoss = stageNumber === 6;
  const mechanic = stageNumber === 1 ? "drag_drop" : isBoss ? "boss_mix" : "fill_blank";
  return {
    stageNumber,
    mechanic,
    background: stageBackgroundFor(stageNumber, islandKey),
    examples: Array.from({ length: isBoss ? 10 : 5 }, (_, idx) => {
      const ex = exampleTemplate(stageNumber, idx + 1);
      if (isBoss) ex.bossMechanic = "";
      return ex;
    }),
  };
}

function exampleTemplate(stageNumber, roundNumber) {
  return {
    roundNumber,
    instruction: "",
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
  const defaultIslandKey = "blue_crab_island";
  return {
    draftId: "current",
    childCode: "MONKEY-4821",
    child: null,
    context: {
      difficulty: "medium",
      topicLabel: "Tutor-made lesson",
      topicKey: "custom_math_lesson",
      islandKey: defaultIslandKey,
    },
    stages: Array.from({ length: 6 }, (_, idx) => stageTemplate(idx + 1, defaultIslandKey)),
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}

/** Совмещает старую схему (child_code, character_key) и схему Monkey Game (code, char_img, character_type+outfit). */
function deriveCharacterKeyStem(child) {
  if (!child || typeof child !== "object") return "pirate_green";
  if (child.character_key || child.characterKey) {
    return String(child.character_key || child.characterKey).trim() || "pirate_green";
  }
  if (child.char_img != null && String(child.char_img).trim() !== "") {
    const raw = String(child.char_img).trim();
    const base = raw.split(/[/\\]/).pop().replace(/\.(webp|png|jpg|jpeg|gif)$/i, "");
    return base || "pirate_green";
  }
  const ct = String(child.character_type || "boy").replace(/\s+/g, "_");
  const ot = String(child.outfit || "brown").replace(/\s+/g, "_");
  return `${ct}_${ot}`.toLowerCase() || "pirate_green";
}

function parseInventoryList(child) {
  const raw = child.inventory ?? child.artifacts ?? child.owned_artifacts ?? [];
  if (Array.isArray(raw)) {
    return raw.map((v) => (v == null ? "" : String(v).trim())).filter(Boolean);
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.values(raw)
      .map((v) => (v == null ? "" : String(v).trim()))
      .filter(Boolean);
  }
  return String(raw || "")
    .split(/[,\n;]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeChild(child) {
  if (!child) return null;
  const key = deriveCharacterKeyStem(child);
  const inventory = parseInventoryList(child);
  const freezeRing = Boolean(
    child.freeze_ring ??
    child.freezeRing ??
    child.has_freeze_ring ??
    child.hasFreezeRing,
  );
  const rawAge = child.age ?? child.age_years ?? child.ageYears;
  const ageNum = Number(rawAge);
  const age = Number.isFinite(ageNum) && ageNum > 0 ? ageNum : undefined;
  const rawLevel = Number(child.level);
  const level = Number.isFinite(rawLevel) ? rawLevel : 1;
  const publicCode =
    child.child_code ||
    child.childCode ||
    child.code ||
    "";
  return {
    childCode: String(publicCode || "").trim(),
    name: child.name || "Hero",
    coins: Number(child.coins ?? 0),
    level,
    characterKey: key,
    characterImagePath: `assets/characters/${key}.webp`,
    inventory,
    freezeRing,
    ...(age != null ? { age } : {}),
  };
}

async function fetchChildRecord(code) {
  const childCode = String(code || "").trim();
  if (!childCode) throw new Error("Child code is required");

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const table = process.env.SUPABASE_CHILDREN_TABLE || "children";
  /** Колонка с публичным кодом ребёнка: в новой схеме Monkey Game это `code`, в старой — `child_code`. */
  const lookupColumn = process.env.SUPABASE_CHILD_LOOKUP_COLUMN || "code";

  if (supabaseUrl && serviceKey) {
    const base = String(supabaseUrl).replace(/\/+$/, "");
    const url = `${base}/rest/v1/${encodeURIComponent(table)}?${encodeURIComponent(lookupColumn)}=eq.${encodeURIComponent(childCode)}&select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = text;
      try {
        const j = JSON.parse(text);
        detail = j.message || j.error_description || j.details || text;
      } catch {
        /* keep raw text */
      }
      throw new Error(`Supabase ${res.status}: ${detail}`);
    }
    let rows;
    try {
      rows = JSON.parse(text || "[]");
    } catch {
      throw new Error("Supabase returned invalid JSON");
    }
    if (!Array.isArray(rows)) {
      throw new Error(`Supabase returned unexpected response for ${childCode}`);
    }
    const record = rows[0] || null;
    if (!record) {
      throw new Error(
        `Ребёнок с кодом «${childCode}» не найден. Проверь код в таблице ${table}, колонку ${lookupColumn}, и что строка есть в той же базе, что в SUPABASE_URL.`,
      );
    }
    const normalized = normalizeChild(record);
    if (!normalized.childCode) {
      normalized.childCode = childCode;
    }
    return normalized;
  }

  const local = readJson(CHILDREN_FILE, []);
  const record = Array.isArray(local)
    ? local.find((item) => String(item.child_code || item.code) === childCode)
    : null;
  if (!record) throw new Error(`Child ${childCode} not found in local tutor_data/children.json`);
  return normalizeChild(record);
}

function formatRequiredStageBackgroundsBlock(islandKey) {
  const map = getIslandStageBackgroundKeys(String(islandKey || "").trim());
  if (!map) return "";
  const lines = [1, 2, 3, 4, 5, 6].map((n) => `- Stage id ${n} → background: "${map[n]}"`);
  return [
    "REQUIRED STAGE BACKGROUNDS (mandatory — set each stages[i].\"background\" to EXACTLY these strings; stages[i].\"id\" must be 1..6 in order):",
    ...lines,
    "Rule: PREFIX = meta.island_key. Stages 1–2 and 5–6 are PREFIX+1, PREFIX+2, PREFIX+3, PREFIX+4. Stages 3–4 are ONLY the shared cave keys \"2\" then \"3\" (never PREFIX+2 on stage 3).",
    "Forbidden for these stages: cave_entrance, cave_deep, jungle_path, jungle_temple, stage1_generated, stage6_generated.",
    "",
  ].join("\n");
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
        example.keysSixText ? `keys_six=${example.keysSixText}` : "",
        example.lock1Sum != null && example.lock1Sum !== "" ? `lock_sum_1=${example.lock1Sum}` : "",
        example.lock2Sum != null && example.lock2Sum !== "" ? `lock_sum_2=${example.lock2Sum}` : "",
        example.lock3Sum != null && example.lock3Sum !== "" ? `lock_sum_3=${example.lock3Sum}` : "",
        example.lock1KeyA != null && example.lock1KeyA !== "" ? `lock1_keys=${example.lock1KeyA},${example.lock1KeyB}` : "",
        example.lock2KeyA != null && example.lock2KeyA !== "" ? `lock2_keys=${example.lock2KeyA},${example.lock2KeyB}` : "",
        example.lock3KeyA != null && example.lock3KeyA !== "" ? `lock3_keys=${example.lock3KeyA},${example.lock3KeyB}` : "",
        example.note ? `note=${example.note}` : "",
        example.bossMechanic ? `boss_mechanic=${example.bossMechanic}` : "",
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
- Owned artifacts from profile inventory: ${(child.inventory || []).join(", ") || "none"}
- Has freeze ring: ${child.freezeRing ? "yes" : "no"}

LESSON CONTEXT:
- Difficulty: ${context.difficulty}
- Topic label: ${context.topicLabel}
- Topic key: ${context.topicKey}
- Island key (canonical story + stage backgrounds): ${String(context.islandKey || "").trim() || "(none — lesson generator will still require one island from the system prompt list)"}

${formatRequiredStageBackgroundsBlock(context.islandKey)}
If an island key is set above, every stage "background" in your JSON MUST match the REQUIRED STAGE BACKGROUNDS list — no other background tokens for stages 1–6.

RULES:
- English only
- Use English alphabet only (no Cyrillic letters in any text field)
- Return ONLY valid JSON
- Use root fields: meta, story, stages, images_needed, tutor_notes
- Exactly 6 stages
- Exactly 5 rounds per stage
- Keep the tutor's mechanics and example math content
- Tutor input includes mechanics and math examples only. Invent story, villain, artifact names (text), instructions, and tutor notes — but every visual key (backgrounds, image_key, character_key, artifact image key) MUST be copied exactly from the ALLOWED ASSET KEYS block below. Never invent asset filenames or keys.
- Use child system data in meta and completion flow
- For drag_drop, follow strict beach_lesson template: top draggable area + bottom target row, exactly 2 target PNGs per round, draggable count must match tutor screen_item_count. Each stage's background MUST be exactly the tutor draft "background" token for that stage (island sequence + fixed caves — copy it character-for-character from TUTOR STAGE INPUT).
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
- key_lock template: three lock cards each showing lock_sum_N on the card and two slots; six draggable keys with badges from tutor keys_six order; correct pair per lock from tutor pair_N must sum to that lock_sum_N; rounds 1–(n−1): after all three locks solved advance immediately to next round; final round: open chest then NEXT completes stage (no +2 between rounds).
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
  const islandKey = String(draft?.context?.islandKey || "")
    .trim()
    .replace(/\s+/g, "_");
  if (!islandKey) errors.push("Choose an island in the tutor (context.islandKey is required)");
  else if (!CANONICAL_ISLAND_KEYS.includes(islandKey))
    errors.push(`Unknown island_key: ${islandKey}. Use one of: ${CANONICAL_ISLAND_KEYS.join(", ")}`);
  for (const stage of draft?.stages || []) {
    if (!stage.mechanic) errors.push(`Stage ${stage.stageNumber} must have a mechanic`);
    if (stage.mechanic === "boss_mix") {
      if (!Array.isArray(stage.examples)) errors.push(`Stage ${stage.stageNumber} examples must be an array`);
    } else {
      if (!Array.isArray(stage.examples) || stage.examples.length !== 5) errors.push(`Stage ${stage.stageNumber} must have exactly 5 examples`);
    }
  }
  return errors;
}

const MECHANIC_IDS = new Set(MECHANICS.map((m) => m.id));

function coerceMechanic(id, fallback) {
  const s = String(id || "").trim();
  if (MECHANIC_IDS.has(s)) return s;
  return fallback;
}

/** Ensures 6 stages with safe mechanics and correct example counts. Stage 6 is always boss_mix. */
function normalizeAutofillStages(rawStages, islandKey) {
  const list = Array.isArray(rawStages) ? rawStages : [];
  const islandBg = getIslandStageBackgroundKeys(String(islandKey || "").trim());
  const stages = [];
  for (let i = 0; i < 6; i++) {
    const stageNumber = i + 1;
    const incoming = list[i] || {};
    let mechanic = coerceMechanic(incoming.mechanic, stageTemplate(stageNumber).mechanic);
    if (stageNumber === 6) mechanic = "boss_mix";

    const isBoss = mechanic === "boss_mix";
    const examplesIn = Array.isArray(incoming.examples) ? incoming.examples : [];
    const examples = [];

    if (isBoss) {
      for (let groupIdx = 0; groupIdx < 5; groupIdx++) {
        const stageMechanic = stages[groupIdx]?.mechanic || "fill_blank";
        for (let pairIdx = 0; pairIdx < 2; pairIdx++) {
          const exIdx = groupIdx * 2 + pairIdx;
          const base = exampleTemplate(stageNumber, exIdx + 1);
          base.bossMechanic = stageMechanic;
          examples.push(base);
        }
      }
    } else {
      for (let r = 0; r < 5; r++) {
        const base = exampleTemplate(stageNumber, r + 1);
        const ex = examplesIn[r] && typeof examplesIn[r] === "object" ? examplesIn[r] : {};
        examples.push({
          ...base,
          ...ex,
          roundNumber: r + 1,
        });
      }
    }

    const defaultBg = stageBackgroundFor(stageNumber, islandKey);
    const row = {
      stageNumber,
      mechanic,
      background: islandBg ? islandBg[stageNumber] : (incoming.background || defaultBg),
      examples,
    };
    if (incoming.mechanic_reason != null && String(incoming.mechanic_reason).trim() !== "") {
      row.mechanic_reason = String(incoming.mechanic_reason).trim();
    }
    stages.push(row);
  }
  return stages;
}

function mergeAutofillDraftPayload(parsed, childCode, normalizedChild, tutorPrompt) {
  const tc = parsed.tutorContext && typeof parsed.tutorContext === "object" ? parsed.tutorContext : {};
  const prevCtx = readJson(DRAFT_FILE, buildDefaultDraft()).context || {};
  const islandKeyRaw =
    parsed.context?.islandKey ??
    parsed.context?.island_key ??
    parsed.islandKey ??
    tc.islandKey ??
    "";
  const islandKey = String(islandKeyRaw || prevCtx.islandKey || "")
    .trim()
    .replace(/\s+/g, "_");
  const stages = normalizeAutofillStages(parsed.stages, islandKey);
  const out = {
    draftId: parsed.draftId || "current",
    childCode: String(parsed.childCode || childCode || "").trim() || childCode,
    confirmedChildCode: childCode,
    child: normalizedChild,
    tutorPrompt: tutorPrompt ?? parsed.tutorPrompt ?? "",
    context: {
      ...prevCtx,
      difficulty: prevCtx.difficulty || "medium",
      topicLabel: parsed.context?.topicLabel || prevCtx.topicLabel || "Tutor-made lesson",
      topicKey: parsed.context?.topicKey || prevCtx.topicKey || "custom_math_lesson",
      knows: tc.knows ?? parsed.context?.knows ?? prevCtx.knows ?? "",
      weakPoint: tc.weakPoint ?? parsed.context?.weakPoint ?? prevCtx.weakPoint ?? "",
      notes: tc.notes ?? parsed.context?.notes ?? prevCtx.notes ?? "",
      islandKey: islandKey || prevCtx.islandKey || "",
    },
    stages,
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
  syncDraftStageBackgroundsFromIslandKey(out);
  return out;
}

function buildAutofillSystemPrompt(childBlock, tutorPrompt) {
  const name = String(childBlock.name ?? "Student");
  const age = Number(childBlock.age);
  const ageStr = Number.isFinite(age) ? String(age) : "7";
  const level = Number(childBlock.level ?? 0);
  const coins = Number(childBlock.coins ?? 0);
  const ck = String(childBlock.character_key || childBlock.characterKey || "pirate_green");
  const tplPath = path.join(__dirname, "autofill_prompt.txt");
  const tpl = fs.readFileSync(tplPath, "utf-8");
  return tpl
    .replace(/\{\{NAME\}\}/g, name)
    .replace(/\{\{AGE\}\}/g, ageStr)
    .replace(/\{\{LEVEL\}\}/g, String(level))
    .replace(/\{\{COINS\}\}/g, String(coins))
    .replace(/\{\{CHARACTER_KEY\}\}/g, ck)
    .replace(/\{\{TUTOR_PROMPT\}\}/g, tutorPrompt);
}

function inferChildAgeForAutofill(childPayload, normalizedChild) {
  const raw =
    childPayload?.age ??
    childPayload?.age_years ??
    normalizedChild?.age ??
    normalizedChild?.ageYears;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 4 && n <= 12) return n;
  const lvl = Number(normalizedChild?.level ?? childPayload?.level ?? 1);
  return Math.min(9, Math.max(5, 5 + Math.floor(lvl / 2)));
}

async function generateAutofillDraft(body) {
  const tutorPrompt = String(body?.tutor_prompt ?? body?.tutorPrompt ?? "").trim();
  if (!tutorPrompt) {
    const err = new Error("tutor_prompt is required");
    err.details = ["Describe what to work on, e.g. 'multiplication, difficulty 5'"];
    throw err;
  }

  const childPayload = body?.child && typeof body.child === "object" ? body.child : {};
  const childCode = String(childPayload.child_code || childPayload.childCode || body.childCode || "").trim();
  if (!childCode) {
    const err = new Error("child.childCode or child_code is required");
    err.details = [];
    throw err;
  }

  let normalizedChild = normalizeChild({
    ...childPayload,
    child_code: childCode,
    character_key: childPayload.character_key || childPayload.characterKey,
  });

  try {
    const dbChild = await fetchChildRecord(childCode);
    normalizedChild = { ...normalizedChild, ...dbChild, childCode };
  } catch {
    normalizedChild = {
      ...normalizedChild,
      childCode,
      name: normalizedChild.name || childPayload.name || "Student",
      coins: Number(childPayload.coins ?? normalizedChild.coins ?? 0),
      level: Number(childPayload.level ?? normalizedChild.level ?? 1),
      characterKey: childPayload.character_key || childPayload.characterKey || normalizedChild.characterKey || "pirate_green",
      characterImagePath: normalizedChild.characterImagePath || `assets/characters/${childPayload.character_key || childPayload.characterKey || "pirate_green"}.webp`,
    };
  }

  const age = inferChildAgeForAutofill(childPayload, normalizedChild);
  normalizedChild = { ...normalizedChild, age };

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in environment/.env");
  }

  const childBlock = {
    name: normalizedChild.name,
    age,
    level: normalizedChild.level,
    coins: normalizedChild.coins,
    character_key: normalizedChild.characterKey,
  };

  const forcedIsland = String(body?.island_key ?? body?.islandKey ?? "").trim().replace(/\s+/g, "_");
  if (forcedIsland && !CANONICAL_ISLAND_KEYS.includes(forcedIsland)) {
    const err = new Error("Invalid island_key");
    err.details = [`Must be one of: ${CANONICAL_ISLAND_KEYS.join(", ")}`];
    throw err;
  }

  const system = buildAutofillSystemPrompt(childBlock, tutorPrompt);
  let userMsg = `Generate the lesson draft JSON for child code ${childCode}. Output tutorContext, context (topicLabel, topicKey, islandKey, knows, weakPoint, notes), and stages (6 unique mechanics, 5 rounds each); fields must match each chosen mechanic.`;
  if (forcedIsland) {
    userMsg += `\n\nTUTOR-SELECTED ISLAND (mandatory — do not change):\n- context.islandKey MUST be exactly: "${forcedIsland}"\n- Set every stage "background" to the six-step pattern for this island (see ISLAND KEY section in system prompt).\n`;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 16384,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    response_format: { type: "json_object" },
  });
  const text = response.choices[0]?.message?.content || "";
  const parsed = parseClaudeJson(text);
  const draft = mergeAutofillDraftPayload(parsed, childCode, normalizedChild, tutorPrompt);
  if (forcedIsland) {
    draft.context = draft.context && typeof draft.context === "object" ? draft.context : {};
    draft.context.islandKey = forcedIsland;
    syncDraftStageBackgroundsFromIslandKey(draft);
  }
  writeJson(DRAFT_FILE, draft);
  return draft;
}

function validateLessonShape(lesson) {
  const errors = [];
  if (!lesson || typeof lesson !== "object") errors.push("Lesson must be a JSON object");
  if (!lesson.meta) errors.push("Missing meta");
  const ik = String(lesson.meta?.island_key || lesson.meta?.islandKey || "")
    .trim()
    .replace(/\s+/g, "_");
  if (!ik) errors.push("Missing meta.island_key");
  else if (!CANONICAL_ISLAND_KEYS.includes(ik)) errors.push(`Invalid meta.island_key: ${ik}`);
  if (!lesson.story) errors.push("Missing story");
  if (!Array.isArray(lesson.stages) || lesson.stages.length !== 6) errors.push("stages must be exactly 6");
  return errors;
}

function readCurrentLesson() {
  return readJson(OUT_FILE, null);
}

async function generateLessonFromDraft(draft, options = {}) {
  const manualStrict = Boolean(options?.manualStrict);
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

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in environment/.env");
  }

  const assetCatalog = buildAssetCatalog();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 7000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPromptFromDraft(draft, assetCatalog) },
    ],
    response_format: { type: "json_object" },
  });
  const text = response.choices[0]?.message?.content || "";
  const lesson = parseClaudeJson(text);
  if (manualStrict) {
    buildStrictManualStageShell(lesson, draft);
  }
  applyDraftToLessonStages(lesson, draft);
  enforceEnglishText(lesson);
  lesson.meta = lesson.meta || {};
  lesson.meta.child_inventory = Array.isArray(draft.child?.inventory) ? draft.child.inventory : [];
  lesson.meta.has_freeze_ring = Boolean(draft.child?.freezeRing);
  if (draft.child) {
    const ch = draft.child;
    lesson.meta.student_code = ch.childCode || lesson.meta.student_code;
    lesson.meta.student_name = ch.name || lesson.meta.student_name;
    lesson.meta.student_level = Number(ch.level ?? lesson.meta.student_level ?? 0);
    lesson.meta.student_coins = Number(ch.coins ?? lesson.meta.student_coins ?? 0);
    lesson.meta.start_coins = Number(ch.coins ?? lesson.meta.start_coins ?? 0);
    if (ch.characterKey) lesson.meta.character_key = ch.characterKey;
  }
  const ik = String(draft?.context?.islandKey || "")
    .trim()
    .replace(/\s+/g, "_");
  lesson.meta.island_key = ik;
  clampLessonAssetKeys(lesson, assetCatalog);
  /** Canon story + six background stems — always from island pack, not the model. */
  applyIslandLessonCanon(lesson, draft);
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

async function buildLessonFromDraftNoAI(draft) {
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

  const assetCatalog = buildAssetCatalog();
  const baseLesson = readCurrentLesson();
  const lesson =
    baseLesson && typeof baseLesson === "object"
      ? JSON.parse(JSON.stringify(baseLesson))
      : {
          meta: {},
          story: {},
          stages: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, rounds: [] })),
          images_needed: {},
          tutor_notes: [],
        };

  buildStrictManualStageShell(lesson, draft);
  applyDraftToLessonStages(lesson, draft);
  enforceEnglishText(lesson);
  lesson.meta = lesson.meta || {};
  lesson.meta.child_inventory = Array.isArray(draft.child?.inventory) ? draft.child.inventory : [];
  lesson.meta.has_freeze_ring = Boolean(draft.child?.freezeRing);
  if (draft.child) {
    const ch = draft.child;
    lesson.meta.student_code = ch.childCode || lesson.meta.student_code;
    lesson.meta.student_name = ch.name || lesson.meta.student_name;
    lesson.meta.student_level = Number(ch.level ?? lesson.meta.student_level ?? 0);
    lesson.meta.student_coins = Number(ch.coins ?? lesson.meta.student_coins ?? 0);
    lesson.meta.start_coins = Number(ch.coins ?? lesson.meta.start_coins ?? 0);
    if (ch.characterKey) lesson.meta.character_key = ch.characterKey;
  }
  const ik = String(draft?.context?.islandKey || "")
    .trim()
    .replace(/\s+/g, "_");
  lesson.meta.island_key = ik;
  applyIslandLessonCanon(lesson, draft);
  clampLessonAssetKeys(lesson, assetCatalog);
  if (!lesson.images_needed || typeof lesson.images_needed !== "object") {
    lesson.images_needed = {};
  }
  if (!Array.isArray(lesson.tutor_notes)) {
    lesson.tutor_notes = [];
  }
  const errors = validateLessonShape(lesson);
  if (errors.length) {
    const err = new Error("Manual lesson shape is invalid");
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
    res.writeHead(200, { "Content-Type": mime, "Content-Length": String(size), "Cache-Control": "no-store" });
    res.end();
    return;
  }
  const buf = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": mime, "Content-Length": String(buf.length), "Cache-Control": "no-store" });
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

async function patchChildLessonComplete(payload) {
  const code = String(payload.code || "").trim();
  if (!code) {
    const err = new Error("code is required");
    err.details = [];
    throw err;
  }
  const finalCoins = Number(payload.finalCoins);
  const newLevel = Number(payload.newLevel);
  if (!Number.isFinite(finalCoins) || finalCoins < 0) {
    const err = new Error("finalCoins must be a non-negative number");
    err.details = [];
    throw err;
  }
  if (!Number.isFinite(newLevel) || newLevel < 0) {
    const err = new Error("newLevel must be a non-negative number");
    err.details = [];
    throw err;
  }
  const inventory = Array.isArray(payload.inventory) ? payload.inventory : [];

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const table = process.env.SUPABASE_CHILDREN_TABLE || "children";
  const lookupColumn = process.env.SUPABASE_CHILD_LOOKUP_COLUMN || "code";

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase is not configured (SUPABASE_URL / key)");
  }

  const base = String(supabaseUrl).replace(/\/+$/, "");
  const patchUrl = `${base}/rest/v1/${encodeURIComponent(table)}?${encodeURIComponent(lookupColumn)}=eq.${encodeURIComponent(code)}`;

  const row = {
    coins: Math.round(finalCoins),
    level: Math.round(newLevel),
    inventory,
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase PATCH ${res.status}: ${text}`);
  }
  let rows;
  try {
    rows = JSON.parse(text || "[]");
  } catch {
    rows = [];
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No row updated for code «${code}». Check code and ${lookupColumn} in Supabase.`);
  }
  return { updated: rows[0] };
}

function corsLessonCompleteHeaders() {
  const origin = process.env.CORS_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
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

    if (req.method === "GET" && url.pathname.match(/^\/[\w\-]+\.html$/) && url.pathname !== "/") {
      const htmlFile = path.join(__dirname, url.pathname.slice(1));
      if (fs.existsSync(htmlFile)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(fs.readFileSync(htmlFile, "utf-8"));
        return;
      }
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
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
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
        fixedBackgrounds: DEFAULT_STAGE_BACKGROUNDS,
        canonicalIslandKeys: CANONICAL_ISLAND_KEYS,
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

    if (req.method === "OPTIONS" && url.pathname === "/api/lesson-complete") {
      res.writeHead(204, corsLessonCompleteHeaders());
      res.end();
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/lesson-complete") {
      try {
        const payload = JSON.parse((await readBody(req)) || "{}");
        const result = await patchChildLessonComplete(payload);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          ...corsLessonCompleteHeaders(),
        });
        res.end(JSON.stringify({ ok: true, ...result }));
      } catch (err) {
        res.writeHead(422, {
          "Content-Type": "application/json; charset=utf-8",
          ...corsLessonCompleteHeaders(),
        });
        res.end(JSON.stringify({ ok: false, error: err.message || "Update failed" }));
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/drafts/save") {
      const payload = JSON.parse((await readBody(req)) || "{}");
      const draft = payload.draft;
      if (!draft || typeof draft !== "object") {
        sendJson(res, 422, { ok: false, error: "Draft payload is required" });
        return;
      }
      syncDraftStageBackgroundsFromIslandKey(draft);
      draft.updatedAt = new Date().toISOString();
      writeJson(DRAFT_FILE, draft);
      sendJson(res, 200, { ok: true, savedAt: draft.updatedAt, draft });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/autofill") {
      try {
        const payload = JSON.parse((await readBody(req)) || "{}");
        const draft = await generateAutofillDraft(payload);
        sendJson(res, 200, { ok: true, draft });
      } catch (err) {
        sendJson(res, 422, {
          ok: false,
          error: err.message || "Autofill failed",
          details: err.details || null,
        });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/generate") {
      const payload = JSON.parse((await readBody(req)) || "{}");
      const draft =
        payload.draft && typeof payload.draft === "object"
          ? payload.draft
          : readJson(DRAFT_FILE, buildDefaultDraft());
      const manualStrict = Boolean(payload.manualStrict);
      const jobId = "gen_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      generationJobs.set(jobId, { status: "pending", createdAt: Date.now() });
      sendJson(res, 200, { ok: true, jobId });
      (async () => {
        try {
          const lesson = await generateLessonFromDraft(draft, { manualStrict });
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

    if (req.method === "POST" && url.pathname === "/api/build-from-draft") {
      const payload = JSON.parse((await readBody(req)) || "{}");
      const draft =
        payload.draft && typeof payload.draft === "object"
          ? payload.draft
          : readJson(DRAFT_FILE, buildDefaultDraft());
      const lesson = await buildLessonFromDraftNoAI(draft);
      sendJson(res, 200, { ok: true, lesson });
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
      const payload = JSON.parse((await readBody(req)) || "{}");
      const lesson = (payload.lesson && typeof payload.lesson === "object")
        ? payload.lesson
        : readCurrentLesson();
      if (!lesson) {
        sendJson(res, 422, { ok: false, error: "No lesson data. Generate a lesson first." });
        return;
      }
      const fileName = buildGeneratedHtmlFilename(lesson);
      const sessionId = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const sessionFile = path.join(DATA_DIR, `session_${sessionId}.json`);
      const outputRelativePath = path.join("generated_lessons", fileName);
      try {
        fs.writeFileSync(sessionFile, JSON.stringify(lesson, null, 2), "utf-8");
        const output = await runNodeScript(["builder.mjs", sessionFile, outputRelativePath]);
        sendJson(res, 200, {
          ok: true,
          output,
          generatedFileName: fileName,
          generatedFileUrl: `/generated-lessons/${fileName}?v=${Date.now()}`,
        });
      } finally {
        try { fs.unlinkSync(sessionFile); } catch {}
      }
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
