import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SYSTEM_PROMPT = fs.readFileSync(path.resolve(__dirname, "./system_prompt.txt"), "utf-8");

const MECHANICS_15 = new Set([
  "drag_drop",
  "drag_sort",
  "drag_group",
  "pattern_input",
  "fill_blank",
  "multi_choice",
  "key_lock",
  "corridor_choice",
  "match_pairs",
  "number_line",
  "tap_count",
  "balance_scale",
  "build_number",
  "abacus",
  "timer_challenge",
]);

const TEST_FORM = {
  child_name: "Alex",
  child_code: "MONKEY-4821",
  age: 7,
  difficulty: "medium",
  topic: "sequences_patterns",
  topic_label: "Patterns & sequences",
  lesson_number: 1,
  island: 2,
  weak_points: "Jumps to answer before naming the rule",
  focus: "What comes next and why (sequence logic)",
  knows: "Counts to 20, knows +1 and +2 steps",
  notes: "Likes stories; keep tasks short",
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
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
- Weak: ${form.weak_points}
- Focus: ${form.focus}
- Knows: ${form.knows}
- Notes: ${form.notes}

REQUIREMENTS:
- Root object: meta, story (act1, act2, act3, goal, island, villain, artifact), exactly 6 stages, images_needed, tutor_notes
- story replaces story_hook
- each stage: mechanic_reason + type from the 15 mechanics (stage 6 may be animation for finale)
- follow mechanic mix rules from system prompt
- include images_needed.generate_with_dalle entry { "key": "artifact", "prompt": <from stage 6 artifact.dalle_prompt>, "count": 1 }
- Be compact: instruction / success_message short; tutor_notes fields max ~120 chars each

Return ONLY valid JSON. Start with {`;
}

function validateLesson(data) {
  const errors = [];
  const warnings = [];
  const infoLines = [];

  const lesson = data.lesson || data;

  if (!lesson.meta) errors.push("No meta");

  const story = lesson.story;
  if (!story) {
    errors.push("No story (v2 requires story instead of story_hook)");
  } else {
    ["act1", "act2", "act3", "goal", "island_name", "villain", "artifact_name", "artifact_emoji"].forEach(
      (k) => {
        if (!String(story[k] || "").trim()) errors.push(`story.${k} is missing or empty`);
      },
    );
  }

  const stages = lesson.blocks || lesson.stages;
  if (!stages || !Array.isArray(stages)) {
    errors.push("No blocks/stages");
  } else {
    if (stages.length !== 6) {
      errors.push(`Stages: ${stages.length}, must be exactly 6`);
    }

    const types = stages.map((s) => s.type).filter(Boolean);
    for (let i = 0; i < types.length - 1; i++) {
      if (types[i] === types[i + 1]) {
        errors.push(
          `Consecutive same mechanic: "${types[i]}" at stage ${i + 1} and ${i + 2}`,
        );
      }
    }

    const timerIdx = types.findIndex((t) => t === "timer_challenge");
    if (timerIdx === 0 || timerIdx === 5) {
      errors.push("timer_challenge must not be first or last stage");
    }

    const unique = new Set(types.filter((t) => t !== "animation"));
    if (unique.size < 3) {
      errors.push(
        `Need at least 3 distinct non-animation mechanics, got: ${[...unique].join(", ") || "none"}`,
      );
    }

    stages.forEach((s, i) => {
      if (!s.mechanic_reason || !String(s.mechanic_reason).trim()) {
        errors.push(`Stage ${i + 1}: missing mechanic_reason`);
      }
      const t = s.type;
      if (t === "animation") {
        if (i !== 5) warnings.push("animation is usually final stage 6 only");
        return;
      }
      if (!MECHANICS_15.has(t)) {
        if (t === "input" || t === "choice")
          warnings.push(
            `Stage ${i + 1}: legacy type "${t}" — prefer pattern_input / fill_blank / multi_choice from v2 list where applicable`,
          );
        else
          errors.push(
            `Stage ${i + 1}: unknown type "${t}" (use one of 15 mechanics or animation)`,
          );
      }
    });

    const s1 = stages[0];
    if (s1 && s1.type !== "drag_drop" && s1.type !== "tap_count") {
      errors.push(`Stage 1 must be drag_drop or tap_count, got: ${s1.type}`);
    }

    const last = stages[stages.length - 1];
    if (last && last.type === "animation") {
      const a = last.artifact;
      if (!a || typeof a !== "object") {
        errors.push("Final animation stage: missing artifact { emoji, name, description, dalle_prompt }");
      } else {
        ["emoji", "name", "description", "dalle_prompt"].forEach((k) => {
          if (!String(a[k] || "").trim()) errors.push(`Final stage artifact.${k} is missing or empty`);
        });
      }
    } else {
      errors.push("Last stage (6) must be type animation with artifact");
    }

    infoLines.push("Mechanics + reasons:");
    stages.forEach((s, i) => {
      const r = (s.mechanic_reason || "").replace(/\s+/g, " ").trim();
      const short = r.length > 90 ? r.slice(0, 90) + "…" : r;
      infoLines.push(`  ${i + 1}. [${s.type || "?"}] ${short}`);
    });
  }

  const dalle = lesson.images_needed?.generate_with_dalle || [];
  const hasArtifact = dalle.some((e) => e && String(e.key) === "artifact");
  if (!hasArtifact) {
    errors.push('images_needed.generate_with_dalle must include { key: "artifact", ... }');
  } else {
    const artEntry = dalle.find((e) => e && String(e.key) === "artifact");
    const lastStage = stages && Array.isArray(stages) ? stages[stages.length - 1] : null;
    const dalleP = String(lastStage?.artifact?.dalle_prompt || "").trim();
    if (dalleP && artEntry && String(artEntry.prompt || "").trim() !== dalleP) {
      warnings.push(
        "images_needed artifact prompt should match final stage artifact.dalle_prompt exactly",
      );
    }
  }

  if (lesson.story_hook) {
    if (story) warnings.push("Remove root story_hook; v2 uses story{} only");
    else warnings.push("Legacy story_hook present; v2 should use story{} instead");
  }
  if (!lesson.images_needed) warnings.push("No images_needed");
  if (!lesson.tutor_notes) warnings.push("No tutor_notes");

  return { errors, warnings, lesson, stages, infoLines };
}

async function main() {
  loadDotEnv();

  console.log("Testing lesson generation (Claude)…\n");
  console.log("Topic:", TEST_FORM.topic_label, "|", TEST_FORM.child_name, "|", TEST_FORM.difficulty);
  console.log("─".repeat(60) + "\n");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set (.env or export).");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const startTime = Date.now();
  let rawResponse = "";

  process.stdout.write("Claude streaming");

  const stream = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(TEST_FORM) }],
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      rawResponse += event.delta.text;
      process.stdout.write(".");
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(` done in ${elapsed}s\n`);

  let parsed;
  try {
    let cleaned = rawResponse.trim();
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end >= 0) cleaned = cleaned.slice(start, end + 1);
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("Invalid JSON:", e.message);
    fs.writeFileSync(path.join(__dirname, "raw_response.txt"), rawResponse);
    process.exit(1);
  }

  const { errors, warnings, lesson, stages, infoLines } = validateLesson(parsed);

  console.log("═".repeat(60));
  console.log("VALIDATION");
  console.log("═".repeat(60));
  if (errors.length) errors.forEach((e) => console.log("Error:", e));
  if (warnings.length) warnings.forEach((w) => console.log("Warning:", w));
  if (errors.length === 0 && warnings.length === 0) console.log("All checks passed.\n");
  else console.log();

  if (infoLines.length) {
    infoLines.forEach((line) => console.log(line));
    console.log();
  }

  console.log("Summary:");
  console.log("  Island / story.island_name:", lesson.story?.island_name || lesson.island_name || "—");
  const goal = lesson.story?.goal || "—";
  console.log("  story.goal:", String(goal).slice(0, 100) + (String(goal).length > 100 ? "…" : ""));

  fs.writeFileSync(path.join(__dirname, "output_lesson.json"), JSON.stringify(parsed, null, 2), "utf-8");
  console.log("\nSaved: output_lesson.json");
  console.log("Size:", (JSON.stringify(parsed).length / 1024).toFixed(1), "KB");

  if (errors.length) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
