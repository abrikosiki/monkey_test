import fs from "fs/promises";
import path from "path";
import os from "os";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

const STYLE_SUFFIX =
  "stylized fantasy game asset, hand-painted 3D illustration, high detail, warm golden lighting, soft cinematic glow, semi-realistic textures, slightly exaggerated shapes, polished surfaces with subtle wear, clean edges, vibrant but natural color palette, magical atmosphere, soft ambient occlusion, gentle highlights and rim light, high contrast between warm gold and cool shadows, game-ready UI object, centered composition, isolated on transparent background, no noise, ultra sharp, Pixar-level quality, mobile game art style, Clash Royale / fantasy RPG aesthetic, rich materials (gold, stone, wood, crystal), soft bloom, depth and volume emphasized";
const STAGE_BG_PROMPT_BASE =
  "cinematic wide scene, magical jungle environment, warm golden sunlight, soft volumetric light rays, lush tropical plants, detailed rocks and moss, whimsical cartoon style, cute little monkeys peeking from behind leaves and rocks, expressive faces, soft 3D animation look (Pixar / Disney style), highly detailed, depth of field, glowing highlights, rich colors, adventure atmosphere. composition: main scene on the LEFT side (around 60-70% of frame), detailed environment with a path leading to a mysterious ancient stone door / cave entrance / jungle location. RIGHT side: clean empty soft gradient background (light beige to warm cream), blurred, minimal detail, smooth texture, no objects, no characters, perfect negative space for text. lighting balanced so left side is vivid and right side is soft and readable, ultra high quality, sharp details, cinematic composition, no text";
const WHITE_BG_PROMPT_HINT =
  "single object only, centered, pure white background, no text, no letters, no numbers, no shadows";

function usage() {
  console.log("Usage: node generate_assets.mjs <lesson.json>");
  console.log("Requires env: OPENAI_API_KEY");
  console.log("Generates only missing assets (safe budget mode).");
}

function sanitizeLesson(raw) {
  const lesson = raw?.lesson ?? raw;
  if (!lesson || typeof lesson !== "object") {
    throw new Error("Lesson JSON is empty or invalid");
  }
  return lesson;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function keyFamily(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/\.(png|webp|jpg|jpeg)$/i, "")
    .replace(/_(blue|red|green|yellow|purple|orange|small|big|v\d+|\d+)$/i, "");
}

async function listAssetFiles(dirPath) {
  const result = [];
  const allowed = new Set([".png", ".webp", ".jpg", ".jpeg"]);
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowed.has(ext)) continue;
      result.push({
        name: entry.name,
        base: path.basename(entry.name, ext),
        fullPath: path.join(dirPath, entry.name),
      });
    }
  } catch {
    // ignore
  }
  return result;
}

async function reuseUniversalLibraryAsset(libraryDir, key) {
  const family = keyFamily(key);
  if (!family) return false;
  const files = await listAssetFiles(libraryDir);
  const candidate = files.find((f) => keyFamily(f.base) === family && f.base !== key);
  if (!candidate) return false;
  const targetPath = path.join(libraryDir, `${key}.png`);
  await fs.copyFile(candidate.fullPath, targetPath);
  console.log(`Reuse universal library: ${key} <- ${candidate.name}`);
  return true;
}

function libraryPromptFromKey(key) {
  const k = String(key || "").toLowerCase();
  const base = "Single game asset, centered, transparent background, no text, no frame, one object only.";
  const color = k.includes("blue")
    ? "blue"
    : k.includes("red")
      ? "red"
      : k.includes("green")
        ? "green"
        : "";
  if (k.includes("cherry")) return `${base} Glossy ripe red cherries on stem, cute mobile game icon.`;
  if (k.includes("plum")) return `${base} Juicy purple plums, cute mobile game icon.`;
  if (k.includes("bowl") && k.includes("wood"))
    return `${base} Rustic wooden bowl for fruit, empty inside, warm brown wood grain.`;
  if (k.includes("bowl")) return `${base} Cute empty ceramic bowl game icon.`;
  if (k.includes("basket")) return `${base} Woven tropical basket game icon.`;
  if (k.includes("banana")) return `${base} Small bunch of ripe bananas game icon.`;
  if (k.includes("leaf")) return `${base} Tropical green leaves bundle game icon.`;
  if (k.includes("shell"))
    return `${base} ${color ? `${color} ` : ""}sea shell game icon, distinct silhouette.`;
  if (k.includes("pearl")) return `${base} Shiny pearl cluster game icon.`;
  if (k.includes("stone") || k.includes("rock")) return `${base} Round smooth stone game icon.`;
  if (k.includes("crab")) return `${base} Friendly cartoon crab game icon.`;
  if (k.includes("samurai") || (k.includes("monkey") && k.includes("villain")))
    return `${base} Silly cartoon monkey in tiny samurai helmet, round face, not scary, mascot style.`;
  if (k.includes("monkey")) return `${base} Cute cartoon monkey mascot face, expressive eyes.`;
  if (k.includes("treat") || k.includes("cookie") || k.includes("candy"))
    return `${base} Colorful wrapped candy / cookie treat stack, cute game pickup.`;
  return `${base} Cartoon object for key "${key}", readable silhouette, fantasy game prop.`;
}

function collectImageKeysFromLesson(lesson) {
  const out = new Set();
  const add = (v) => {
    const s = String(v || "").trim();
    if (s) out.add(s);
  };
  const walk = (st) => {
    if (!st || typeof st !== "object") return;
    (st.draggables || []).forEach((d) => add(d.image_key));
    (st.drop_zones || []).forEach((z) => add(z.image_key));
    (st.items || []).forEach((it) => add(it.image_key));
  };
  for (const st of lesson.stages || lesson.blocks || []) {
    walk(st);
    (st.practice_tasks || []).forEach(walk);
    (st.rounds || []).forEach(walk);
  }
  return out;
}

function mergeDalleJobs(lesson) {
  const merged = new Map();
  for (const job of lesson.images_needed?.generate_with_dalle || []) {
    const k = String(job.key || "").trim();
    if (!k) continue;
    const p = String(job.prompt || "").trim() || libraryPromptFromKey(k);
    merged.set(k, { key: k, prompt: p, count: job.count ?? 1 });
  }
  const addIfMissing = (rawKey) => {
    const k = String(rawKey || "").trim();
    if (!k || merged.has(k)) return;
    merged.set(k, { key: k, prompt: libraryPromptFromKey(k), count: 1 });
  };
  for (const k of collectImageKeysFromLesson(lesson)) addIfMissing(k);
  for (const k of lesson.images_needed?.library || []) addIfMissing(k);
  return [...merged.values()];
}

async function loadDotEnv(projectRoot) {
  const envPath = path.join(projectRoot, ".env");
  try {
    const text = await fs.readFile(envPath, "utf-8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional
  }
}

async function generateImageWithDalle({ prompt, size = "1024x1024", apiKey }) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size,
      output_format: "png",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI image generation failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI image response missing data[0].b64_json");
  }
  return Buffer.from(b64, "base64");
}

async function resolveRembgCommand() {
  const candidates = [
    "rembg",
    "/Library/Frameworks/Python.framework/Versions/3.14/bin/rembg",
    "python3 -m rembg",
  ];
  for (const cmd of candidates) {
    try {
      await execAsync(`${cmd} --help`, { timeout: 8000 });
      return cmd;
    } catch {
      // try next
    }
  }
  return "";
}

async function cutBackgroundWithRembg({ rembgCmd, inputPath, outputPath }) {
  await execAsync(`${rembgCmd} i "${inputPath}" "${outputPath}"`, { timeout: 180000 });
}

async function main() {
  const args = process.argv.slice(2);
  const inputArg = args.find((arg) => !arg.startsWith("--"));
  if (args.includes("--refresh")) {
    throw new Error("--refresh is disabled in safe budget mode");
  }
  if (!inputArg) {
    usage();
    process.exit(1);
  }
  await loadDotEnv(process.cwd());
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) throw new Error("OPENAI_API_KEY is not set");
  const rembgCmd = await resolveRembgCommand();
  if (!rembgCmd) {
    throw new Error(
      "rembg CLI is not available. Install with: python3 -m pip install \"rembg[cpu,cli]\""
    );
  }
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "monkey-rembg-"));

  const inputPath = path.resolve(process.cwd(), inputArg);
  const generatedDir = path.resolve(process.cwd(), "assets/generated");
  const libraryDir = path.resolve(process.cwd(), "assets/library");
  const backgroundsDir = path.resolve(process.cwd(), "assets/backgrounds");
  await ensureDir(generatedDir);
  await ensureDir(libraryDir);
  await ensureDir(backgroundsDir);

  const rawText = await fs.readFile(inputPath, "utf-8");
  const lesson = sanitizeLesson(JSON.parse(rawText));
  const jobs = mergeDalleJobs(lesson);
  const discovered = [...collectImageKeysFromLesson(lesson)];
  console.log(
    `Image jobs: ${jobs.length} (explicit + library + stage image_keys). Stage keys: ${discovered.join(", ") || "—"}`
  );

  let created = 0;
  let skipped = 0;
  for (const job of jobs) {
    const key = String(job.key || "").trim();
    const prompt = String(job.prompt || "").trim();
    if (!key || !prompt) continue;

    const targetPng = path.join(generatedDir, `${key}.png`);
    const targetWebp = path.join(generatedDir, `${key}.webp`);
    const targetJpg = path.join(generatedDir, `${key}.jpg`);
    const targetJpeg = path.join(generatedDir, `${key}.jpeg`);
    if (
      (await fileExists(targetPng)) ||
      (await fileExists(targetWebp)) ||
      (await fileExists(targetJpg)) ||
      (await fileExists(targetJpeg))
    ) {
      console.log(`Skip existing: ${key}`);
      skipped += 1;
      continue;
    }

    console.log(`Generating → assets/generated/${key}.png`);
    const styledPrompt = `${String(prompt).trim()}. ${WHITE_BG_PROMPT_HINT}. ${STYLE_SUFFIX}`;
    try {
      const image = await generateImageWithDalle({ prompt: styledPrompt, size: "1024x1024", apiKey: openAiApiKey });
      const tmpRaw = path.join(tmpDir, `${key}_raw.png`);
      await fs.writeFile(tmpRaw, image);
      await cutBackgroundWithRembg({ rembgCmd, inputPath: tmpRaw, outputPath: targetPng });
      await fs.unlink(tmpRaw).catch(() => {});
      created += 1;
    } catch (err) {
      console.log(`Skip generation (API error) for ${key}: ${err.message}`);
    }
  }

  let libraryCreated = 0;
  let librarySkipped = 0;
  const jobKeys = new Set(jobs.map((j) => String(j.key || "").trim()).filter(Boolean));
  for (const rawKey of lesson.images_needed?.library || []) {
    const key = String(rawKey || "").trim();
    if (!key || jobKeys.has(key)) {
      if (key && jobKeys.has(key)) console.log(`Library key "${key}" covered by merged generate jobs → skipped duplicate.`);
      continue;
    }
    const targetPng = path.join(libraryDir, `${key}.png`);
    const targetWebp = path.join(libraryDir, `${key}.webp`);
    const targetJpg = path.join(libraryDir, `${key}.jpg`);
    const targetJpeg = path.join(libraryDir, `${key}.jpeg`);
    if (
      (await fileExists(targetPng)) ||
      (await fileExists(targetWebp)) ||
      (await fileExists(targetJpg)) ||
      (await fileExists(targetJpeg))
    ) {
      console.log(`Skip existing library: ${key}`);
      librarySkipped += 1;
      continue;
    }

    if (await reuseUniversalLibraryAsset(libraryDir, key)) {
      librarySkipped += 1;
      continue;
    }

    const prompt = libraryPromptFromKey(key);
    console.log(`Generating library (legacy path): ${key}`);
    try {
      const styledPrompt = `${prompt}. ${WHITE_BG_PROMPT_HINT}. ${STYLE_SUFFIX}`;
      const image = await generateImageWithDalle({ prompt: styledPrompt, size: "1024x1024", apiKey: openAiApiKey });
      const tmpRaw = path.join(tmpDir, `${key}_raw.png`);
      await fs.writeFile(tmpRaw, image);
      await cutBackgroundWithRembg({ rembgCmd, inputPath: tmpRaw, outputPath: targetPng });
      await fs.unlink(tmpRaw).catch(() => {});
      libraryCreated += 1;
    } catch (err) {
      console.log(`Skip library generation (API error) for ${key}: ${err.message}`);
    }
  }

  let backgroundsCreated = 0;
  let backgroundsSkipped = 0;
  const bgJobs = [
    { key: "stage1_generated", prompt: `jungle quest opening scene. ${STAGE_BG_PROMPT_BASE}` },
    { key: "stage6_generated", prompt: `jungle finale victory scene with magical energy. ${STAGE_BG_PROMPT_BASE}` },
  ];
  for (const job of bgJobs) {
    const targetPng = path.join(backgroundsDir, `${job.key}.png`);
    const targetWebp = path.join(backgroundsDir, `${job.key}.webp`);
    const targetJpg = path.join(backgroundsDir, `${job.key}.jpg`);
    const targetJpeg = path.join(backgroundsDir, `${job.key}.jpeg`);
    if (
      (await fileExists(targetPng)) ||
      (await fileExists(targetWebp)) ||
      (await fileExists(targetJpg)) ||
      (await fileExists(targetJpeg))
    ) {
      console.log(`Skip existing background: ${job.key}`);
      backgroundsSkipped += 1;
      continue;
    }
    console.log(`Generating background: ${job.key}`);
    try {
      const image = await generateImageWithDalle({ prompt: job.prompt, size: "1536x1024", apiKey: openAiApiKey });
      await fs.writeFile(targetPng, image);
      backgroundsCreated += 1;
    } catch (err) {
      console.log(`Skip background generation (API error) for ${job.key}: ${err.message}`);
    }
  }

  console.log(
    `Done. Generated/ (sprites + artifact): created ${created}, skipped ${skipped}. Library (extras only): created ${libraryCreated}, skipped ${librarySkipped}. Backgrounds: created ${backgroundsCreated}, skipped ${backgroundsSkipped}`
  );
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

main().catch((err) => {
  console.error("Asset generation failed:", err.message);
  process.exit(1);
});
