import OpenAI from "openai";
import fs from "fs";
import path from "path";
import https from "https";

const OUT_DIR = "./assets/items";
const MANIFEST_PATH = "./assets_manifest.json";
const PAUSE_MS = 13_000;
const MODEL = "dall-e-3";
const SIZE = "1024x1024";

const STYLE_SUFFIX =
  "game item icon, stylized cartoon illustration, Pixar 3D style, warm colors, golden rim lighting, transparent background, centered, no text, no shadows";

function loadDotEnv(projectRoot) {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf-8");
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
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(process.cwd());
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const ITEMS = [
  { key: "jellyfish", base: "glowing pink jellyfish, cute cartoon" },
  { key: "lollipop", base: "swirly rainbow lollipop candy" },
  { key: "candy", base: "colorful wrapped candy bonbon" },
  { key: "bubble", base: "shimmering soap bubble sphere" },
  { key: "gummy_bear", base: "translucent red gummy bear candy, glowing" },
  { key: "crab", base: "cute blue cartoon crab smiling" },
  { key: "shell", base: "blue spiral seashell, ocean" },
  { key: "pearl", base: "glowing blue pearl, magical sheen" },
  { key: "coral", base: "blue coral branch, underwater" },
  { key: "starfish", base: "blue starfish, five arms, sparkly" },
  { key: "snowflake", base: "crystal ice snowflake, blue glow" },
  { key: "pine_cone", base: "pine cone, winter forest, frosted" },
  { key: "gift", base: "wrapped christmas gift box, ribbon" },
  { key: "snowball", base: "round snowball, icy white, sparkles" },
  { key: "cookie", base: "gingerbread cookie star shape, iced" },
  { key: "cherry", base: "two red cherries on stem, glossy" },
  { key: "sakura", base: "pink sakura cherry blossom petal" },
  { key: "lantern", base: "red japanese paper lantern, glowing" },
  { key: "dango", base: "japanese dango rice balls on stick, pastel" },
  { key: "bamboo", base: "bamboo stick, green, japanese style" },
  { key: "mushroom", base: "red mushroom with white dots, magical glow" },
  { key: "spore", base: "magical floating spore particles, purple glow" },
  { key: "butterfly", base: "glowing purple butterfly, magical forest" },
  { key: "orb", base: "swirling purple magic orb, glowing" },
  { key: "leaf", base: "glowing green leaf, magical bioluminescent" },
  { key: "hibiscus", base: "tropical hibiscus flower, bright red" },
  { key: "jump_stone", base: "glowing bouncy stone, magical energy trails" },
  { key: "banana", base: "ripe yellow banana, cartoon style" },
  { key: "wave", base: "cartoon ocean wave, tropical blue" },
  { key: "pawprint", base: "white monkey paw print, glowing trail" },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateItem(item, index, total) {
  const outPath = path.join(OUT_DIR, `${item.key}.png`);
  if (fs.existsSync(outPath)) {
    console.log(`⏭  [${index}/${total}] ${item.key} — already exists`);
    return "skipped";
  }

  try {
    const prompt = `${item.base}, ${STYLE_SUFFIX}`;
    process.stdout.write(`🎨 [${index}/${total}] ${item.key}...`);
    const response = await client.images.generate({
      model: MODEL,
      prompt,
      n: 1,
      size: SIZE,
      response_format: "url",
    });
    const imageUrl = response?.data?.[0]?.url;
    if (!imageUrl) throw new Error("Missing image URL");
    await downloadFile(imageUrl, outPath);
    console.log(" ✅");
    return "ok";
  } catch (err) {
    console.log(` ❌ ${err.message}`);
    return "error";
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set (.env or env var).");
  }

  console.log("Generate 30 game items");
  console.log(`Model: ${MODEL} | Size: ${SIZE} | Pause: ${PAUSE_MS / 1000}s`);

  const stats = { ok: 0, skipped: 0, error: 0 };
  for (let i = 0; i < ITEMS.length; i++) {
    const status = await generateItem(ITEMS[i], i + 1, ITEMS.length);
    stats[status] += 1;
    if (status === "ok" && i < ITEMS.length - 1) await sleep(PAUSE_MS);
  }

  const manifest = ITEMS.map((item) => ({
    key: item.key,
    file: `assets/items/${item.key}.png`,
    ready: fs.existsSync(path.join(OUT_DIR, `${item.key}.png`)),
  }));
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`\nDone: ok=${stats.ok}, skipped=${stats.skipped}, error=${stats.error}`);
  console.log(`Items: ${path.resolve(OUT_DIR)}`);
  console.log(`Manifest: ${path.resolve(MANIFEST_PATH)}`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});

