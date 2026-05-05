import fs from "fs/promises";
import path from "path";
import { applyIslandLessonCanon, CANONICAL_ISLAND_KEYS } from "./island_canon.mjs";

function usage() {
  console.log("Usage: node builder.mjs <lesson.json> [output.html]");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeLesson(raw) {
  const lesson = raw?.lesson ?? raw;
  if (!lesson || typeof lesson !== "object") {
    throw new Error("Lesson JSON is empty or invalid");
  }
  if (!Array.isArray(lesson.stages) || lesson.stages.length === 0) {
    throw new Error("Lesson JSON must contain non-empty stages[]");
  }
  return lesson;
}

/** Basename without extension; handles .PNG vs .png (path.basename(name, ".png") fails on .PNG). */
function assetStem(fileName) {
  const extRaw = path.extname(fileName);
  if (!extRaw) return fileName;
  return fileName.slice(0, -extRaw.length);
}

async function buildBackgroundMap(projectRoot) {
  const backgroundsDir = path.join(projectRoot, "assets", "backgrounds");
  const map = {};
  const allowed = new Set([".webp", ".png", ".jpg", ".jpeg"]);

  try {
    const entries = await fs.readdir(backgroundsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowed.has(ext)) continue;
      const key = assetStem(entry.name);
      map[key] = `assets/backgrounds/${entry.name}`;
    }
  } catch {
    // Folder may not exist yet; fallback paths will still work.
  }

  return map;
}

async function buildCharacterMap(projectRoot) {
  const charactersDir = path.join(projectRoot, "assets", "characters");
  const map = {};
  const allowed = new Set([".webp", ".png", ".jpg", ".jpeg"]);

  try {
    const entries = await fs.readdir(charactersDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowed.has(ext)) continue;
      const key = assetStem(entry.name);
      map[key] = `assets/characters/${entry.name}`;
    }
  } catch {
    // Folder may not exist yet; fallback paths will still work.
  }

  return map;
}

async function buildItemsMap(projectRoot) {
  const itemsDir = path.join(projectRoot, "assets", "items");
  const map = {};
  const allowed = new Set([".webp", ".png", ".jpg", ".jpeg"]);

  try {
    const entries = await fs.readdir(itemsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowed.has(ext)) continue;
      const key = assetStem(entry.name);
      map[key] = `assets/items/${entry.name}`;
    }
  } catch {
    // Folder may not exist yet; fallback paths will still work.
  }

  return map;
}

async function buildTargetsMap(projectRoot) {
  const targetsDir = path.join(projectRoot, "assets", "targets");
  const map = {};
  const allowed = new Set([".webp", ".png", ".jpg", ".jpeg"]);

  try {
    const entries = await fs.readdir(targetsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowed.has(ext)) continue;
      const key = assetStem(entry.name);
      map[key] = `assets/targets/${entry.name}`;
    }
  } catch {
    // Folder may not exist yet; fallback paths will still work.
  }

  return map;
}

async function buildArtifactsMap(projectRoot) {
  const artifactsDir = path.join(projectRoot, "assets", "artifacts");
  const map = {};
  const allowed = new Set([".webp", ".png", ".jpg", ".jpeg"]);

  try {
    const entries = await fs.readdir(artifactsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowed.has(ext)) continue;
      const key = assetStem(entry.name);
      map[key] = `assets/artifacts/${entry.name}`;
    }
  } catch {
    // Folder may not exist yet; runtime fallback can still be used.
  }

  return map;
}

function buildHtml(
  lesson,
  backgroundMap = {},
  characterMap = {},
  itemsMap = {},
  targetsMap = {},
  artifactsMap = {},
) {
  const title = `${lesson.island_name ?? "Monkey Archipelago"} - ${lesson.meta?.student_name ?? "Player"}`;
  const payload = JSON.stringify(lesson).replaceAll("</script>", "<\\/script>");
  const bgPayload = JSON.stringify(backgroundMap).replaceAll("</script>", "<\\/script>");
  const charPayload = JSON.stringify(characterMap).replaceAll("</script>", "<\\/script>");
  const itemsPayload = JSON.stringify(itemsMap).replaceAll("</script>", "<\\/script>");
  const targetsPayload = JSON.stringify(targetsMap).replaceAll("</script>", "<\\/script>");
  const artifactsPayload = JSON.stringify(artifactsMap).replaceAll("</script>", "<\\/script>");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');
    :root{
      --sand:#f4d03f;
      --gold:#f39c12;
      --dark:#1a1a2e;
      --teal:#7ecec4;
      --coral:#e74c3c;
      --ink:#102137;
      --panel:rgba(0,0,0,.58);
      --ok:#4fd982;
      --bad:#ff6b6b;
      --glow:0 0 24px rgba(255,240,173,.45);
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family: "Fredoka One", "Trebuchet MS", "Segoe UI", Arial, sans-serif;
      color:#fff;
      background:#0a0a1a;
      overflow:hidden;
      width:100vw;
      height:100vh;
      user-select:none;
    }
    .game{
      position:fixed;
      inset:0;
      width:100vw;
      height:100vh;
      border-radius:0;
      overflow:hidden;
      border:none;
      box-shadow:none;
      background:#111;
    }
    .bg{
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      object-fit:cover;
      z-index:1;
      filter:saturate(1.05) contrast(1.02);
    }
    .overlay{
      position:absolute;
      inset:0;
      background:linear-gradient(to bottom, rgba(0,0,0,.35), rgba(0,0,0,.15) 35%, rgba(0,0,0,.35));
      z-index:2;
      pointer-events:none;
    }
    .hud{
      position:absolute;
      top:13px;
      right:16px;
      z-index:50;
      background:var(--panel);
      border:2px solid var(--gold);
      border-radius:26px;
      padding:6px 16px;
      display:flex;
      align-items:center;
      gap:6px;
      font-size:19px;
      color:var(--sand);
      text-shadow:0 1px 2px rgba(0,0,0,.5);
    }
    .stage-skip-btn{
      position:absolute;
      top:64px;
      right:16px;
      z-index:52;
      padding:8px 16px;
      border:none;
      border-radius:999px;
      background:linear-gradient(135deg,#ffcf66,#f3a93f);
      color:#1d1606;
      font-family:'Fredoka One',cursive;
      font-size:15px;
      cursor:pointer;
      box-shadow:0 4px 0 #9b6b21,0 8px 18px rgba(0,0,0,.3);
    }
    .stage-back-btn{
      position:absolute;
      top:64px;
      left:16px;
      z-index:52;
      padding:8px 16px;
      border:none;
      border-radius:999px;
      background:linear-gradient(135deg,#93d3ff,#4a9fe4);
      color:#0b1b2f;
      font-family:'Fredoka One',cursive;
      font-size:15px;
      cursor:pointer;
      box-shadow:0 4px 0 #2a6ea6,0 8px 18px rgba(0,0,0,.3);
    }
    .cspin{animation:cflip 3s linear infinite}
    .cpop{
      position:absolute;
      top:13px;
      right:16px;
      z-index:51;
      font-size:24px;
      color:var(--sand);
      text-shadow:0 0 10px rgba(244,208,63,.9);
      pointer-events:none;
      opacity:0;
    }
    .cpop.go{animation:cpopAnim 1.3s ease forwards}
    .stage-lbl{display:none}
    .instruction{
      position:absolute;
      z-index:20;
      top:48px;
      left:46%;
      transform:translateX(-50%);
      background:rgba(0,0,0,.5);
      border:1px solid rgba(255,255,255,.2);
      border-radius:12px;
      padding:7px 14px;
      max-width:56%;
      text-align:center;
      font-size:16px;
      letter-spacing:.2px;
    }
    .player-side{
      position:absolute;
      left:150px;
      bottom:-18px;
      z-index:8;
      display:flex;
      flex-direction:column;
      align-items:flex-start;
      gap:0;
      pointer-events:none;
    }
    .player-side.stage-boss-hidden{
      display:none;
    }
    .p-frame{
      width:clamp(270px,27vw,480px);
      height:clamp(345px,39vw,630px);
      border:none;
      background:transparent;
      display:flex;
      align-items:flex-end;
      justify-content:center;
      font-size:210px;
      overflow:visible;
      box-shadow:none;
      position:relative;
    }
    .p-frame img{
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      object-fit:contain;
      display:none;
      filter:drop-shadow(0 8px 18px rgba(0,0,0,.45));
    }
    .p-frame span{
      line-height:1;
      filter:drop-shadow(0 8px 18px rgba(0,0,0,.45));
    }
    .p-tag{display:none}
    .izone{
      position:absolute;
      right:0;
      top:0;
      bottom:0;
      width:42%;
      z-index:5;
    }
    .right-lane{
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      z-index:12;
    }
    .game-img{
      position:absolute;
      width:clamp(100px,9.5vw,136px);
      height:clamp(100px,9.5vw,136px);
      object-fit:contain;
      filter:drop-shadow(0 8px 12px rgba(0,0,0,.4));
      user-select:none;
      -webkit-user-drag:none;
    }
    .draggable{
      cursor:grab;
      touch-action:none;
      z-index:13;
      transition:transform .14s ease;
    }
    .draggable:active{cursor:grabbing}
    .drop-zone{
      position:absolute;
      width:clamp(120px,11vw,190px);
      height:clamp(120px,11vw,190px);
      border-radius:20px;
      border:2px dashed rgba(255,255,255,0);
      background:transparent;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      z-index:11;
      padding:0;
    }
    .drop-zone.drop-zone-minimal{
      border:none;
      box-shadow:none;
    }
    .drop-zone.drop-zone-minimal .game-img{
      width:100%;
      height:100%;
      object-fit:contain;
      position:relative;
      inset:auto;
      transform:none;
    }
    .zone-need{
      position:absolute;
      left:50%;
      top:100%;
      transform:translate(-50%, 8px);
      min-width:34px;
      height:34px;
      padding:0 10px;
      border-radius:999px;
      border:2px solid rgba(84,56,8,.85);
      background:radial-gradient(circle at 30% 30%,#fff6c7 0%,#ffd667 52%,#e5a227 100%);
      color:#2c1f08;
      display:flex;
      align-items:center;
      justify-content:center;
      font-family:'Fredoka One',cursive;
      font-size:18px;
      text-shadow:0 1px 0 rgba(255,255,255,.45);
      box-shadow:0 4px 10px rgba(0,0,0,.28);
      pointer-events:none;
      z-index:3;
    }
    .drop-zone.done{
      border-color:rgba(79,217,130,.55);
      box-shadow:0 0 0 3px rgba(79,217,130,.24), var(--glow);
    }
    .dd-divider{
      position:absolute;
      left:5%;
      right:3%;
      top:51%;
      height:3px;
      transform:translateY(-50%);
      background:linear-gradient(90deg,transparent,rgba(255,224,130,.5),rgba(255,224,130,.5),transparent);
      border-radius:3px;
      z-index:10;
      pointer-events:none;
      box-shadow:0 0 14px rgba(244,208,63,.2);
    }
    .sort-slot{
      position:absolute;
      width:150px; height:88px;
      border:none;
      background:transparent;
      display:flex;
      justify-content:center;
      align-items:flex-end;
      padding-bottom:10px;
      font-weight:700;
      z-index:11;
    }
    .sort-slot-line{
      position:absolute;
      left:10px;
      right:10px;
      bottom:24px;
      height:6px;
      border-radius:999px;
      background:linear-gradient(180deg,#ffe9a8 0%,#f4d03f 52%,#cf9d23 100%);
      box-shadow:0 4px 10px rgba(0,0,0,.35),0 0 14px rgba(244,208,63,.38);
      opacity:.92;
    }
    .sort-slot-label{
      position:absolute;
      bottom:0;
      left:50%;
      transform:translateX(-50%);
      font-size:18px;
      color:#fff;
      text-shadow:0 2px 6px rgba(0,0,0,.65);
      font-weight:900;
      letter-spacing:.02em;
    }
    .sort-item{cursor:pointer}
    .sort-item.selected{outline:3px solid var(--sand); border-radius:12px; box-shadow:var(--glow)}
    .value-chip{
      position:absolute;
      min-width:34px;
      height:34px;
      padding:0 10px;
      border-radius:999px;
      background:radial-gradient(circle at 30% 30%,#fff6c7 0%,#ffd667 52%,#e5a227 100%);
      border:2px solid rgba(84,56,8,.85);
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:18px;
      color:#2c1f08;
      text-shadow:0 1px 0 rgba(255,255,255,.45);
      box-shadow:0 5px 10px rgba(0,0,0,.28);
      transform:translate(-50%,-50%);
      pointer-events:none;
      z-index:16;
    }
    .group-zone{
      position:absolute;
      width:240px;
      min-height:210px;
      border-radius:24px;
      border:3px solid rgba(244,208,63,.7);
      background:linear-gradient(180deg,rgba(9,24,56,.92) 0%, rgba(8,20,48,.88) 100%);
      box-shadow:0 18px 36px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:16px 14px;
      z-index:11;
      overflow:hidden;
    }
    .group-zone-title{
      position:absolute;
      inset:0;
      color:#ffe7a6;
      font-family:'Fredoka One',cursive;
      font-size:26px;
      text-shadow:0 2px 6px rgba(0,0,0,.45);
      display:flex;
      align-items:center;
      justify-content:center;
      line-height:1.1;
      text-align:center;
      pointer-events:none;
    }
    .group-zone-good{
      border-color:rgba(79,217,130,.9);
      box-shadow:0 0 0 4px rgba(79,217,130,.24), 0 18px 36px rgba(0,0,0,.42), var(--glow);
    }
    .group-zone-bad{
      border-color:rgba(255,90,90,.92);
      box-shadow:0 0 0 4px rgba(255,90,90,.2), 0 18px 36px rgba(0,0,0,.42);
    }
    .group-token{
      position:absolute;
      width:114px;
      height:114px;
      transform:translate(-50%,-50%);
      z-index:13;
      touch-action:none;
      cursor:grab;
    }
    .group-token:active{cursor:grabbing}
    .group-token .game-img{
      width:100%;
      height:100%;
      object-fit:contain;
      position:absolute;
      inset:0;
    }
    .group-token .value-chip{
      left:50% !important;
      top:8% !important;
      transform:translate(-50%,-50%);
      z-index:16;
    }
    .input-row{
      position:absolute;
      min-width:260px;
      display:flex;
      align-items:center;
      gap:12px;
      background:rgba(5,15,30,.6);
      border:1px solid rgba(255,255,255,.22);
      border-radius:12px;
      padding:8px 10px;
      backdrop-filter:blur(2px);
      z-index:12;
      font-size:20px;
      font-weight:800;
    }
    .answer{
      width:92px;
      font-size:28px;
      font-weight:900;
      text-align:center;
      border-radius:12px;
      border:2px solid rgba(255,255,255,.75);
      background:#fff;
      color:#0b1426;
      padding:6px;
      outline:none;
    }
    .answer.ok{
      border-color:var(--ok);
      background:#e8fff1;
      color:#0f3b22;
      -webkit-text-fill-color:#0f3b22;
      opacity:1;
    }
    .answer:disabled{
      opacity:1;
      color:#0f3b22;
      -webkit-text-fill-color:#0f3b22;
    }
    input[type="number"]::-webkit-outer-spin-button,
    input[type="number"]::-webkit-inner-spin-button{
      -webkit-appearance:none;
      margin:0;
    }
    input[type="number"]{
      -moz-appearance:textfield;
      appearance:textfield;
    }
    .eq-card{
      position:absolute;
      left:50%;
      top:28%;
      transform:translateX(-50%);
      width:min(86%,620px);
      background:linear-gradient(180deg,rgba(10,20,35,.95),rgba(10,20,35,.9));
      border:3px solid rgba(244,208,63,.66);
      border-radius:28px;
      padding:24px 22px 20px;
      box-shadow:0 20px 34px rgba(0,0,0,.38);
      z-index:12;
      display:flex;
      flex-direction:column;
      gap:14px;
    }
    .eq-head{
      font-size:48px;
      line-height:1;
      text-align:center;
      color:var(--sand);
    }
    .eq-line{
      font-size:clamp(26px,3.6vw,44px);
      text-align:center;
      color:#dff8dc;
      letter-spacing:.03em;
      text-shadow:0 2px 8px rgba(0,0,0,.35);
    }
    .eq-input{
      width:100%;
      padding:14px 12px;
      border-radius:14px;
      border:3px solid rgba(244,208,63,.75);
      background:rgba(255,255,255,.1);
      color:#fff;
      font-family:'Fredoka One',cursive;
      font-size:40px;
      text-align:center;
      outline:none;
    }
    .eq-input:disabled{
      opacity:1;
      color:#d9ffe8;
      -webkit-text-fill-color:#d9ffe8;
    }
    .eq-input:focus{border-color:var(--sand)}
    .eq-input.bad{
      background:rgba(176,58,46,.88);
      border-color:#ffd5d1;
      animation:shake .22s ease;
    }
    .seq-board{
      display:flex;
      flex-direction:column;
      gap:14px;
      width:100%;
      align-items:center;
      margin-top:4px;
    }
    .seq-row{
      font-size:clamp(30px,4.2vw,48px);
      font-weight:900;
      color:#dff8dc;
      letter-spacing:.02em;
      display:flex;
      gap:8px;
      align-items:center;
      flex-wrap:wrap;
      justify-content:center;
      border-radius:14px;
      padding:8px 12px;
    }
    .seq-blank{
      width:84px;
      padding:7px 8px;
      border-radius:12px;
      border:3px solid rgba(244,208,63,.62);
      background:rgba(255,255,255,.82);
      color:#0f2039;
      font-size:30px;
      font-weight:900;
      text-align:center;
      outline:none;
    }
    .seq-blank.ok{
      border-color:var(--ok);
      background:rgba(120,235,170,.28);
      color:#0f3b22;
      -webkit-text-fill-color:#0f3b22;
    }
    .seq-blank.bad{
      border-color:#ff6a6a;
      background:rgba(255,106,106,.2);
      color:#4a0f0f;
      -webkit-text-fill-color:#4a0f0f;
      box-shadow:0 0 0 3px rgba(255,106,106,.18);
    }
    .seq-submit{
      display:none;
      margin-top:10px;
      padding:12px 36px;
      font-size:30px;
      font-weight:900;
      border:none;
      border-radius:999px;
      cursor:pointer;
      color:#2a1b00;
      background:linear-gradient(135deg,#ffd979,#f1b73c);
      box-shadow:0 5px 0 #a07022;
    }
    .seq-submit.show{display:inline-block}
    .choice-box{
      position:absolute;
      left:50%;
      transform:translateX(-50%);
      width:min(760px,92%);
      top:28%;
      background:rgba(8,18,33,.75);
      border:1px solid rgba(255,255,255,.22);
      border-radius:18px;
      padding:18px;
      z-index:12;
      backdrop-filter:blur(2px);
    }
    .choice-q{font-size:32px;font-weight:900;text-align:center;margin:6px 0 16px}
    .choice-sub{
      font-size:16px;
      font-weight:700;
      color:#c8e8c8;
      text-align:center;
      margin:-6px 0 14px;
      line-height:1.35;
    }
    .choice-hint{
      font-size:13px;
      font-weight:700;
      color:#ffe8b2;
      text-align:center;
      margin-top:4px;
      opacity:.9;
    }
    .choice-btn{
      width:100%;
      border:none;
      border-radius:14px;
      padding:14px;
      font-size:22px;
      font-weight:800;
      margin:8px 0;
      cursor:pointer;
      color:#0b1426;
      background:linear-gradient(135deg,#f7d36f,#f3b53f);
      box-shadow:0 4px 0 #946523;
      transition:transform .1s;
    }
    .choice-btn:active{transform:translateY(2px)}
    .choice-btn.ok{background:linear-gradient(135deg,#9bf2b7,#4fd982); box-shadow:0 4px 0 #2f8b4e}
    .choice-btn.bad{background:linear-gradient(135deg,#ffb3b3,#ff6f6f); box-shadow:0 4px 0 #a33f3f}
    .balance-scale-wrap{
      position:absolute;
      left:50%;
      top:16%;
      transform:translateX(-50%);
      width:min(860px,94%);
      z-index:12;
      text-align:center;
    }
    .balance-scale-img{
      width:100%;
      max-width:760px;
      object-fit:contain;
      filter:drop-shadow(0 14px 24px rgba(0,0,0,.35));
      transition:transform .35s ease, opacity .3s ease;
    }
    .balance-side-text{
      position:absolute;
      top:66%;
      transform:translate(-50%,-50%);
      color:#fff7d6;
      font-family:'Fredoka One',cursive;
      font-size:34px;
      text-shadow:0 2px 7px rgba(0,0,0,.55);
      white-space:nowrap;
    }
    .balance-side-text.left{left:21%}
    .balance-side-text.right{left:76%; top:62%}
    .balance-pill{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:58px;
      padding:6px 14px;
      border-radius:14px;
      border:3px solid rgba(244,208,63,.85);
      background:rgba(8,18,33,.6);
      box-shadow:0 8px 16px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.08);
    }
    .balance-answer-input{
      width:92px;
      padding:6px 8px;
      border-radius:12px;
      border:3px solid rgba(244,208,63,.75);
      background:rgba(255,255,255,.9);
      color:#0f2039;
      font-family:'Fredoka One',cursive;
      font-size:30px;
      text-align:center;
      outline:none;
      vertical-align:middle;
      margin:0 6px;
    }
    .balance-answer-input.ok{
      border-color:var(--ok);
      background:rgba(120,235,170,.34);
      color:#0f3b22;
    }
    .balance-answer-input.bad{
      border-color:#ff6a6a;
      background:rgba(255,106,106,.25);
      color:#4a0f0f;
    }
    .balance-next{
      margin-top:6px;
    }
    .build-wrap{
      position:absolute;
      left:50%;
      top:18%;
      transform:translateX(-50%);
      width:min(760px,94%);
      text-align:center;
      z-index:12;
      min-height:520px;
    }
    .build-target{
      display:inline-flex;
      min-width:220px;
      min-height:112px;
      padding:12px 28px;
      border-radius:20px;
      border:3px solid rgba(244,208,63,.85);
      background:linear-gradient(180deg,rgba(8,18,33,.84),rgba(10,24,56,.82));
      color:#ffe7a6;
      align-items:center;
      justify-content:center;
      font-family:'Fredoka One',cursive;
      font-size:66px;
      text-shadow:0 2px 7px rgba(0,0,0,.5);
      box-shadow:0 14px 28px rgba(0,0,0,.34);
      position:relative;
      z-index:2;
    }
    .build-arrow-layer{
      position:absolute;
      left:0;
      top:0;
      width:100%;
      height:100%;
      pointer-events:none;
      z-index:1;
    }
    .build-slots{
      margin-top:184px;
      display:flex;
      gap:18px;
      justify-content:center;
      flex-wrap:wrap;
      position:relative;
      z-index:2;
    }
    .build-slot{
      width:126px;
      height:126px;
      border-radius:18px;
      border:3px solid rgba(244,208,63,.78);
      background:rgba(8,18,33,.9);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 8px 18px rgba(0,0,0,.28);
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .build-slot-input{
      width:78px;
      height:56px;
      border-radius:12px;
      border:2px solid rgba(244,208,63,.7);
      background:rgba(255,255,255,.9);
      color:#0f2039;
      font-family:'Fredoka One',cursive;
      font-size:30px;
      text-align:center;
      outline:none;
    }
    .build-next{
      margin-top:22px;
      min-width:76px;
      padding:12px 18px;
      font-size:32px;
      line-height:1;
    }
    .timer-card{
      position:absolute;
      left:50%;
      top:24%;
      transform:translateX(-50%);
      width:min(760px,94%);
      background:linear-gradient(180deg,rgba(8,18,33,.9),rgba(10,24,56,.88));
      border:3px solid rgba(244,208,63,.76);
      border-radius:24px;
      padding:18px 18px 16px;
      box-shadow:0 18px 36px rgba(0,0,0,.38);
      z-index:12;
      text-align:center;
    }
    .timer-top{
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      margin-bottom:10px;
      color:#ffe7a6;
      font-family:'Fredoka One',cursive;
      font-size:28px;
    }
    .timer-badge{
      min-width:92px;
      height:46px;
      border-radius:999px;
      border:2px solid rgba(244,208,63,.85);
      background:rgba(0,0,0,.25);
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:28px;
    }
    .timer-start{
      margin-left:6px;
      padding:8px 18px;
      border:none;
      border-radius:999px;
      background:linear-gradient(135deg,#ffd979,#f1b73c);
      box-shadow:0 4px 0 #a07022;
      color:#2a1b00;
      font-family:'Fredoka One',cursive;
      font-size:22px;
      cursor:pointer;
    }
    .timer-panel{
      position:absolute;
      left:50%;
      top:76%;
      transform:translateX(-50%);
      display:flex;
      align-items:flex-end;
      gap:14px;
      z-index:12;
      background:linear-gradient(180deg,rgba(8,18,33,.92),rgba(10,24,56,.9));
      border:3px solid rgba(244,208,63,.76);
      border-radius:20px;
      box-shadow:0 14px 28px rgba(0,0,0,.35);
      padding:10px 14px 12px;
    }
    .timer-panel-left{
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:4px;
      min-width:110px;
    }
    .timer-label{
      font-family:'Fredoka One',cursive;
      font-size:14px;
      letter-spacing:.04em;
      color:#ffe7a6;
      text-transform:uppercase;
      opacity:.95;
    }
    .timer-row{
      margin:10px auto;
      max-width:620px;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      color:#dff8dc;
      font-family:'Fredoka One',cursive;
      font-size:30px;
    }
    .timer-input{
      width:88px;
      padding:6px 8px;
      border-radius:12px;
      border:3px solid rgba(244,208,63,.75);
      background:rgba(255,255,255,.92);
      color:#0f2039;
      font-family:'Fredoka One',cursive;
      font-size:30px;
      text-align:center;
      outline:none;
    }
    .timer-input:disabled{opacity:.65}
    .timer-input.ok{border-color:var(--ok); background:rgba(120,235,170,.35); color:#0f3b22}
    .timer-input.bad{border-color:#ff6a6a; background:rgba(255,106,106,.26); color:#4a0f0f}
    .symbol-wrap{
      position:absolute;
      left:50%;
      top:20%;
      transform:translateX(-50%);
      width:min(760px,94%);
      z-index:12;
      display:flex;
      flex-direction:column;
      gap:10px;
      align-items:center;
    }
    .symbol-row{
      width:min(520px,100%);
      display:flex;
      align-items:center;
      justify-content:center;
      gap:12px;
      color:#ffe7a6;
      font-family:'Fredoka One',cursive;
      font-size:34px;
      text-shadow:0 2px 6px rgba(0,0,0,.5);
    }
    .symbol-item{
      width:92px;
      height:92px;
      object-fit:contain;
      filter:drop-shadow(0 8px 14px rgba(0,0,0,.32));
    }
    .symbol-calc-card{
      margin-top:12px;
      width:min(620px,100%);
      background:linear-gradient(180deg,rgba(8,18,33,.9),rgba(10,24,56,.88));
      border:3px solid rgba(244,208,63,.76);
      border-radius:22px;
      box-shadow:0 16px 32px rgba(0,0,0,.36);
      padding:16px 16px 14px;
      text-align:center;
    }
    .symbol-expr{
      color:#dff8dc;
      font-family:'Fredoka One',cursive;
      font-size:34px;
      margin-bottom:10px;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-wrap:wrap;
      gap:8px;
    }
    .symbol-inline{
      width:42px;
      height:42px;
      object-fit:contain;
      filter:drop-shadow(0 4px 8px rgba(0,0,0,.28));
      vertical-align:middle;
    }
    .symbol-answer{
      width:120px;
      padding:8px 10px;
      border-radius:12px;
      border:3px solid rgba(244,208,63,.75);
      background:rgba(255,255,255,.92);
      color:#0f2039;
      font-family:'Fredoka One',cursive;
      font-size:34px;
      text-align:center;
      outline:none;
    }
    .symbol-answer.ok{border-color:var(--ok); background:rgba(120,235,170,.35); color:#0f3b22}
    .symbol-answer.bad{border-color:#ff6a6a; background:rgba(255,106,106,.26); color:#4a0f0f}
    .corridor-row{
      display:flex;
      gap:16px;
      justify-content:center;
      flex-wrap:wrap;
    }
    .corridor-choice{
      flex:1 1 42%;
      min-width:220px;
      max-width:320px;
      padding:12px 10px 10px;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:8px;
    }
    .corridor-icon{
      width:72px;
      height:72px;
      object-fit:contain;
      filter:drop-shadow(0 5px 8px rgba(0,0,0,.35));
      pointer-events:none;
    }
    .corridor-emoji{
      font-size:50px;
      line-height:1;
      pointer-events:none;
    }
    .corridor-label{
      font-size:22px;
      line-height:1.2;
      text-align:center;
      color:#0b1426;
      font-weight:800;
      pointer-events:none;
    }
    .anim-layer{
      position:absolute;
      inset:0;
      display:grid;
      place-items:center;
      z-index:12;
      pointer-events:none;
    }
    .anim-text{
      background:rgba(0,0,0,.55);
      border-radius:16px;
      padding:12px 18px;
      border:1px solid rgba(255,255,255,.22);
      font-size:28px;
      font-weight:900;
      text-align:center;
      max-width:80%;
    }
    .artifact{
      font-size:96px;
      opacity:0;
      transform:scale(.7);
      transition:all .45s ease;
      filter:drop-shadow(0 10px 18px rgba(0,0,0,.5));
    }
    .artifact.show{opacity:1;transform:scale(1)}
    .anim-task{
      margin-top:14px;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:10px;
      pointer-events:auto;
    }
    .anim-counter{
      font-size:22px;
      font-weight:900;
      color:var(--sand);
      text-shadow:0 2px 0 rgba(0,0,0,.35);
    }
    .artifact-btn{
      border:none;
      background:transparent;
      cursor:pointer;
      font-size:88px;
      line-height:1;
      filter:drop-shadow(0 8px 14px rgba(0,0,0,.42));
      transform:scale(1);
      transition:transform .14s ease;
    }
    .artifact-btn:active{transform:scale(.92)}
    .op-card{
      width:min(560px,88%);
      margin-top:8px;
      padding:10px 12px;
      border-radius:14px;
      background:rgba(5,18,38,.58);
      border:1px solid rgba(255,255,255,.16);
      pointer-events:auto;
    }
    .op-line{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      margin:8px 0;
      font-size:28px;
      font-weight:900;
    }
    .op-buttons{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }
    .op-btn{
      min-width:44px;
      height:40px;
      border:none;
      border-radius:10px;
      font-size:22px;
      font-weight:900;
      cursor:pointer;
      color:#0b1426;
      background:linear-gradient(135deg,#ffe199,#f3b53f);
      box-shadow:0 3px 0 #9b6b21;
    }
    .op-btn.ok{
      background:linear-gradient(135deg,#9bf2b7,#4fd982);
      box-shadow:0 3px 0 #2f8b4e;
    }
    .boss-answer{
      background:rgba(11,20,38,.55);
      color:#f4fbff;
      border-color:rgba(255,255,255,.18);
    }
    .boss-answer.ok{
      background:rgba(24,72,45,.35) !important;
      color:#d9ffe8;
      border-color:#3cd98a !important;
      box-shadow:0 0 0 3px rgba(60,217,138,.16), inset 0 0 0 1px rgba(60,217,138,.22);
    }
    .bottom{
      display:none !important;
    }
    .btn{
      border:none;
      border-radius:999px;
      padding:8px 16px;
      color:#0b1426;
      font-size:15px;
      cursor:pointer;
      background:linear-gradient(135deg,#93d3ff,#4a9fe4);
      box-shadow:0 4px 0 #2a6ea6,0 8px 18px rgba(0,0,0,.3);
    }
    .btn.primary{
      background:linear-gradient(135deg,#ffcf66,#f3a93f);
      box-shadow:0 4px 0 #9b6b21,0 8px 18px rgba(0,0,0,.3);
    }
    .message{
      font-size:18px;
      font-weight:800;
      background:rgba(0,0,0,.45);
      border:1px solid rgba(255,255,255,.22);
      border-radius:12px;
      padding:8px 12px;
      min-height:42px;
      display:flex;
      align-items:center;
    }
    .shake{animation:shake .25s ease}
    .hidden{display:none!important}
    @keyframes cflip{50%{transform:rotateY(180deg)}}
    @keyframes cpopAnim{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-52px)}}
    @keyframes shake{
      0%{transform:translateX(0)}
      25%{transform:translateX(-7px)}
      50%{transform:translateX(7px)}
      75%{transform:translateX(-5px)}
      100%{transform:translateX(0)}
    }
    .conf{
      position:fixed;
      pointer-events:none;
      animation:confFall var(--d,2s) linear forwards;
      z-index:99;
    }
    .success-screen{
      position:fixed;
      inset:0;
      z-index:200;
      background:rgba(0,0,0,.72);
      backdrop-filter:blur(5px);
      display:flex;
      align-items:center;
      justify-content:center;
      opacity:0;
      pointer-events:none;
      transition:opacity .32s;
    }
    .success-screen.on{opacity:1;pointer-events:all}
    .completion-screen{
      position:fixed;
      inset:0;
      z-index:320;
      display:none;
      align-items:center;
      justify-content:center;
      overflow:hidden;
    }
    .completion-screen.on{display:flex}
    .completion-bg{
      position:absolute;
      inset:-22px;
      width:calc(100% + 44px);
      height:calc(100% + 44px);
      object-fit:cover;
      filter:blur(12px) saturate(1.05);
      transform:scale(1.03);
    }
    .completion-overlay{
      position:absolute;
      inset:0;
      background:rgba(0,0,0,.45);
      backdrop-filter:blur(12px);
    }
    .completion-back{
      position:fixed;
      left:18px;top:18px;z-index:330;
      padding:10px 20px;border:none;border-radius:999px;cursor:pointer;
      background:linear-gradient(135deg,#9ad8ff,#4da5e8);
      color:#0b1b2f;font-size:24px;box-shadow:0 4px 0 #2b6fa7;
    }
    .completion-card{
      position:relative;
      background:rgba(5,15,30,.78);
      border:2px solid rgba(244,208,63,.32);
      border-radius:22px;
      padding:34px 38px;
      box-shadow:0 24px 45px rgba(0,0,0,.45);
      display:flex;flex-direction:column;align-items:center;gap:18px;
      max-width:440px;width:90%;
      transform:scale(.7);opacity:0;
      animation:completionIn .4s ease forwards;
    }
    @keyframes completionIn{to{transform:scale(1);opacity:1}}
    .completion-title{
      font-family:'Fredoka One',cursive;
      font-size:28px;
      color:var(--sand);
      text-shadow:2px 2px 0 #7b5e0a;
      text-align:center;
    }
    .completion-avatar{
      width:142px;height:180px;border-radius:16px;
      border:3px solid rgba(244,208,63,.38);
      background:rgba(255,255,255,.04);
      object-fit:contain;
      box-shadow:0 8px 16px rgba(0,0,0,.3);
    }
    .completion-level{
      padding:6px 12px;border-radius:999px;
      background:linear-gradient(135deg,#93d3ff,#4a9fe4);
      border:2px solid rgba(255,255,255,.55);
      font-family:'Fredoka One',cursive;
      font-size:16px;color:#0b1b2f;
      box-shadow:0 4px 10px rgba(0,0,0,.35);
      margin-top:-4px;
    }
    .completion-name{
      font-family:'Fredoka One',cursive;
      font-size:21px;color:#fff;line-height:1;
    }
    .completion-section{
      width:100%;
      text-align:center;
      font-size:10px;
      font-weight:800;
      color:rgba(255,255,255,.42);
      letter-spacing:1px;
      text-transform:uppercase;
      margin-top:-6px;
    }
    .artifact-wrap{
      position:relative;
      width:120px;height:120px;
      display:grid;place-items:center;
      animation:popIn .3s ease .3s both;
    }
    @keyframes popIn{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
    .artifact-main{
      width:104px;height:104px;object-fit:contain;
      filter:drop-shadow(0 8px 16px rgba(0,0,0,.35));
    }
    .artifact-main.fallback{
      font-size:74px;
      display:flex;align-items:center;justify-content:center;
    }
    .artifact-spark{
      position:absolute;font-size:24px;color:#ffe49e;
      animation:twinkle 1.4s ease-in-out infinite alternate;
      pointer-events:none;
    }
    .artifact-spark.s1{top:8px;left:22px;animation-delay:0s}
    .artifact-spark.s2{top:16px;right:18px;animation-delay:.4s}
    .artifact-spark.s3{bottom:24px;left:16px;animation-delay:.7s}
    .artifact-spark.s4{bottom:14px;right:24px;animation-delay:.2s}
    @keyframes twinkle{from{opacity:.25;transform:scale(.8)}to{opacity:1;transform:scale(1.2)}}
    .artifact-name{
      font-family:'Fredoka One',cursive;
      font-size:22px;line-height:1.1;text-align:center;color:#ffe8b2;
    }
    .artifact-desc{
      font-size:14px;color:#d0d9ea;opacity:.9;text-align:center;line-height:1.35;max-width:95%;
      margin-top:-8px;
    }
    .inventory-row{
      width:100%;display:flex;justify-content:center;gap:10px;flex-wrap:wrap;
      min-height:56px;
      margin-top:-6px;
    }
    .inventory-icon{
      width:52px;height:52px;border-radius:9px;padding:4px;
      border:2px solid rgba(244,208,63,.32);background:rgba(244,208,63,.07);
      object-fit:contain;
    }
    .completion-coins{
      font-family:'Fredoka One',cursive;
      font-size:24px;color:var(--sand);display:flex;align-items:center;gap:9px;
      text-shadow:none;
      margin-top:-2px;
    }
    .completion-reload{
      padding:11px 38px;
      font-family:'Fredoka One',cursive;
      font-size:19px;color:var(--dark);
      background:linear-gradient(135deg,#7ecec4,#1a9e92);
      border:none;border-radius:50px;cursor:pointer;
      box-shadow:0 5px 0 #0d5e58;
    }
    .completion-reload:hover{transform:translateY(-2px)}
    .completion-reload:active{transform:translateY(3px)}
    .story-screen,.shop-screen{
      position:fixed;inset:0;z-index:340;display:none;align-items:center;justify-content:center;
      background:rgba(4,10,22,.82);backdrop-filter:blur(8px);
    }
    .story-screen.on,.shop-screen.on{display:flex}
    .story-card{
      width:min(92vw,760px);background:rgba(8,18,33,.92);border:2px solid rgba(244,208,63,.5);
      border-radius:22px;padding:28px 26px;text-align:center;box-shadow:0 24px 45px rgba(0,0,0,.45);
      display:flex;flex-direction:column;gap:18px;animation:completionIn .35s ease both;
    }
    .story-title{font-size:38px;color:var(--sand)}
    .story-text{font-size:21px;line-height:1.45;color:#e3edf8}
    .story-shop-btn{
      margin:0 auto;padding:12px 34px;border:none;border-radius:999px;cursor:pointer;
      background:linear-gradient(135deg,#7ecec4,#1a9e92);color:#072026;font-size:24px;
      box-shadow:0 5px 0 #0d5e58;
    }
    .shop-screen{background:rgba(0,0,0,.28)}
    .shop-bg{
      position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;
      filter:saturate(1.06) contrast(1.04);
    }
    .shop-wrap{
      position:relative;z-index:1;
      width:min(980px,92vw);max-height:min(86vh,760px);
      background:rgba(5,15,30,.78);border:2px solid rgba(244,208,63,.45);
      border-radius:22px;padding:18px 18px 16px;box-shadow:0 20px 56px rgba(0,0,0,.55);
      display:flex;flex-direction:column;
    }
    .shop-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .shop-title{font-family:'Fredoka One',cursive;font-size:34px;color:var(--sand)}
    .shop-coins{font-family:'Fredoka One',cursive;font-size:24px;color:#ffe8b2}
    .shop-grid{
      display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;
      overflow:auto;max-height:min(52vh,470px);padding-right:6px;
    }
    .shop-item{
      background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:10px;
      display:flex;flex-direction:column;align-items:center;gap:8px;transition:transform .15s,box-shadow .15s,border-color .15s;
    }
    .shop-item:hover{transform:translateY(-3px) scale(1.02);border-color:rgba(244,208,63,.75);box-shadow:0 10px 18px rgba(0,0,0,.35),0 0 14px rgba(244,208,63,.22)}
    .shop-item img{width:120px;height:76px;object-fit:contain;filter:drop-shadow(0 5px 8px rgba(0,0,0,.35))}
    .shop-name{color:#ffe8b2;font-weight:800}
    .shop-price{color:#c8e8c8;font-weight:800}
    .shop-buy{
      padding:8px 16px;border:none;border-radius:999px;cursor:pointer;font-family:'Fredoka One',cursive;font-size:16px;
      color:#1d1606;background:linear-gradient(135deg,#ffcf66,#f3a93f);box-shadow:0 4px 0 #9b6b21
    }
    .shop-buy:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
    .shop-finish{
      margin-top:14px;width:100%;padding:13px 20px;border:none;border-radius:999px;cursor:pointer;
      font-family:'Fredoka One',cursive;font-size:22px;color:#0b1b2f;background:linear-gradient(135deg,#93d3ff,#4a9fe4);box-shadow:0 5px 0 #2a6ea6
    }
    @media (max-width:900px){
      .shop-wrap{width:min(1080px,94vw)}
      .shop-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media (max-width:620px){
      .shop-grid{grid-template-columns:1fr}
      .shop-title{font-size:28px}
    }
    .balance-card{
      position:absolute;left:50%;top:28%;transform:translateX(-50%);width:min(90%,720px);
      background:linear-gradient(180deg,rgba(10,20,35,.95),rgba(10,20,35,.92));
      border:3px solid rgba(244,208,63,.66);border-radius:28px;padding:22px;display:flex;flex-direction:column;gap:14px;z-index:13;
    }
    .balance-row{display:flex;justify-content:space-between;gap:14px;align-items:center}
    .balance-side{
      flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);border-radius:14px;
      min-height:92px;display:flex;align-items:center;justify-content:center;font-size:40px;color:#e7f6d8;
    }
    .balance-eq{font-size:38px;color:var(--sand)}
    .balance-blank{
      min-width:72px;min-height:58px;border-radius:10px;border:3px dashed rgba(244,208,63,.72);
      display:inline-flex;align-items:center;justify-content:center;margin:0 8px;padding:0 10px;color:#fff;
      background:rgba(255,255,255,.04);
    }
    .balance-blank.ok{border-style:solid;border-color:var(--ok);background:rgba(79,217,130,.22);color:#d9ffe8}
    .balance-blank.bad{border-style:solid;border-color:#ff9f9f;background:rgba(176,58,46,.55)}
    .tile-rack{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    .num-tile{
      width:62px;height:62px;border-radius:14px;border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);
      display:flex;align-items:center;justify-content:center;font-size:30px;cursor:grab;user-select:none;
    }
    .num-tile:active{cursor:grabbing}
    .balance-hint{text-align:center;font-size:14px;color:#ffe8b2}
    @media (max-width:700px){
      .completion-card{padding:24px 20px;gap:14px}
      .completion-title{font-size:24px}
    }
    .round-pop{
      position:fixed;
      inset:0;
      z-index:210;
      display:flex;
      align-items:center;
      justify-content:center;
      background:rgba(5,18,38,.62);
      backdrop-filter:blur(5px);
      opacity:0;
      pointer-events:none;
      transition:opacity .26s ease;
    }
    .round-pop.on{opacity:1;pointer-events:all}
    .round-pop-inner{
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:10px;
      animation:sPop .38s cubic-bezier(.34,1.56,.64,1) both;
    }
    .round-check{
      font-size:clamp(72px,14vw,120px);
      line-height:1;
      filter:drop-shadow(0 8px 16px rgba(79,217,130,.55));
    }
    .round-plus{
      font-size:clamp(22px,4vw,30px);
      font-weight:900;
      color:var(--sand);
      letter-spacing:.06em;
      text-shadow:0 2px 12px rgba(244,208,63,.85);
    }
    .s-inner{
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:16px;
      animation:sPop .5s cubic-bezier(.34,1.56,.64,1) both;
    }
    @keyframes sPop{from{opacity:0;transform:scale(.3) rotate(-8deg)}to{opacity:1;transform:scale(1)}}
    .s-stars{font-size:54px;letter-spacing:8px}
    .s-title{
      font-size:clamp(32px,5.5vw,64px);
      color:var(--sand);
      text-shadow:0 0 32px rgba(244,208,63,.8),4px 4px 0 #7b5e0a;
      letter-spacing:3px;
    }
    .s-sub{font-size:17px;color:#c8e8c8;font-weight:700;text-align:center}
    .s-learn{max-width:560px;text-align:center;color:#ffe8b2;font-size:15px;font-weight:800}
    .nxt{
      padding:14px 46px;
      font-size:22px;
      color:var(--dark);
      background:linear-gradient(135deg,var(--sand),var(--gold));
      border:none;
      border-radius:50px;
      cursor:pointer;
      box-shadow:0 6px 0 #7b5e0a;
    }
    .nxt:hover{transform:translateY(-3px)}
    .nxt:active{transform:translateY(3px)}
    @keyframes confFall{
      0%{opacity:1;transform:translateY(-10px) rotate(0)}
      100%{opacity:0;transform:translateY(100vh) rotate(700deg)}
    }
    .intro-screen{
      position:fixed;
      inset:0;
      z-index:260;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:flex-start;
      padding-top:max(8px, env(safe-area-inset-top, 0px));
      padding-bottom:max(12px, env(safe-area-inset-bottom, 0px));
      box-sizing:border-box;
      background:#101522;
    }
    .intro-screen.hidden{display:none}
    .intro-bg-wrap{
      position:absolute;
      inset:0;
      overflow:hidden;
    }
    .intro-bg{
      position:absolute;
      inset:-8%;
      width:116%;
      height:116%;
      object-fit:cover;
      /* Was ~28px (~60% strength); 50/60 → sharper backdrop */
      filter:blur(23px);
      opacity:.92;
    }
    .intro-layout{
      position:relative;
      z-index:2;
      display:flex;
      flex-direction:column;
      align-items:center;
      width:100%;
      max-width:none;
      gap:clamp(8px,1.8vh,20px);
    }
    .intro-title-img{
      display:block;
      width:auto;
      /* ×3 from post–asset-tweak size (was max ~1008×308); story text stays small */
      max-width:min(96vw,3024px);
      height:auto;
      max-height:clamp(270px,58.8vh,924px);
      object-fit:contain;
      pointer-events:none;
      filter:drop-shadow(0 18px 44px rgba(0,0,0,.5));
      margin-top:-8vh;
    }
    .intro-panel{
      position:relative;
      z-index:2;
      width:min(560px,78vw);
      max-width:100%;
      padding:22px 24px 20px;
      text-align:center;
      background:rgba(5,15,30,.82);
      border:2px solid rgba(244,208,63,.45);
      border-radius:22px;
      box-shadow:0 24px 58px rgba(0,0,0,.55);
      display:flex;
      flex-direction:column;
      gap:16px;
      min-height:min(28vh,320px);
      margin-top:clamp(4px,1.5vh,12px);
    }
    .intro-story-wrap{
      flex:1;
      display:flex;
      align-items:center;
      justify-content:center;
      min-height:0;
      padding:8px 0 4px;
    }
    .intro-story{
      width:100%;
      max-width:min(48ch,100%);
      margin:0 auto;
      min-height:120px;
      font-size:clamp(14px,1.45vw,17px);
      color:#c8e8c8;
      line-height:1.7;
    }
    .intro-cur{
      display:inline-block;
      width:2px;
      height:1em;
      background:var(--sand);
      vertical-align:text-bottom;
      animation:introBlink .8s step-end infinite;
      margin-left:4px;
    }
    .intro-start{
      display:none;
      align-self:center;
      flex-shrink:0;
      padding:13px 50px;
      font-family:'Fredoka One',cursive;
      font-size:20px;
      letter-spacing:1px;
      color:var(--dark);
      background:linear-gradient(135deg,var(--sand),var(--gold));
      border:none;
      border-radius:50px;
      cursor:pointer;
      box-shadow:0 5px 0 #7b5e0a;
    }
    .intro-start.show{
      display:inline-block;
      animation:introPop .5s cubic-bezier(.34,1.56,.64,1) forwards;
    }
    @keyframes introBlink{
      0%,49%{opacity:1}
      50%,100%{opacity:0}
    }
    @keyframes introPop{
      from{transform:scale(.8);opacity:0}
      to{transform:scale(1);opacity:1}
    }
  </style>
</head>
<body>
  <div class="intro-screen" id="introScreen">
    <div class="intro-bg-wrap">
      <img class="intro-bg" id="introBg" alt="">
    </div>
    <div class="intro-layout">
      <img class="intro-title-img" id="introTitleImg" src="assets/backgrounds/title.png" alt="" decoding="async" fetchpriority="high" onerror="this.style.display='none'">
      <div class="intro-panel">
        <div class="intro-story-wrap">
          <div class="intro-story" id="introStory"></div>
        </div>
        <button class="intro-start" id="introStartBtn">BEGIN ADVENTURE</button>
      </div>
    </div>
  </div>
  <div class="game" id="game">
    <img class="bg" id="bg" alt="">
    <div class="overlay"></div>
    <div class="hud"><span class="cspin">🪙</span><span id="coinsLabel">0</span></div>
    <button class="stage-back-btn" id="stageBackBtn">← Back</button>
    <button class="stage-skip-btn" id="stageSkipBtn">⏭ Skip Stage 1</button>
    <div class="cpop" id="coinPopup">+0</div>
    <div class="instruction" id="instruction"></div>
    <div class="player-side" id="playerSide">
      <div class="p-frame" id="pFrame">
        <span id="pEmoji">🧍</span>
        <img id="pImg" alt="player">
      </div>
      <div class="p-tag" id="pTag"></div>
    </div>
    <div class="izone" id="izone"></div>
    <div class="bottom"></div>
  </div>
  <div class="success-screen" id="successScreen">
    <div class="s-inner">
      <div class="s-stars">⭐⭐⭐</div>
      <div class="s-title">AMAZING!</div>
      <div class="s-sub" id="successMsg">Well done!</div>
      <div class="s-learn" id="successLearn">Great progress today!</div>
      <button class="nxt" id="successNextBtn">Next →</button>
    </div>
  </div>
  <div class="completion-screen" id="completionScreen">
    <img class="completion-bg" id="completionBg" alt="">
    <div class="completion-overlay"></div>
    <button class="completion-back" id="completionBackBtn">← Back</button>
    <div class="completion-card">
      <div class="completion-title">🏆 Adventure Complete!</div>
      <img class="completion-avatar" id="completionAvatar" alt="">
      <div class="completion-level" id="completionLevel">Level 2</div>
      <div class="completion-name" id="completionName">Hero</div>
      <div class="completion-section">Artifact Earned</div>
      <div class="artifact-wrap">
        <img class="artifact-main" id="completionArtifactImg" alt="">
        <div class="artifact-main fallback hidden" id="completionArtifactFallback">🏆</div>
        <span class="artifact-spark s1">✨</span><span class="artifact-spark s2">✨</span>
        <span class="artifact-spark s3">✨</span><span class="artifact-spark s4">✨</span>
      </div>
      <div class="artifact-name" id="completionArtifactName">Mystery Artifact</div>
      <div class="artifact-desc" id="completionArtifactDesc">A magical reward for your journey.</div>
      <div class="completion-section">Inventory</div>
      <div class="inventory-row" id="completionInventory"></div>
      <div class="completion-coins" id="completionCoins">🪙 0 coins earned!</div>
      <button class="completion-reload" id="completionPlayAgainBtn">🔄 Play Again</button>
    </div>
  </div>
  <div class="story-screen" id="storyScreen">
    <div class="story-card">
      <div class="story-title">👑 Monkey King Is Free!</div>
      <div class="story-text" id="storyText"></div>
      <button class="story-shop-btn" id="storyShopBtn">🛍️ Open Shop</button>
    </div>
  </div>
  <div class="shop-screen" id="shopScreen">
    <img class="shop-bg" id="shopBg" alt="">
    <div class="shop-wrap">
      <div class="shop-top">
        <div class="shop-title">🛒 Monkey Shop</div>
        <div class="shop-coins">🪙 <span id="shopCoins">0</span></div>
      </div>
      <div class="shop-grid" id="shopGrid"></div>
      <button class="shop-finish" id="shopFinishBtn">🏁 Finish Adventure</button>
    </div>
  </div>

  <script>
  const LESSON = ${payload};
  const BACKGROUND_MAP = ${bgPayload};
  const CHARACTER_MAP = ${charPayload};
  const ITEMS_MAP = ${itemsPayload};
  const TARGETS_MAP = ${targetsPayload};
  const ARTIFACT_MAP = ${artifactsPayload};
  function buildShopItemsFromArtifacts(){
    const keys = Object.keys(ARTIFACT_MAP || {});
    const sorted = keys.sort((a, b) => titleFromKey(a).localeCompare(titleFromKey(b)));
    const cheap = [35, 45, 60, 75];
    const mid = [95, 120, 145, 170];
    const high = [210, 260, 320, 420];
    return sorted.map((key, i) => {
      const bucket = i % 3 === 0 ? cheap : (i % 3 === 1 ? mid : high);
      const price = bucket[Math.floor(i / 3) % bucket.length];
      return {
        id: key,
        name: titleFromKey(key),
        img: artifactPathByKey(key),
        price,
      };
    });
  }
  const SHOP_ITEMS = buildShopItemsFromArtifacts();
  function resolveArtifactKey(raw){
    const value = String(raw || "").trim();
    if(!value) return "";
    if(ARTIFACT_MAP[value]) return value;
    const fuzzy = fuzzyFindPath(ARTIFACT_MAP, value);
    if(fuzzy){
      const hit = Object.keys(ARTIFACT_MAP).find((k) => ARTIFACT_MAP[k] === fuzzy);
      if(hit) return hit;
    }
    const wanted = normKey(value);
    const keys = Object.keys(ARTIFACT_MAP);
    const exact = keys.find((k) => normKey(k) === wanted);
    if(exact) return exact;
    return "";
  }

  function buildInitialOwnedArtifacts(){
    const owned = [];
    const seen = new Set();
    const inventory = Array.isArray(LESSON.meta?.child_inventory) ? LESSON.meta.child_inventory : [];
    for(const raw of inventory){
      const key = resolveArtifactKey(raw);
      if(!key || seen.has(key)) continue;
      seen.add(key);
      owned.push({
        key,
        name: titleFromKey(key),
        image: artifactPathByKey(key),
        description: "Owned before this lesson.",
      });
    }
    if(LESSON.meta?.has_freeze_ring){
      const ringKey = resolveArtifactKey("ring_ice") || "ring_ice";
      if(!seen.has(ringKey)){
        seen.add(ringKey);
        owned.push({
          key: ringKey,
          name: titleFromKey(ringKey),
          image: artifactPathByKey(ringKey),
          description: "Owned before this lesson.",
        });
      }
    }
    return owned;
  }

  const $ = (id) => document.getElementById(id);
  const izone = $("izone");
  const PRACTICE_TARGET = 5;
  let lane = null;
  const state = {
    stageIndex: 0,
    stagePracticeDone: 0,
    stagePracticeTarget: PRACTICE_TARGET,
    totalCoins: Number(LESSON.meta?.start_coins ?? LESSON.meta?.student_coins ?? LESSON.meta?.coins_balance ?? 0),
    profileSynced: false,
    stageSolved: false,
    selectedSortId: null,
    drag: null,
    zoneCounts: {},
    animationTimers: [],
    successCb: null,
    sortBadges: {},
    earnedArtifacts: buildInitialOwnedArtifacts(),
    completionArtifact: null,
  };
  const STAGES = buildStagePlan();

  function normKey(value){
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function fuzzyFindPath(map, key){
    if(!key) return "";
    if(map[key]) return map[key];
    const wanted = normKey(key);
    const keys = Object.keys(map);
    const exactNorm = keys.find((k) => normKey(k) === wanted);
    if(exactNorm) return map[exactNorm];
    // Short keys like "2" / "3" must not substring-match e.g. crystal_island2.
    if(wanted.length <= 2) return "";
    const includes = keys.find((k) => {
      const nk = normKey(k);
      return nk.includes(wanted) || wanted.includes(nk);
    });
    return includes ? map[includes] : "";
  }

  function hasCyrillic(value){
    return /[\\u0400-\\u04FF]/.test(String(value || ""));
  }

  function resolveEngineType(type){
    if(type === "fill_blank" || type === "pattern_input") return "input";
    if(type === "multi_choice") return "choice";
    if(type === "tap_count") return "tap_count";
    if(type === "corridor_choice") return "corridor_choice";
    return type;
  }

  function englishStageFallback(stage){
    const t = resolveEngineType(stage.type);
    if(t === "drag_drop") return "Drag items into the correct baskets.";
    if(t === "drag_sort") return "Select an item, then place it into the next slot.";
    if(t === "drag_group") return "Sort the numbers into the correct groups.";
    if(t === "input") return "Type the correct number in each input field.";
    if(t === "choice") return "Choose the correct answer.";
    if(t === "tap_count") return "Tap as many times as the task says.";
    if(t === "corridor_choice") return "Pick the path that fits the math story.";
    if(t === "animation") return "Watch the final animation sequence.";
    return "Complete the task to continue.";
  }

  function englishSuccessFallback(stage){
    const t = resolveEngineType(stage.type);
    if(t === "drag_drop") return "Great! All baskets are complete!";
    if(t === "drag_sort") return "Perfect order!";
    if(t === "drag_group") return "Great grouping!";
    if(t === "input") return "All answers are correct!";
    if(t === "choice") return "Correct choice!";
    if(t === "tap_count") return "Nice counting!";
    if(t === "corridor_choice") return "Right path!";
    if(t === "animation") return "Level complete!";
    return "Success!";
  }

  function englishTitle(stage, index){
    const raw = stage.title || "";
    if(raw && !hasCyrillic(raw)) return raw;
    return "Stage " + (index + 1);
  }

  function mapXToRightLane(x){
    const num = Number(x || 0);
    return Math.max(6, Math.min(94, num));
  }

  function buildStagePlan(){
    const src = Array.isArray(LESSON.stages) ? LESSON.stages : [];
    const fallback = src[src.length - 1] || { type: "choice", options: [{label:"A",correct:true}], question: "Choose", coins: 0 };
    const plan = [];
    for(let i = 0; i < 6; i++){
      const pick = src[i] || (i === 5 ? fallback : src[Math.min(i, src.length - 1)] || fallback);
      plan.push({...pick, _stageNo: i + 1});
    }
    return plan;
  }

  function shuffle(list){
    const arr = [...list];
    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function buildScatterPositions(count, area){
    const positions = [];
    const minDistance = area.minDistance ?? 14;
    const maxAttempts = Math.max(120, count * 80);
    let attempts = 0;

    while(positions.length < count && attempts < maxAttempts){
      attempts += 1;
      const x = area.xMin + Math.random() * (area.xMax - area.xMin);
      const y = area.yMin + Math.random() * (area.yMax - area.yMin);
      const isFarEnough = positions.every((p) => {
        const dx = p.x - x;
        const dy = p.y - y;
        return Math.hypot(dx, dy) >= minDistance;
      });
      if(isFarEnough) positions.push({x, y});
    }

    while(positions.length < count){
      const idx = positions.length;
      const cols = Math.max(2, Math.ceil(Math.sqrt(count)));
      const rows = Math.max(2, Math.ceil(count / cols));
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const stepX = (area.xMax - area.xMin) / Math.max(1, cols - 1);
      const stepY = (area.yMax - area.yMin) / Math.max(1, rows - 1);
      positions.push({
        x: Math.min(area.xMax, area.xMin + col * stepX),
        y: Math.min(area.yMax, area.yMin + row * stepY),
      });
    }

    return shuffle(positions);
  }

  function firstMapPath(map){
    const keys = Object.keys(map || {}).filter((k) => map[k]).sort();
    if(!keys.length) return "";
    return map[keys[0]];
  }

  function imagePathByKey(key, kind = "item"){
    if(!key) return "";
    if(kind === "target"){
      const target = fuzzyFindPath(TARGETS_MAP, key);
      if(target) return target;
      const fb = firstMapPath(TARGETS_MAP);
      if(fb) return fb;
      return "assets/targets/" + key + ".png";
    }
    const item = fuzzyFindPath(ITEMS_MAP, key);
    if(item) return item;
    const fbItem = firstMapPath(ITEMS_MAP);
    if(fbItem) return fbItem;
    return "assets/items/" + key + ".png";
  }

  function placeholderEmoji(key){
    const k = String(key || "").toLowerCase();
    if(k.includes("basket")) return "🧺";
    if(k.includes("shell")) return "🐚";
    if(k.includes("banana")) return "🍌";
    if(k.includes("pearl")) return "🟡";
    if(k.includes("leaf")) return "🍃";
    if(k.includes("stone") || k.includes("rock")) return "🪨";
    if(k.includes("crab")) return "🦀";
    if(k.includes("glasses")) return "🕶️";
    if(k.includes("cherry")) return "🍒";
    if(k.includes("bowl")) return "🥣";
    if(k.includes("samurai") || k.includes("monkey")) return "🐵";
    return "🧩";
  }

  function backgroundPath(bgKey){
    const k = String(bgKey || "").trim();
    if(!k) return "";
    if(k === "2") return "assets/backgrounds/2.png";
    if(k === "3") return "assets/backgrounds/3.png";
    if(/_island[1-4]$/.test(k)) return "assets/backgrounds/" + k + ".PNG";
    const mapped = fuzzyFindPath(BACKGROUND_MAP, k);
    if(mapped) return mapped;
    return "assets/backgrounds/" + k + ".png";
  }

  /** Ordered URLs for stage BG img — disk map first, then common extensions (PNG casing varies). */
  function stageBackgroundCandidates(stem){
    const k = String(stem || "").trim();
    if(!k) return [];
    const primary = backgroundPath(k);
    const base = "assets/backgrounds/" + k;
    const extras = [".PNG", ".png", ".webp", ".jpg", ".jpeg"].map((ext) => base + ext);
    return [...new Set([primary, ...extras].filter(Boolean))];
  }

  function setStageBackgroundImg(el, stem){
    const urls = stageBackgroundCandidates(stem);
    if(!urls.length){
      el.removeAttribute("src");
      el.onerror = null;
      return;
    }
    let i = 0;
    el.onerror = () => {
      i += 1;
      if(i >= urls.length){
        el.onerror = null;
        el.removeAttribute("src");
        if(el.id === "bg"){
          $("game").style.background = "radial-gradient(circle at 20% 20%, #204a66, #0b1426)";
        }
      }else{
        el.src = urls[i];
      }
    };
    el.src = urls[0];
  }

  function characterPath(charKey){
    if(!charKey) return "";
    const mapped = fuzzyFindPath(CHARACTER_MAP, charKey);
    if(mapped) return mapped;
    return "assets/characters/" + charKey + ".webp";
  }

  function artifactPathByKey(key){
    if(!key) return "";
    if(ARTIFACT_MAP[key]) return ARTIFACT_MAP[key];
    const fuzzy = fuzzyFindPath(ARTIFACT_MAP, key);
    if(fuzzy) return fuzzy;
    return "assets/artifacts/" + key + ".png";
  }

  const PRELOADED_ASSETS = new Set();

  function preloadImage(src){
    const url = String(src || "").trim();
    if(!url || PRELOADED_ASSETS.has(url)) return;
    PRELOADED_ASSETS.add(url);
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = url;
  }

  function collectStageAssetUrls(stage, stageIndex){
    const urls = new Set();
    if(!stage) return urls;
    urls.add(backgroundPath(resolveStageBackground(stage, stageIndex)));
    const charKey = LESSON.meta?.character_key || LESSON.character?.image_key || "";
    if(charKey) urls.add(characterPath(charKey));
    if(stage.image_key) urls.add(imagePathByKey(stage.image_key, "item"));
    if(stage.goal_image_key) urls.add(imagePathByKey(stage.goal_image_key, "target"));
    if(stage.bowl_image_key) urls.add(imagePathByKey(stage.bowl_image_key, "target"));
    (stage.totem_targets || []).forEach((k) => urls.add(imagePathByKey(k, "target")));
    (stage.drop_zones || []).forEach((z) => {
      const kind = z.image_kind === "item" ? "item" : "target";
      urls.add(imagePathByKey(z.image_key, kind));
    });
    (stage.draggables || []).forEach((d) => urls.add(imagePathByKey(d.image_key, "item")));
    (stage.items || []).forEach((it) => urls.add(imagePathByKey(it?.image_key || stage.image_key || "banana", "item")));
    if(stage.left_path?.image_key){
      const lk = stage.left_path.image_kind === "target" ? "target" : "item";
      urls.add(imagePathByKey(stage.left_path.image_key, lk));
    }
    if(stage.right_path?.image_key){
      const rk = stage.right_path.image_kind === "target" ? "target" : "item";
      urls.add(imagePathByKey(stage.right_path.image_key, rk));
    }
    return urls;
  }

  function warmupStageAssets(index){
    const current = STAGES[index];
    const next = STAGES[Math.min(index + 1, STAGES.length - 1)];
    collectStageAssetUrls(current, index).forEach(preloadImage);
    collectStageAssetUrls(next, Math.min(index + 1, STAGES.length - 1)).forEach(preloadImage);
  }

  function titleFromKey(key){
    return String(key || "Mystery Artifact")
      .replace(/[_-]+/g, " ")
      .replace(/\\b\\w/g, (c) => c.toUpperCase());
  }

  function ensureRingIceInventory(){
    const hasRing = state.earnedArtifacts.some((a) => a && a.key === "ring_ice");
    if(hasRing) return;
    state.earnedArtifacts.unshift({
      key: "ring_ice",
      name: "Ring of Ice",
      image: "assets/characters/ring_ice.webp",
      emoji: "🧊",
      description: "A legacy artifact from the previous island.",
    });
  }

  function posStyle(x, y){
    return "left:" + mapXToRightLane(x) + "%;top:" + Number(y || 0) + "%;transform:translate(-50%,-50%);";
  }

  function setMessage(_text){}

  function lessonApiBase(){
    try{
      const b = document.querySelector("base");
      if(b && b.href) return new URL(b.href, window.location.href).origin;
    } catch {}
    return window.location.origin;
  }

  function collectInventorySlugsForSync(){
    const set = new Set();
    const add = (x) => {
      const s = String(x || "").trim().toLowerCase().replace(/\\s+/g, "_");
      if(s) set.add(s);
    };
    for(const raw of LESSON.meta?.child_inventory || []) add(raw);
    for(const a of state.earnedArtifacts){
      if(a && a.key) add(a.key);
    }
    return Array.from(set);
  }

  async function syncLessonProgressToServer(){
    const code = LESSON.meta?.student_code;
    if(!code || state.profileSynced) return;
    const startLevel = Number(LESSON.meta?.student_level ?? 0);
    const payload = {
      code,
      finalCoins: state.totalCoins,
      newLevel: startLevel + 1,
      inventory: collectInventorySlugsForSync(),
    };
    try{
      const res = await fetch(lessonApiBase() + "/api/lesson-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if(res.ok && data.ok) state.profileSynced = true;
    } catch(e) {
      console.warn("lesson-complete", e);
    }
  }

  function addCoins(amount){
    if(!amount) return;
    const delta = Number(amount) || 0;
    state.totalCoins += delta;
    $("coinsLabel").textContent = String(state.totalCoins);
    const popup = $("coinPopup");
    popup.textContent = "+" + delta;
    popup.classList.remove("go");
    void popup.offsetWidth;
    popup.classList.add("go");
  }

  function clearStage(){
    izone.innerHTML = "";
    lane = document.createElement("div");
    lane.className = "right-lane";
    izone.appendChild(lane);
    state.selectedSortId = null;
    state.drag = null;
    state.zoneCounts = {};
    state.sortBadges = {};
    state.stageSolved = false;
    for(const timer of state.animationTimers) clearTimeout(timer);
    state.animationTimers = [];
  }

  function mergeRoundIntoStage(base, round){
    if(!round || typeof round !== "object") return base;
    const out = { ...base };
    const pass = [
      "instruction", "draggables", "drop_zones", "required_per_zone", "prefill_per_zone",
      "inputs", "question", "options", "items", "correct_order", "target_count", "image_key", "answer",
      "numbers_text", "group1_name", "group2_name", "group1_values", "group2_values",
      "base_number", "parts_count",
      "baseNumber", "partsCount",
      "timer_example_a", "timer_example_b", "timer_example_c",
      "timer_answer_a", "timer_answer_b", "timer_answer_c", "timer_seconds",
      "timerExampleA", "timerExampleB", "timerExampleC",
      "timerAnswerA", "timerAnswerB", "timerAnswerC", "timerSeconds",
      "symbol_a", "symbol_b", "symbol_c", "symbol_expression",
      "symbolA", "symbolB", "symbolC", "symbolExpression",
      "symbol_item_a", "symbol_item_b", "symbol_item_c",
      "symbolItemA", "symbolItemB", "symbolItemC",
      "unknown_a", "unknown_b", "unknown_equation",
      "unknownA", "unknownB", "unknownEquation",
      "unknown_item_a", "unknown_item_b", "unknown_item_c",
      "unknownItemA", "unknownItemB", "unknownItemC",
      "pair_a", "pair_b", "pair_c", "pair_d", "correct_pair_1", "correct_pair_2",
      "pairA", "pairB", "pairC", "pairD", "correctPair1", "correctPair2",
      "left_expression", "right_expression", "correct_side",
      "leftExpression", "rightExpression", "correctSide",
      "left_path", "right_path", "sequence", "round", "operator_tasks",
      "tap_step", "counter_start", "counter_goal", "counter_suffix",
      "tap_mode", "totem_targets", "bowl_image_key", "per_target_goal",
      "number_start", "number_end", "goal_image_key",
      "sequence_board", "hide_instruction_label", "input_style",
      "totem_cycle", "tap_target_order",
      "balance_left", "balance_right", "balance_answer", "balance_options",
      "post_story_text"
    ];
    for(const k of pass){
      if(round[k] !== undefined) out[k] = round[k];
    }
    if(round.type) out.type = round.type;
    if(round.coins != null) out.coins = round.coins;
    if(round.success_message) out.success_message = round.success_message;
    if(round.title) out.title = round.title;

    // Compatibility bridge: many generated lessons use "example" for fill_blank rows.
    // The input renderer expects inputs: [{ prompt, answer }].
    if(
      (resolveEngineType(out.type) === "input") &&
      !Array.isArray(out.inputs) &&
      (round.example != null || round.prompt != null || round.answer != null)
    ){
      const promptText = round.prompt ?? round.example ?? out.prompt ?? "";
      out.inputs = [{ prompt: String(promptText), answer: round.answer ?? out.answer ?? "" }];
    }

    // Compatibility bridge: generated multi_choice often sends "correct_option"
    // while renderer expects option objects with correct: true.
    if(
      resolveEngineType(out.type) === "choice" &&
      Array.isArray(round.options) &&
      round.options.length
    ){
      const correctId = String(round.correct_option ?? round.correctOption ?? "").trim().toUpperCase();
      out.options = round.options.map((opt, idx) => {
        const id = String(opt.id ?? String.fromCharCode(65 + idx)).trim().toUpperCase();
        const isCorrect = (opt.correct === true) || (String(opt.correct).toLowerCase() === "true") || (correctId && id === correctId);
        return { ...opt, id, correct: isCorrect };
      });
    }

    if(resolveEngineType(out.type) === "choice" && !out.question){
      out.question = round.question ?? round.prompt ?? round.instruction ?? out.question ?? "";
    }
    if (base && base.background != null && String(base.background).trim() !== "") {
      out.background = base.background;
    }
    return out;
  }

  function resolveCurrentTask(baseStage){
    const rounds = Array.isArray(baseStage.rounds) ? baseStage.rounds : [];
    const tasks = Array.isArray(baseStage.practice_tasks) ? baseStage.practice_tasks : [];
    if(rounds.length > 0){
      state.stagePracticeTarget = rounds.length;
      const idx = Math.min(state.stagePracticeDone, rounds.length - 1);
      const round = rounds[idx] || {};
      return mergeRoundIntoStage(baseStage, round);
    }
    if(tasks.length > 0){
      state.stagePracticeTarget = tasks.length;
      const idx = Math.min(state.stagePracticeDone, tasks.length - 1);
      const task = tasks[idx] || {};
      return {
        ...baseStage,
        ...task,
        type: task.type || baseStage.type,
        coins: task.coins ?? baseStage.coins,
        success_message: task.success_message || baseStage.success_message,
        background: baseStage.background,
      };
    }
    state.stagePracticeTarget = 1;
    return baseStage;
  }

  function updateStageControls(){
    const skip = $("stageSkipBtn");
    skip.textContent = "⏭ Skip Stage " + (state.stageIndex + 1);
  }

  function advanceToNextStage(){
    state.stagePracticeDone = 0;
    if(state.stageIndex < STAGES.length - 1){
      state.stageIndex += 1;
      renderStage(state.stageIndex);
    }else{
      finishLesson();
    }
  }

  function showRoundSuccess(onContinue){
    const overlay = document.createElement("div");
    overlay.className = "round-pop";
    overlay.innerHTML = '<div class="round-pop-inner"><span class="round-check">✓</span><span class="round-plus">Correct!</span></div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("on"));
    const t = setTimeout(() => {
      overlay.classList.remove("on");
      setTimeout(() => {
        overlay.remove();
        onContinue();
      }, 280);
    }, 820);
    state.animationTimers.push(t);
  }

  function markSuccess(stage){
    if(state.stageSolved) return;
    state.stageSolved = true;
    const base = STAGES[state.stageIndex];
    const rounds = Array.isArray(base.rounds) ? base.rounds : [];
    const nRounds = rounds.length;
    const bonus = Number(base.round_bonus_coins != null ? base.round_bonus_coins : 2);

    state.stagePracticeDone += 1;

    const engStage = { ...stage, type: resolveEngineType(stage.type) };
    const msg = String(stage.success_message || "").trim()
      ? stage.success_message
      : englishSuccessFallback(engStage);

    if(nRounds >= 2){
      if(state.stagePracticeDone < nRounds){
        state.stageSolved = false;
        renderStage(state.stageIndex);
        return;
      }
      addCoins(bonus);
      addCoins(Number(base.coins != null ? base.coins : stage.coins) || 0);
      showSuccess(msg, () => {
        advanceToNextStage();
      }, "Round " + nRounds + "/" + nRounds + " — stage clear!");
      return;
    }

    if(nRounds === 1){
      addCoins(Number(base.coins != null ? base.coins : stage.coins) || 0);
      showSuccess(msg, () => {
        advanceToNextStage();
      }, "Round 1/1 complete!");
      return;
    }

    addCoins(stage.coins);
    showSuccess(msg, () => {
      if(state.stagePracticeDone < state.stagePracticeTarget){
        renderStage(state.stageIndex);
        return;
      }
      advanceToNextStage();
    }, "Practice " + state.stagePracticeDone + "/" + state.stagePracticeTarget);
  }

  function makeImg(className, imageKey, extraStyle = "", kind = "item"){
    const img = document.createElement("img");
    img.className = className;
    img.src = imagePathByKey(imageKey, kind);
    img.decoding = "async";
    img.alt = imageKey || "item";
    img.style.cssText += extraStyle;
    img.onerror = () => {
      // Keep the same DOM node so drag/click handlers stay attached.
      const emoji = placeholderEmoji(imageKey);
      const svg = encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">' +
        '<text x="50%" y="54%" text-anchor="middle" font-size="64">' + emoji + "</text>" +
        "</svg>"
      );
      img.src = "data:image/svg+xml;charset=utf-8," + svg;
      img.style.objectFit = "contain";
      img.style.padding = "0";
    };
    return img;
  }

  function shake(el){
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }

  function renderDragDrop(stage){
    const zoneById = {};
    const required = stage.required_per_zone || {};
    const prefill = stage.prefill_per_zone || {};
    const zones = stage.drop_zones || [];
    const draggableById = Object.fromEntries((stage.draggables || []).map((d) => [String(d.id), d]));

    const divider = document.createElement("div");
    divider.className = "dd-divider";
    divider.setAttribute("aria-hidden", "true");
    lane.appendChild(divider);

    const nz = zones.length || 1;
    const dockY = 82;
    zones.forEach((z, idx) => {
      const zoneWrap = document.createElement("div");
      zoneWrap.className = "drop-zone drop-zone-minimal";
      zoneWrap.dataset.zoneId = z.id;
      const xPct = nz <= 1 ? 50 : (100 / (nz + 1)) * (idx + 1);
      zoneWrap.style.cssText += posStyle(xPct, dockY);

      const img = makeImg(
        "game-img",
        z.image_key,
        "width:100%;height:100%;object-fit:contain;position:relative;opacity:1;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35));",
        z.image_kind === "item" ? "item" : "target"
      );
      zoneWrap.appendChild(img);
      const need = Number(required[z.id] ?? 0);
      const needBadge = document.createElement("div");
      needBadge.className = "zone-need";
      needBadge.textContent = String(need);
      zoneWrap.appendChild(needBadge);
      lane.appendChild(zoneWrap);
      state.zoneCounts[z.id] = Number(prefill[z.id] ?? 0);
      zoneById[z.id] = zoneWrap;
      const have = Number(prefill[z.id] ?? 0);
      if(have >= need && need > 0) zoneWrap.classList.add("done");
    });

    const draggables = stage.draggables || [];
    const draggableSpots = buildScatterPositions(draggables.length, {
      xMin: 12,
      xMax: 88,
      yMin: 10,
      yMax: 44,
      minDistance: 20,
    });

    draggables.forEach((d, i) => {
      const spot = draggableSpots[i];
      const draggable = makeImg("game-img draggable", d.image_key, posStyle(spot.x, spot.y));
      draggable.dataset.id = d.id;
      draggable.dataset.start = draggable.style.cssText;
      enablePointerDrag(draggable, (x, y) => {
        const zoneHit = Object.values(zoneById).find((zoneEl) => {
          const r = zoneEl.getBoundingClientRect();
          return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        });
        if(!zoneHit){
          draggable.style.cssText = draggable.dataset.start;
          shake(draggable);
          return;
        }
        const zoneId = zoneHit.dataset.zoneId;
        const meta = draggableById[String(draggable.dataset.id)] || {};
        if(meta.decoy === true){
          draggable.style.cssText = draggable.dataset.start;
          shake(draggable);
          return;
        }
        if(Array.isArray(meta.accept_zone_ids) && meta.accept_zone_ids.length > 0 && !meta.accept_zone_ids.includes(zoneId)){
          draggable.style.cssText = draggable.dataset.start;
          shake(draggable);
          return;
        }
        const max = Number(required[zoneId] || 0);
        if(state.zoneCounts[zoneId] >= max){
          draggable.style.cssText = draggable.dataset.start;
          shake(zoneHit);
          return;
        }
        state.zoneCounts[zoneId] += 1;
        draggable.style.pointerEvents = "none";
        draggable.style.zIndex = "14";
        draggable.style.cssText += "left:" + (zoneHit.offsetLeft + zoneHit.offsetWidth / 2) + "px;top:" + (zoneHit.offsetTop + zoneHit.offsetHeight / 2) + "px;transform:translate(-50%,-50%) scale(.35);opacity:0;transition:transform .2s ease, opacity .2s ease;";
        setTimeout(() => draggable.remove(), 220);
        zoneHit.classList.toggle("done", state.zoneCounts[zoneId] >= max);

        const isAllDone = Object.keys(required).every((id) => state.zoneCounts[id] >= Number(required[id]));
        if(isAllDone) markSuccess(stage);
      });
      lane.appendChild(draggable);
    });
  }

  function renderDragSort(stage){
    const slots = [];
    const total = (stage.correct_order || []).length;
    const useTwoRows = total > 4;
    const cols = useTwoRows ? Math.ceil(total / 2) : total;
    const row1Count = useTwoRows ? cols : total;
    const row2Count = useTwoRows ? (total - cols) : 0;
    const xStart = 14;
    const xEnd = 86;
    const rowY = useTwoRows ? [48, 60] : [50];

    const slotPos = [];
    for(let i = 0; i < row1Count; i++){
      const x = row1Count <= 1
        ? 50
        : xStart + (i * (xEnd - xStart) / Math.max(1, row1Count - 1));
      slotPos.push({ x, y: rowY[0] });
    }
    for(let i = 0; i < row2Count; i++){
      const x = row2Count <= 1
        ? 50
        : xStart + (i * (xEnd - xStart) / Math.max(1, row2Count - 1));
      slotPos.push({ x, y: rowY[1] });
    }

    for(let i=0;i<total;i++){
      const slot = document.createElement("div");
      slot.className = "sort-slot";
      slot.dataset.index = String(i);
      const p = slotPos[i] || { x: 50, y: 80 };
      slot.style.cssText += posStyle(p.x, p.y);
      slot.innerHTML = "<div class='sort-slot-line'></div>";
      slot.onclick = () => onSortSlotClick(stage, slot);
      slots.push(slot);
      lane.appendChild(slot);
    }

    const items = stage.items || [];
    const itemSpots = buildScatterPositions(items.length, {
      xMin: 10, xMax: 90, yMin: useTwoRows ? 76 : 80, yMax: useTwoRows ? 90 : 92, minDistance: 19,
    });

    items.forEach((item, i) => {
      const spot = itemSpots[i];
      const key = item?.image_key || stage.image_key || "banana";
      const el = makeImg("game-img sort-item", key, posStyle(spot.x, spot.y));
      el.dataset.id = item.id;
      el.dataset.value = String(item.value);
      const badge = document.createElement("div");
      badge.className = "value-chip";
      badge.textContent = String(item.value);
      badge.style.left = mapXToRightLane(spot.x) + "%";
      badge.style.top = (Number(spot.y) - 9) + "%";
      state.sortBadges[item.id] = badge;
      el.onclick = () => {
        if(el.dataset.locked === "1") return;
        document.querySelectorAll(".sort-item").forEach((n) => n.classList.remove("selected"));
        el.classList.add("selected");
        state.selectedSortId = item.id;
      };
      lane.appendChild(el);
      lane.appendChild(badge);
    });
  }

  function parseNumberList(value){
    if(Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
    return String(value || "")
      .split(/[,\\s]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  function renderDragGroup(stage){
    const all = parseNumberList(stage.numbers_text || stage.numbersText || "");
    const g1Name = String(stage.group1_name || stage.group1Name || "Group 1");
    const g2Name = String(stage.group2_name || stage.group2Name || "Group 2");
    const g1Set = new Set(parseNumberList(stage.group1_values || stage.group1Values || ""));
    const g2Set = new Set(parseNumberList(stage.group2_values || stage.group2Values || ""));
    const groupBoxes = [];
    const acceptedCount = { g1: 0, g2: 0 };
    const expectedTotal = g1Set.size + g2Set.size;

    const mkGroup = (id, title, x) => {
      const box = document.createElement("div");
      box.className = "group-zone";
      box.dataset.groupId = id;
      box.style.cssText += posStyle(x, 38);
      const t = document.createElement("div");
      t.className = "group-zone-title";
      t.textContent = title;
      box.append(t);
      lane.appendChild(box);
      groupBoxes.push({ id, box });
    };

    mkGroup("g1", g1Name, 26);
    mkGroup("g2", g2Name, 74);

    const numberList = all.map((num, idx) => ({
      num: String(num),
      id: "gnum" + (idx + 1),
    }));

    const bottomSpots = buildScatterPositions(numberList.length, {
      xMin: 10, xMax: 90, yMin: 78, yMax: 92, minDistance: 16,
    });

    numberList.forEach(({ num, id }, i) => {
      const spot = bottomSpots[i] || { x: 14 + i * 10, y: 86 };
      const chip = document.createElement("div");
      chip.className = "group-token";
      chip.style.cssText += posStyle(spot.x, spot.y);
      chip.dataset.id = id;
      chip.dataset.num = String(num);
      chip.dataset.start = chip.style.cssText;
      const img = makeImg("game-img", "banana", "");
      const badge = document.createElement("div");
      badge.className = "value-chip";
      badge.textContent = String(num);
      chip.appendChild(img);
      chip.appendChild(badge);

      enablePointerDrag(chip, (x, y) => {
        const hit = groupBoxes.find(({ box }) => {
          const r = box.getBoundingClientRect();
          return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        });
        if(!hit){
          chip.style.cssText = chip.dataset.start;
          shake(chip);
          return;
        }
        const isCorrect = (hit.id === "g1" && g1Set.has(String(num))) || (hit.id === "g2" && g2Set.has(String(num)));
        hit.box.classList.remove("group-zone-good", "group-zone-bad");
        if(!isCorrect){
          hit.box.classList.add("group-zone-bad");
          setTimeout(() => hit.box.classList.remove("group-zone-bad"), 260);
          chip.style.cssText = chip.dataset.start;
          shake(chip);
          return;
        }

        hit.box.classList.add("group-zone-good");
        acceptedCount[hit.id] += 1;
        const laneRect = lane.getBoundingClientRect();
        const boxRect = hit.box.getBoundingClientRect();
        const targetX = (boxRect.left - laneRect.left) + boxRect.width / 2;
        const targetY = (boxRect.top - laneRect.top) + boxRect.height / 2;
        chip.style.pointerEvents = "none";
        chip.style.transition = "left .2s ease, top .2s ease, opacity .2s ease, transform .2s ease";
        chip.style.left = targetX + "px";
        chip.style.top = targetY + "px";
        chip.style.transform = "translate(-50%,-50%) scale(.45)";
        chip.style.opacity = "0";
        setTimeout(() => chip.remove(), 220);
        if((acceptedCount.g1 + acceptedCount.g2) >= expectedTotal){
          markSuccess(stage);
        }
      });

      lane.appendChild(chip);
    });
  }

  function onSortSlotClick(stage, slot){
    if(state.stageSolved || slot.dataset.filled === "1") return;
    if(!state.selectedSortId){
      shake(slot);
      return;
    }
    const itemEl = [...document.querySelectorAll(".sort-item")].find((n) => n.dataset.id === state.selectedSortId);
    if(!itemEl) return;
    const idx = Number(slot.dataset.index);
    const expected = String(stage.correct_order[idx]);
    if(itemEl.dataset.value !== expected){
      shake(itemEl);
      setMessage("Try a different order.");
      return;
    }

    itemEl.dataset.locked = "1";
    itemEl.classList.remove("selected");
    itemEl.style.pointerEvents = "none";
    const laneRect = lane.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const centerX = (slotRect.left - laneRect.left) + (slotRect.width / 2);
    const lineCenterY = (slotRect.top - laneRect.top) + slotRect.height - 24 - 3;
    itemEl.style.cssText += "left:" + centerX + "px;top:" + lineCenterY + "px;transform:translate(-50%,-100%) scale(.72);";
    const badge = state.sortBadges[state.selectedSortId];
    if(badge){
      badge.style.left = centerX + "px";
      badge.style.top = (lineCenterY - 52) + "px";
      badge.style.transform = "translate(-50%,-50%) scale(.9)";
    }
    slot.dataset.filled = "1";
    slot.style.borderColor = "var(--ok)";
    slot.style.boxShadow = "var(--glow)";
    state.selectedSortId = null;
    const done = [...document.querySelectorAll(".sort-slot")].every((s) => s.dataset.filled === "1");
    if(done) markSuccess(stage);
  }

  function renderInput(stage){
    const card = document.createElement("div");
    card.className = "eq-card";
    const head = document.createElement("div");
    head.className = "eq-head";
    head.textContent = "🔐";
    card.appendChild(head);

    if(stage.input_style === "sequence_inline"){
      const board = document.createElement("div");
      board.className = "seq-board";
      (stage.inputs || []).forEach((entry) => {
        const row = document.createElement("div");
        row.className = "seq-row";
        const promptParts = String(entry.prompt || "")
          .replace(/,/g, " ")
          .split(/(\\?)/)
          .map((s) => s.trim())
          .filter(Boolean);
        let blankAdded = false;
        promptParts.forEach((part) => {
          if(part === "?" && !blankAdded){
            const input = document.createElement("input");
            input.className = "seq-blank answer";
            input.type = "number";
            input.inputMode = "numeric";
            input.autocomplete = "off";
            input.dataset.answer = String(entry.answer ?? "");
            input.addEventListener("keydown", (e) => {
              if(e.key === "Enter") e.preventDefault();
            });
            row.appendChild(input);
            blankAdded = true;
          } else {
            const span = document.createElement("span");
            span.textContent = part;
            row.appendChild(span);
          }
        });
        if(!blankAdded){
          const input = document.createElement("input");
          input.className = "seq-blank answer";
          input.type = "number";
          input.inputMode = "numeric";
          input.autocomplete = "off";
          input.dataset.answer = String(entry.answer ?? "");
          row.appendChild(input);
        }
        board.appendChild(row);
      });
      const btn = document.createElement("button");
      btn.className = "seq-submit";
      btn.type = "button";
      btn.textContent = "NEXT";
      btn.onclick = () => markSuccess(stage);
      const evaluate = () => {
        const blanks = [...board.querySelectorAll(".seq-blank")];
        const allFilled = blanks.every((b) => String(b.value).trim() !== "");
        if(!allFilled){
          btn.classList.remove("show");
          blanks.forEach((b) => b.classList.remove("ok"));
          return;
        }
        const ok = blanks.every((b) => String(b.value).trim() === String(b.dataset.answer).trim());
        if(ok){
          blanks.forEach((b) => {
            b.classList.add("ok");
            b.disabled = true;
          });
          btn.classList.add("show");
        }else{
          btn.classList.remove("show");
          blanks.forEach((b) => {
            b.classList.remove("ok");
            if(String(b.value).trim() !== String(b.dataset.answer).trim()){
              b.classList.add("bad");
              setTimeout(() => b.classList.remove("bad"), 220);
            }
          });
        }
      };
      board.querySelectorAll(".seq-blank").forEach((b) => {
        b.addEventListener("change", evaluate);
        b.addEventListener("blur", evaluate);
      });
      card.appendChild(board);
      card.appendChild(btn);
      lane.appendChild(card);
      return;
    }

    if(stage.sequence_board && Array.isArray(stage.sequence_board.rows)){
      const rows = stage.sequence_board.rows;
      const answers = Array.isArray(stage.sequence_board.answers) ? stage.sequence_board.answers : [];
      let blankIdx = 0;
      const board = document.createElement("div");
      board.className = "seq-board";
      rows.forEach((parts) => {
        const row = document.createElement("div");
        row.className = "seq-row";
        (parts || []).forEach((part) => {
          if(String(part) === "_"){
            const input = document.createElement("input");
            input.className = "seq-blank";
            input.type = "number";
            input.dataset.answer = String(answers[blankIdx] ?? "");
            blankIdx += 1;
            row.appendChild(input);
          } else {
            const span = document.createElement("span");
            span.textContent = String(part);
            row.appendChild(span);
          }
        });
        board.appendChild(row);
      });
      const btn = document.createElement("button");
      btn.className = "seq-submit";
      btn.type = "button";
      btn.textContent = "NEXT";
      btn.onclick = () => markSuccess(stage);
      const evaluate = () => {
        const blanks = [...board.querySelectorAll(".seq-blank")];
        const allFilled = blanks.every((b) => String(b.value).trim() !== "");
        if(!allFilled){
          btn.classList.remove("show");
          blanks.forEach((b) => b.classList.remove("ok"));
          return;
        }
        const ok = blanks.every((b) => String(b.value).trim() === String(b.dataset.answer).trim());
        if(ok){
          blanks.forEach((b) => {
            b.classList.add("ok");
            b.disabled = true;
          });
          btn.classList.add("show");
        }else{
          btn.classList.remove("show");
          blanks.forEach((b) => {
            b.classList.remove("ok");
            if(String(b.value).trim() !== String(b.dataset.answer).trim()){
              b.classList.add("bad");
              setTimeout(() => b.classList.remove("bad"), 220);
            }
          });
        }
      };
      board.querySelectorAll(".seq-blank").forEach((b) => {
        b.addEventListener("change", evaluate);
        b.addEventListener("blur", evaluate);
      });
      card.appendChild(board);
      card.appendChild(btn);
      lane.appendChild(card);
      return;
    }

    (stage.inputs || []).forEach((entry) => {
      const line = document.createElement("div");
      line.className = "eq-line";
      const promptRaw = String(entry.prompt || "Solve");
      line.textContent = promptRaw.replace(/→/g, " ");

      const input = document.createElement("input");
      input.className = "answer eq-input";
      input.type = "number";
      input.inputMode = "numeric";
      input.autocomplete = "off";
      input.addEventListener("keydown", (e) => {
        if(e.key === "Enter") input.blur();
      });
      input.onchange = () => {
        const ok = Number(input.value) === Number(entry.answer);
        if(ok){
          input.classList.add("ok");
          input.disabled = true;
          checkInputsDone(stage);
        }else{
          input.value = "";
          input.classList.add("bad");
          setTimeout(() => input.classList.remove("bad"), 200);
          shake(input);
        }
      };

      card.appendChild(line);
      card.appendChild(input);
    });
    lane.appendChild(card);
  }

  function checkInputsDone(stage){
    const allDone = [...document.querySelectorAll(".answer")].every((n) => n.disabled);
    if(allDone) markSuccess(stage);
  }

  function renderChoice(stage){
    const box = document.createElement("div");
    box.className = "choice-box";
    const q = document.createElement("div");
    q.className = "choice-q";
    const questionRaw = stage.question || "Choose the correct answer";
    q.textContent = questionRaw;
    box.appendChild(q);

    (stage.options || []).forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      const optLabel = opt.label ?? opt.text ?? "";
      btn.textContent = optLabel || ("Option " + (idxFromOption(stage.options, opt) + 1));
      btn.onclick = () => {
        if(state.stageSolved) return;
        const isCorrect = opt.correct === true || String(opt.correct).toLowerCase() === "true";
        if(isCorrect){
          btn.classList.add("ok");
          box.querySelectorAll(".choice-btn").forEach((b) => {
            b.style.pointerEvents = "none";
          });
          setTimeout(() => markSuccess(stage), 140);
        }else{
          shake(btn);
        }
      };
      box.appendChild(btn);
    });
    const hint = document.createElement("div");
    hint.className = "choice-hint";
    hint.textContent = "Tap one answer";
    box.appendChild(hint);
    lane.appendChild(box);
  }

  function renderTapCount(stage){
    const mode = String(stage.tap_mode || "").trim();
    if(mode === "totems"){
      if(stage.totem_cycle){
        const targets = Array.isArray(stage.totem_targets) ? stage.totem_targets : ["totem_1", "totem_2", "totem_3"];
        const orderRaw = Array.isArray(stage.tap_target_order) && stage.tap_target_order.length > 0
          ? stage.tap_target_order
          : [1, 2, 3];
        const order = orderRaw
          .map((n) => Number(n) - 1)
          .filter((n) => Number.isInteger(n) && n >= 0 && n < targets.length);
        const finalOrder = order.length > 0 ? order : [0];
        const goal = Number(stage.target_count || 12);
        let taps = 0;
        let cycleIdx = 0;

        const topRow = document.createElement("div");
        topRow.style.cssText =
          "position:absolute;left:50%;top:18%;transform:translateX(-50%);display:flex;gap:34px;justify-content:center;align-items:flex-end;z-index:12;";
        const totemEls = [];
        targets.forEach((key, idx) => {
          const totem = makeImg(
            "game-img",
            key,
            "position:relative;width:116px;height:136px;transition:transform .16s ease, filter .16s ease, opacity .16s ease;opacity:.92;",
            "target"
          );
          totem.dataset.idx = String(idx);
          totemEls.push(totem);
          topRow.appendChild(totem);
        });

        const stone = makeImg(
          "game-img",
          stage.image_key || "stone_blue",
          "position:absolute;left:50%;top:78%;transform:translate(-50%,-50%);cursor:pointer;z-index:12;width:134px;height:134px;"
        );

        function flyTo(targetEl){
          const projectile = stone.cloneNode(true);
          projectile.style.pointerEvents = "none";
          projectile.style.transition = "left .24s ease, top .24s ease, transform .24s ease, opacity .24s ease";
          projectile.style.zIndex = "13";
          lane.appendChild(projectile);
          const r = targetEl.getBoundingClientRect();
          const laneR = lane.getBoundingClientRect();
          const tx = r.left - laneR.left + r.width / 2;
          const ty = r.top - laneR.top + r.height / 2 + 10;
          projectile.style.left = tx + "px";
          projectile.style.top = ty + "px";
          projectile.style.transform = "translate(-50%,-50%) scale(.34)";
          projectile.style.opacity = "0";
          setTimeout(() => projectile.remove(), 260);
        }

        stone.addEventListener("click", () => {
          if(state.stageSolved) return;
          const idx = finalOrder[cycleIdx % finalOrder.length];
          cycleIdx += 1;
          taps += 1;
          const targetEl = totemEls[idx];
          if(targetEl){
            flyTo(targetEl);
            targetEl.style.filter = "drop-shadow(0 0 22px rgba(244,208,63,.9))";
            targetEl.style.transform = "scale(1.06)";
            setTimeout(() => {
              targetEl.style.filter = "drop-shadow(0 6px 10px rgba(0,0,0,.35))";
              targetEl.style.transform = "scale(1)";
            }, 170);
          }
          if(taps >= goal) markSuccess(stage);
        });

        lane.appendChild(topRow);
        lane.appendChild(stone);
        return;
      }

      const targets = Array.isArray(stage.totem_targets) ? stage.totem_targets : ["totem_1", "totem_2", "totem_3"];
      const perTarget = Number(stage.per_target_goal || 4);
      const counts = targets.map(() => 0);
      const row = document.createElement("div");
      row.style.cssText =
        "position:absolute;left:50%;top:28%;transform:translateX(-50%);display:flex;gap:16px;justify-content:center;align-items:flex-end;z-index:12;flex-wrap:wrap;";
      const labels = [];
      targets.forEach((key) => {
        const col = document.createElement("div");
        col.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;min-width:110px;";
        const totem = makeImg("game-img", key, "position:relative;width:92px;height:112px;", "target");
        const bowl = makeImg("game-img", stage.bowl_image_key || "bowl_wood", "position:relative;width:74px;height:74px;", "target");
        const lbl = document.createElement("div");
        lbl.textContent = "0 / " + perTarget;
        lbl.style.cssText = "font-size:22px;font-weight:900;color:var(--sand);";
        labels.push(lbl);
        col.appendChild(totem);
        col.appendChild(bowl);
        col.appendChild(lbl);
        row.appendChild(col);
      });
      const img = makeImg("game-img", stage.image_key || "stone_blue", "position:absolute;left:50%;top:78%;transform:translate(-50%,-50%);cursor:pointer;z-index:12;");
      img.style.width = "132px";
      img.style.height = "132px";
      img.addEventListener("click", () => {
        if(state.stageSolved) return;
        const idx = counts.findIndex((n) => n < perTarget);
        if(idx === -1) return;
        counts[idx] += 1;
        labels[idx].textContent = counts[idx] + " / " + perTarget;
        const done = counts.every((n) => n >= perTarget);
        if(done) markSuccess(stage);
      });
      lane.appendChild(row);
      lane.appendChild(img);
      return;
    }

    if(mode === "number_line"){
      const start = Number(stage.number_start != null ? stage.number_start : -6);
      const end = Number(stage.number_end != null ? stage.number_end : 0);
      const step = Number(stage.tap_step || 2);
      let value = start;
      const wrap = document.createElement("div");
      wrap.style.cssText =
        "position:absolute;left:50%;top:30%;transform:translateX(-50%);text-align:center;z-index:12;min-width:380px;";
      const counter = document.createElement("div");
      counter.textContent = String(value);
      counter.style.cssText = "font-size:36px;font-weight:900;margin-bottom:14px;color:var(--sand);";
      const shaft = document.createElement("div");
      shaft.style.cssText = "position:relative;margin:0 auto;width:120px;height:240px;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.24);";
      const monkey = makeImg("game-img", stage.image_key || "samurai_monkey", "position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:86px;height:86px;transition:bottom .22s ease;");
      const goal = makeImg("game-img", stage.goal_image_key || "chest_open", "position:absolute;left:50%;top:8px;transform:translateX(-50%);width:72px;height:72px;", "target");
      shaft.appendChild(goal);
      shaft.appendChild(monkey);
      const btn = makeImg("game-img", stage.image_key || "samurai_monkey", "position:relative;cursor:pointer;margin-top:16px;");
      btn.style.width = "108px";
      btn.style.height = "108px";
      const applyPos = () => {
        const progress = Math.max(0, Math.min(1, (value - start) / Math.max(1, end - start)));
        const px = 8 + progress * 150;
        monkey.style.bottom = px + "px";
      };
      applyPos();
      btn.addEventListener("click", () => {
        if(state.stageSolved) return;
        value += step;
        if(value > end) value = end;
        counter.textContent = String(value);
        applyPos();
        if(value >= end) markSuccess(stage);
      });
      wrap.appendChild(counter);
      wrap.appendChild(shaft);
      wrap.appendChild(btn);
      lane.appendChild(wrap);
      return;
    }

    const step = Number(stage.tap_step || 1);
    const start = Number(stage.counter_start != null ? stage.counter_start : 0);
    const goal = Number(stage.counter_goal != null ? stage.counter_goal : stage.target_count || 5);
    let value = start;
    const box = document.createElement("div");
    box.className = "choice-box";
    box.style.top = "28%";
    const q = document.createElement("div");
    q.className = "choice-q";
    q.textContent = stage.question || stage.prompt || ("Tap this item " + goal + " times");
    box.appendChild(q);
    const img = makeImg("game-img", stage.image_key || "shell_blue", "position:relative;cursor:pointer;margin:8px auto 6px;display:block;");
    img.style.width = "138px";
    img.style.height = "138px";
    img.addEventListener("click", () => {
      if(state.stageSolved) return;
      img.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(0.9)" },
          { transform: "scale(1.08)" },
          { transform: "scale(1)" },
        ],
        { duration: 220, easing: "ease-out" }
      );
      value += step;
      if(value > goal) value = goal;
      if(value >= goal) markSuccess(stage);
    });
    box.appendChild(img);
    lane.appendChild(box);
  }

  function renderCorridorChoice(stage){
    const box = document.createElement("div");
    box.className = "choice-box";
    const subText = String(stage.instruction || "").trim();
    if(subText){
      const sub = document.createElement("div");
      sub.className = "choice-sub";
      sub.textContent = subText;
      box.appendChild(sub);
    }
    const q = document.createElement("div");
    q.className = "choice-q";
    q.textContent = stage.question || "Choose a path";
    box.appendChild(q);
    const row = document.createElement("div");
    row.className = "corridor-row";
    const correctSideRaw = String(stage.correct_side || stage.correctSide || "").toLowerCase();
    const left = stage.left_path || { label: stage.left_expression || stage.leftExpression || "Left" };
    const right = stage.right_path || { label: stage.right_expression || stage.rightExpression || "Right" };
    if(left.correct == null && right.correct == null){
      if(correctSideRaw === "left" || correctSideRaw === "l"){
        left.correct = true;
        right.correct = false;
      } else if(correctSideRaw === "right" || correctSideRaw === "r"){
        left.correct = false;
        right.correct = true;
      }
    }
    [
      { path: left, key: "L" },
      { path: right, key: "R" },
    ].forEach(({ path }, i) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn corridor-choice";
      const label = document.createElement("div");
      label.className = "corridor-label";
      label.textContent = path.label || (i === 0 ? "Left" : "Right");
      btn.appendChild(label);
      btn.onclick = () => {
        if(state.stageSolved) return;
        if(path.correct){
          btn.classList.add("ok");
          row.querySelectorAll(".choice-btn").forEach((b) => { b.style.pointerEvents = "none"; });
          setTimeout(() => markSuccess(stage), 140);
        }else{
          btn.classList.add("bad");
          setTimeout(() => btn.classList.remove("bad"), 240);
          shake(btn);
        }
      };
      row.appendChild(btn);
    });
    box.appendChild(row);
    lane.appendChild(box);
  }

  function renderMatchPairs(stage){
    const box = document.createElement("div");
    box.className = "choice-box";
    const q = document.createElement("div");
    q.className = "choice-q";
    q.textContent = stage.question || stage.prompt || "Find two correct pairs";
    box.appendChild(q);

    const row = document.createElement("div");
    row.className = "corridor-row";
    const items = [
      { key: "A", text: stage.pair_a || stage.pairA || "A" },
      { key: "B", text: stage.pair_b || stage.pairB || "B" },
      { key: "C", text: stage.pair_c || stage.pairC || "C" },
      { key: "D", text: stage.pair_d || stage.pairD || "D" },
    ];
    const correct = new Set([
      String(stage.correct_pair_1 || stage.correctPair1 || "").toUpperCase(),
      String(stage.correct_pair_2 || stage.correctPair2 || "").toUpperCase(),
    ].filter(Boolean));
    let found = 0;

    items.forEach((it) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn corridor-choice";
      const label = document.createElement("div");
      label.className = "corridor-label";
      label.textContent = String(it.text);
      btn.appendChild(label);
      btn.onclick = () => {
        if(state.stageSolved || btn.dataset.locked === "1") return;
        if(correct.has(it.key)){
          btn.classList.add("ok");
          btn.dataset.locked = "1";
          btn.style.pointerEvents = "none";
          found += 1;
          if(found >= 2){
            row.querySelectorAll(".choice-btn").forEach((b) => { b.style.pointerEvents = "none"; });
            setTimeout(() => markSuccess(stage), 140);
          }
        }else{
          btn.classList.add("bad");
          setTimeout(() => btn.classList.remove("bad"), 240);
          shake(btn);
        }
      };
      row.appendChild(btn);
    });
    box.appendChild(row);
    lane.appendChild(box);
  }

  function renderBalanceScale(stage){
    const wrap = document.createElement("div");
    wrap.className = "balance-scale-wrap";
    const scale = document.createElement("img");
    scale.className = "balance-scale-img";
    scale.src = "assets/scale_down.png";
    scale.alt = "scale";
    wrap.appendChild(scale);

    const leftText = String(stage.left_expression || stage.leftExpression || stage.balance_left || "7 + ?");
    const rightText = String(stage.right_expression || stage.rightExpression || stage.balance_right || "70");
    const expected = String(stage.answer ?? stage.balance_answer ?? "");
    const base = STAGES[state.stageIndex] || stage;
    const rounds = Array.isArray(base.rounds) ? base.rounds : [];
    const nRounds = rounds.length || 1;

    let solved = false;
    const revealNext = () => {
      if(solved) return;
      solved = true;
      left.style.opacity = "0";
      right.style.opacity = "0";
      left.style.pointerEvents = "none";
      right.style.pointerEvents = "none";
      scale.style.opacity = "0.35";
      setTimeout(() => {
        scale.src = "assets/scale.png";
        scale.style.opacity = "1";
        scale.style.filter = "drop-shadow(0 0 28px rgba(244,208,63,.9)) drop-shadow(0 0 46px rgba(173,216,255,.55))";
        scale.style.transform = "scale(1.04)";
        setTimeout(() => {
          scale.style.transform = "scale(1)";
          scale.style.filter = "drop-shadow(0 14px 24px rgba(0,0,0,.35))";
        }, 320);
      }, 180);
      const nextBtn = document.createElement("button");
      nextBtn.className = "seq-submit show balance-next";
      nextBtn.type = "button";
      nextBtn.textContent = "NEXT";
      nextBtn.onclick = () => {
        if(state.stageSolved) return;
        state.stageSolved = true;
        state.stagePracticeDone += 1;
        if(state.stagePracticeDone < nRounds){
          state.stageSolved = false;
          renderStage(state.stageIndex);
          return;
        }
        const bonus = Number(base.round_bonus_coins != null ? base.round_bonus_coins : 2);
        addCoins(bonus);
        addCoins(Number(base.coins != null ? base.coins : stage.coins) || 0);
        const msg = String(stage.success_message || "").trim()
          ? stage.success_message
          : englishSuccessFallback({ ...stage, type: resolveEngineType(stage.type) });
        showSuccess(msg, () => advanceToNextStage(), "Round " + nRounds + "/" + nRounds + " — stage clear!");
      };
      wrap.appendChild(nextBtn);
    };

    const left = document.createElement("div");
    left.className = "balance-side-text left";
    const leftPill = document.createElement("span");
    leftPill.className = "balance-pill";
    if(leftText.includes("?")){
      const parts = leftText.split("?");
      const inp = document.createElement("input");
      inp.className = "balance-answer-input";
      inp.type = "number";
      inp.inputMode = "numeric";
      inp.autocomplete = "off";
      const evaluate = () => {
        const v = String(inp.value).trim();
        if(v === "") return;
        if(v === expected){
          inp.classList.remove("bad");
          inp.classList.add("ok");
          inp.disabled = true;
          revealNext();
        }else{
          inp.classList.remove("ok");
          inp.classList.add("bad");
          setTimeout(() => inp.classList.remove("bad"), 220);
          shake(inp);
        }
      };
      inp.addEventListener("change", evaluate);
      inp.addEventListener("blur", evaluate);
      leftPill.append(document.createTextNode(parts[0] || ""));
      leftPill.appendChild(inp);
      leftPill.append(document.createTextNode(parts.slice(1).join("?") || ""));
    }else{
      leftPill.textContent = leftText;
    }
    left.appendChild(leftPill);

    const right = document.createElement("div");
    right.className = "balance-side-text right";
    const rightPill = document.createElement("span");
    rightPill.className = "balance-pill";
    rightPill.textContent = rightText;
    right.appendChild(rightPill);

    wrap.appendChild(left);
    wrap.appendChild(right);
    lane.appendChild(wrap);
  }

  function renderBuildNumber(stage){
    const baseNumber = Number(stage.base_number ?? stage.baseNumber ?? 0);
    const rawParts = Number(stage.parts_count ?? stage.partsCount ?? 2);
    const partsCount = Math.max(2, Math.min(5, rawParts || 2));

    const wrap = document.createElement("div");
    wrap.className = "build-wrap";
    const target = document.createElement("div");
    target.className = "build-target";
    target.textContent = String(baseNumber);
    wrap.appendChild(target);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "build-arrow-layer");
    svg.setAttribute("viewBox", "0 0 1000 1000");
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "buildArrowHead");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "10");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "5");
    marker.setAttribute("orient", "auto");
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", "0 0, 10 5, 0 10");
    poly.setAttribute("fill", "#f4d03f");
    marker.appendChild(poly);
    defs.appendChild(marker);
    svg.appendChild(defs);
    wrap.appendChild(svg);

    const slots = document.createElement("div");
    slots.className = "build-slots";
    for(let i = 0; i < partsCount; i++){
      const slot = document.createElement("div");
      slot.className = "build-slot";
      const input = document.createElement("input");
      input.className = "build-slot-input";
      input.type = "number";
      input.inputMode = "numeric";
      input.autocomplete = "off";
      slot.appendChild(input);
      slots.appendChild(slot);
    }
    wrap.appendChild(slots);
    const slotCenters = [];
    for(let i = 0; i < partsCount; i++){
      const x = ((i + 1) * (1000 / (partsCount + 1)));
      slotCenters.push(x);
    }
    slotCenters.forEach((x) => {
      const idx = slotCenters.indexOf(x);
      const spread = partsCount <= 1 ? 0 : ((idx / (partsCount - 1)) - 0.5) * 180;
      const targetX = 500 + spread;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(x));
      line.setAttribute("y1", "690");
      line.setAttribute("x2", String(targetX));
      line.setAttribute("y2", "280");
      line.setAttribute("stroke", "rgba(244,208,63,.9)");
      line.setAttribute("stroke-width", "6");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("marker-end", "url(#buildArrowHead)");
      svg.appendChild(line);
    });

    const next = document.createElement("button");
    next.className = "seq-submit show build-next";
    next.type = "button";
    next.textContent = "✓";
    next.onclick = () => markSuccess(stage);
    wrap.appendChild(next);

    lane.appendChild(wrap);
  }

  function renderTimerChallenge(stage){
    const card = document.createElement("div");
    card.className = "timer-card";
    const secondsTotal = Math.max(1, Number(stage.timer_seconds ?? stage.timerSeconds ?? 30));
    let seconds = secondsTotal;
    let running = false;
    let timerId = null;

    const panel = document.createElement("div");
    panel.className = "timer-panel";
    const leftWrap = document.createElement("div");
    leftWrap.className = "timer-panel-left";
    const timeLabel = document.createElement("div");
    timeLabel.className = "timer-label";
    timeLabel.textContent = "Time left";
    const badge = document.createElement("div");
    badge.className = "timer-badge";
    badge.textContent = String(seconds);
    const startBtn = document.createElement("button");
    startBtn.className = "timer-start";
    startBtn.type = "button";
    startBtn.textContent = "START";
    leftWrap.appendChild(timeLabel);
    leftWrap.appendChild(badge);
    panel.appendChild(leftWrap);
    panel.appendChild(startBtn);

    const rows = [
      { tag: "A", ex: String(stage.timer_example_a ?? stage.timerExampleA ?? "6 + ? = 10"), ans: String(stage.timer_answer_a ?? stage.timerAnswerA ?? "4") },
      { tag: "B", ex: String(stage.timer_example_b ?? stage.timerExampleB ?? "9 - ? = 4"), ans: String(stage.timer_answer_b ?? stage.timerAnswerB ?? "5") },
      { tag: "C", ex: String(stage.timer_example_c ?? stage.timerExampleC ?? "3 × ? = 12"), ans: String(stage.timer_answer_c ?? stage.timerAnswerC ?? "4") },
    ];
    const inputs = [];
    rows.forEach((r) => {
      const row = document.createElement("div");
      row.className = "timer-row";
      const parts = r.ex.split("?");
      row.appendChild(document.createTextNode(r.tag + ": " + (parts[0] || "")));
      const inp = document.createElement("input");
      inp.className = "timer-input";
      inp.type = "number";
      inp.inputMode = "numeric";
      inp.autocomplete = "off";
      inp.disabled = true;
      inp.dataset.answer = r.ans;
      inputs.push(inp);
      row.appendChild(inp);
      row.appendChild(document.createTextNode(parts.slice(1).join("?") || ""));
      card.appendChild(row);
    });

    const stopTimer = () => {
      if(timerId){
        clearInterval(timerId);
        timerId = null;
      }
      running = false;
    };
    const checkDone = () => {
      const ok = inputs.every((i) => String(i.value).trim() === String(i.dataset.answer).trim());
      if(ok){
        stopTimer();
        inputs.forEach((i) => { i.classList.add("ok"); i.disabled = true; });
        setTimeout(() => markSuccess(stage), 140);
      }
    };

    inputs.forEach((inp) => {
      inp.addEventListener("change", () => {
        if(!running) return;
        if(String(inp.value).trim() === String(inp.dataset.answer).trim()){
          inp.classList.remove("bad");
          inp.classList.add("ok");
        }else{
          inp.classList.remove("ok");
          inp.classList.add("bad");
          setTimeout(() => inp.classList.remove("bad"), 220);
        }
        checkDone();
      });
    });

    startBtn.onclick = () => {
      if(running) return;
      running = true;
      seconds = secondsTotal;
      badge.textContent = String(seconds);
      startBtn.style.pointerEvents = "none";
      startBtn.style.opacity = ".65";
      inputs.forEach((i) => { i.disabled = false; i.focus({ preventScroll: true }); });
      timerId = setInterval(() => {
        seconds -= 1;
        badge.textContent = String(Math.max(0, seconds));
        if(seconds <= 0){
          stopTimer();
          inputs.forEach((i) => i.disabled = true);
          startBtn.style.pointerEvents = "auto";
          startBtn.style.opacity = "1";
        }
      }, 1000);
    };

    lane.appendChild(card);
    lane.appendChild(panel);
  }

  function renderSymbolCalc(stage){
    const wrap = document.createElement("div");
    wrap.className = "symbol-wrap";

    const defaultKeys = ["shell_blue", "banana", "stone_blue", "cherry", "mushroom", "pearl_blue"];
    const fallbackA = stage.symbol_item_a || stage.symbolItemA || defaultKeys[0];
    const fallbackB = stage.symbol_item_b || stage.symbolItemB || defaultKeys[1];
    const fallbackC = stage.symbol_item_c || stage.symbolItemC || defaultKeys[2];
    const uniq = [];
    [fallbackA, fallbackB, fallbackC].forEach((k) => {
      if(!uniq.includes(k)) uniq.push(k);
    });
    for(const k of defaultKeys){
      if(uniq.length >= 3) break;
      if(!uniq.includes(k)) uniq.push(k);
    }
    const itemA = uniq[0];
    const itemB = uniq[1];
    const itemC = uniq[2];

    const rows = [
      { key: "A", img: itemA, value: stage.symbol_a ?? stage.symbolA ?? 4 },
      { key: "B", img: itemB, value: stage.symbol_b ?? stage.symbolB ?? 3 },
      { key: "C", img: itemC, value: stage.symbol_c ?? stage.symbolC ?? 2 },
    ];
    rows.forEach((r) => {
      const row = document.createElement("div");
      row.className = "symbol-row";
      const img = makeImg("symbol-item", r.img, "");
      const txt = document.createElement("span");
      txt.textContent = "= " + r.value;
      row.appendChild(img);
      row.appendChild(txt);
      wrap.appendChild(row);
    });

    const card = document.createElement("div");
    card.className = "symbol-calc-card";
    const expr = document.createElement("div");
    expr.className = "symbol-expr";
    const exprRaw = String(stage.symbol_expression || stage.symbolExpression || "A + B × C");
    const symbolMap = { A: itemA, B: itemB, C: itemC };
    exprRaw
      .split(/(\\bA\\b|\\bB\\b|\\bC\\b)/g)
      .filter(Boolean)
      .forEach((part) => {
        const key = part.trim();
        if(symbolMap[key]){
          const img = makeImg("symbol-inline", symbolMap[key], "");
          expr.appendChild(img);
        }else{
          const span = document.createElement("span");
          span.textContent = part;
          expr.appendChild(span);
        }
      });
    const inp = document.createElement("input");
    inp.className = "symbol-answer";
    inp.type = "number";
    inp.inputMode = "numeric";
    inp.autocomplete = "off";
    const expected = String(stage.answer ?? "");
    const evaluate = () => {
      const v = String(inp.value).trim();
      if(v === "") return;
      if(v === expected){
        inp.classList.remove("bad");
        inp.classList.add("ok");
        inp.disabled = true;
        setTimeout(() => markSuccess(stage), 140);
      }else{
        inp.classList.remove("ok");
        inp.classList.add("bad");
        setTimeout(() => inp.classList.remove("bad"), 220);
        shake(inp);
      }
    };
    inp.addEventListener("change", evaluate);
    inp.addEventListener("blur", evaluate);
    card.appendChild(expr);
    card.appendChild(inp);
    wrap.appendChild(card);
    lane.appendChild(wrap);
  }

  function renderFindUnknown(stage){
    const wrap = document.createElement("div");
    wrap.className = "symbol-wrap";

    const defaultKeys = ["shell_blue", "banana", "stone_blue", "cherry", "mushroom", "pearl_blue"];
    const fallbackA = stage.unknown_item_a || stage.unknownItemA || defaultKeys[0];
    const fallbackB = stage.unknown_item_b || stage.unknownItemB || defaultKeys[1];
    const fallbackC = stage.unknown_item_c || stage.unknownItemC || defaultKeys[2];
    const uniq = [];
    [fallbackA, fallbackB, fallbackC].forEach((k) => {
      if(!uniq.includes(k)) uniq.push(k);
    });
    for(const k of defaultKeys){
      if(uniq.length >= 3) break;
      if(!uniq.includes(k)) uniq.push(k);
    }
    const itemA = uniq[0];
    const itemB = uniq[1];
    const itemC = uniq[2];

    const rowA = document.createElement("div");
    rowA.className = "symbol-row";
    rowA.appendChild(makeImg("symbol-item", itemA, ""));
    rowA.appendChild(Object.assign(document.createElement("span"), { textContent: "= " + (stage.unknown_a ?? stage.unknownA ?? 4) }));
    wrap.appendChild(rowA);

    const rowB = document.createElement("div");
    rowB.className = "symbol-row";
    rowB.appendChild(makeImg("symbol-item", itemB, ""));
    rowB.appendChild(Object.assign(document.createElement("span"), { textContent: "= " + (stage.unknown_b ?? stage.unknownB ?? 6) }));
    wrap.appendChild(rowB);

    const rowC = document.createElement("div");
    rowC.className = "symbol-row";
    rowC.appendChild(makeImg("symbol-item", itemC, ""));
    rowC.appendChild(Object.assign(document.createElement("span"), { textContent: "= " }));
    const cInput = document.createElement("input");
    cInput.className = "symbol-answer";
    cInput.style.width = "102px";
    cInput.type = "number";
    cInput.inputMode = "numeric";
    cInput.autocomplete = "off";
    rowC.appendChild(cInput);
    wrap.appendChild(rowC);

    const card = document.createElement("div");
    card.className = "symbol-calc-card";
    const expr = document.createElement("div");
    expr.className = "symbol-expr";
    const exprRaw = String(stage.unknown_equation || stage.unknownEquation || "A + B + C = 15");
    const symbolMap = { A: itemA, B: itemB, C: itemC };
    exprRaw
      .split(/(\\bA\\b|\\bB\\b|\\bC\\b)/g)
      .filter(Boolean)
      .forEach((part) => {
        const key = part.trim();
        if(symbolMap[key]){
          expr.appendChild(makeImg("symbol-inline", symbolMap[key], ""));
        }else{
          const span = document.createElement("span");
          span.textContent = part;
          expr.appendChild(span);
        }
      });
    card.appendChild(expr);
    wrap.appendChild(card);

    const expected = String(stage.answer ?? "");
    const evaluate = () => {
      const v = String(cInput.value).trim();
      if(v === "") return;
      if(v === expected){
        cInput.classList.remove("bad");
        cInput.classList.add("ok");
        cInput.disabled = true;
        setTimeout(() => markSuccess(stage), 140);
      }else{
        cInput.classList.remove("ok");
        cInput.classList.add("bad");
        setTimeout(() => cInput.classList.remove("bad"), 220);
        shake(cInput);
      }
    };
    cInput.addEventListener("change", evaluate);
    cInput.addEventListener("blur", evaluate);

    lane.appendChild(wrap);
  }

  function renderAnimation(stage){
    const layer = document.createElement("div");
    layer.className = "anim-layer";
    const text = document.createElement("div");
    text.className = "anim-text";
    text.textContent = "Final sequence ready...";
    const task = document.createElement("div");
    task.className = "anim-task";
    const counter = document.createElement("div");
    counter.className = "anim-counter";
    const artifactBtn = document.createElement("button");
    artifactBtn.className = "artifact-btn";
    artifactBtn.type = "button";
    artifactBtn.textContent = stage.artifact?.emoji || LESSON.story?.artifact_emoji || "🏆";
    const artifact = document.createElement("div");
    artifact.className = "artifact";
    artifact.textContent = artifactBtn.textContent;
    layer.appendChild(text);
    const inputs = Array.isArray(stage.inputs) ? stage.inputs : [];
    const opTasks = Array.isArray(stage.operator_tasks) ? stage.operator_tasks : [];
    const hasBalance = String(stage.balance_left || "").trim() && String(stage.balance_right || "").trim() && Array.isArray(stage.balance_options);
    const operatorDone = new Set();
    let card = null;
    let opsWrap = null;
    const refreshBossPhase = () => {
      if(!(inputs.length > 0 && opTasks.length > 0 && opsWrap)) return;
      const inputsDone = [...task.querySelectorAll(".answer")].every((n) => n.disabled);
      if(card) card.style.display = inputsDone ? "none" : "block";
      opsWrap.style.display = inputsDone ? "block" : "none";
      counter.textContent = inputsDone
        ? "Step 2/2: choose all correct operators"
        : "Step 1/2: solve reverse division first";
    };
    const maybeFinish = () => {
      const inputsDone = [...task.querySelectorAll(".answer")].every((n) => n.disabled);
      const opsDone = opTasks.length === 0 || operatorDone.size === opTasks.length;
      refreshBossPhase();
      if(inputsDone && opsDone){
        artifact.classList.add("show");
        markSuccess(stage);
      }
    };
    if(hasBalance){
      counter.textContent = "Balance the chain";
      task.appendChild(counter);
      const card = document.createElement("div");
      card.className = "balance-card";
      const row = document.createElement("div");
      row.className = "balance-row";
      const left = document.createElement("div");
      left.className = "balance-side";
      left.textContent = String(stage.balance_left);
      const eq = document.createElement("div");
      eq.className = "balance-eq";
      eq.textContent = "=";
      const right = document.createElement("div");
      right.className = "balance-side";
      const blank = document.createElement("span");
      blank.className = "balance-blank";
      blank.textContent = "?";
      const parts = String(stage.balance_right).split("?");
      right.append(document.createTextNode(parts[0] || ""));
      right.appendChild(blank);
      right.append(document.createTextNode(parts.slice(1).join("?") || ""));
      row.appendChild(left);
      row.appendChild(eq);
      row.appendChild(right);
      card.appendChild(row);

      const rack = document.createElement("div");
      rack.className = "tile-rack";
      const expected = Number(stage.balance_answer);
      const placeValue = (val) => {
        if(state.stageSolved) return;
        blank.textContent = String(val);
        if(Number(val) === expected){
          blank.classList.add("ok");
          [...rack.querySelectorAll(".num-tile")].forEach((n) => n.style.pointerEvents = "none");
          setTimeout(() => markSuccess(stage), 180);
        }else{
          blank.classList.remove("ok");
          blank.classList.add("bad");
          setTimeout(() => blank.classList.remove("bad"), 200);
          blank.textContent = "?";
          shake(blank);
        }
      };
      blank.addEventListener("dragover", (e) => e.preventDefault());
      blank.addEventListener("drop", (e) => {
        e.preventDefault();
        const val = e.dataTransfer?.getData("text/plain");
        placeValue(val);
      });
      (stage.balance_options || []).forEach((num) => {
        const tile = document.createElement("div");
        tile.className = "num-tile";
        tile.textContent = String(num);
        tile.draggable = true;
        tile.addEventListener("dragstart", (e) => {
          if(e.dataTransfer) e.dataTransfer.setData("text/plain", String(num));
        });
        tile.addEventListener("click", () => placeValue(num));
        rack.appendChild(tile);
      });
      card.appendChild(rack);
      const hint = document.createElement("div");
      hint.className = "balance-hint";
      hint.textContent = "Drag one number tile to the gap";
      card.appendChild(hint);
      task.appendChild(card);
      layer.appendChild(task);
      lane.appendChild(layer);
      return;
    }
    if(inputs.length > 0 || opTasks.length > 0){
      counter.textContent = "Solve all to unlock artifact";
      task.appendChild(counter);
      if(inputs.length > 0){
        card = document.createElement("div");
        card.className = "eq-card";
        card.style.maxWidth = "560px";
        card.style.pointerEvents = "auto";
        const head = document.createElement("div");
        head.className = "eq-head";
        head.textContent = "⚔️";
        card.appendChild(head);
        inputs.forEach((entry) => {
          const line = document.createElement("div");
          line.className = "eq-line";
          line.textContent = String(entry.prompt || "Solve");
          const input = document.createElement("input");
          input.className = "answer eq-input boss-answer";
          input.type = "number";
          input.inputMode = "numeric";
          input.autocomplete = "off";
          input.addEventListener("keydown", (e) => {
            if(e.key === "Enter") input.blur();
          });
          input.onchange = () => {
            const ok = Number(input.value) === Number(entry.answer);
            if(ok){
              input.classList.add("ok");
              input.disabled = true;
              maybeFinish();
            }else{
              input.value = "";
              input.classList.add("bad");
              setTimeout(() => input.classList.remove("bad"), 200);
              shake(input);
            }
          };
          card.appendChild(line);
          card.appendChild(input);
        });
        task.appendChild(card);
      }
      if(opTasks.length > 0){
        opsWrap = document.createElement("div");
        opsWrap.className = "op-card";
        opTasks.forEach((row, idx) => {
          const line = document.createElement("div");
          line.className = "op-line";
          const expr = document.createElement("div");
          expr.textContent = row.expression || "?";
          const btns = document.createElement("div");
          btns.className = "op-buttons";
          ["+", "-", "×", "÷"].forEach((sign) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "op-btn";
            b.textContent = sign;
            b.onclick = () => {
              if(operatorDone.has(idx) || state.stageSolved) return;
              if(sign === row.answer){
                operatorDone.add(idx);
                b.classList.add("ok");
                [...btns.querySelectorAll(".op-btn")].forEach((n) => n.disabled = true);
                maybeFinish();
              }else{
                shake(b);
              }
            };
            btns.appendChild(b);
          });
          line.appendChild(expr);
          line.appendChild(btns);
          opsWrap.appendChild(line);
        });
        task.appendChild(opsWrap);
        refreshBossPhase();
      }
      if(inputs.length > 0 && opTasks.length === 0){
        counter.textContent = "Solve all reverse division examples";
      }
    }else{
      const tapsNeed = Number(stage.target_count || (2 + Number(stage.round || 1)));
      let taps = 0;
      counter.textContent = taps + " / " + tapsNeed;
      task.appendChild(counter);
      task.appendChild(artifactBtn);
      artifactBtn.onclick = () => {
        if(state.stageSolved) return;
        taps += 1;
        counter.textContent = taps + " / " + tapsNeed;
        artifactBtn.style.transform = "scale(1.08)";
        setTimeout(() => {
          artifactBtn.style.transform = "";
        }, 110);
        if(taps >= tapsNeed){
          artifact.classList.add("show");
          markSuccess(stage);
        }
      };
    }
    layer.appendChild(task);
    layer.appendChild(artifact);
    lane.appendChild(layer);

    // No auto-celebration sequence on stage open for boss rounds.
  }

  function renderStage(index){
    clearStage();
    const baseStage = STAGES[index];
    if(!baseStage) return;
    warmupStageAssets(index);
    const stage = resolveCurrentTask(baseStage);

    const engType = resolveEngineType(stage.type);
    const engStage = { ...stage, type: engType };
    const playerSide = $("playerSide");
    if(playerSide){
      playerSide.classList.toggle("stage-boss-hidden", index === STAGES.length - 1);
    }
    const instruction = stage.title || stage.question || LESSON.story_hook || "";
    const cleanInstruction = String(instruction).trim() ? instruction : englishStageFallback(engStage);
    if(stage.hide_instruction_label){
      $("instruction").textContent = "(" + (state.stagePracticeDone + 1) + "/" + state.stagePracticeTarget + ")";
    }else{
      $("instruction").textContent = cleanInstruction + "  (" + (state.stagePracticeDone + 1) + "/" + state.stagePracticeTarget + ")";
    }
    $("bg").fetchPriority = "high";
    $("bg").decoding = "async";
    setStageBackgroundImg($("bg"), resolveStageBackground(baseStage, index));
    setMessage("");
    if(engType === "drag_drop") renderDragDrop(stage);
    else if(engType === "drag_sort") renderDragSort(stage);
    else if(engType === "drag_group") renderDragGroup(stage);
    else if(engType === "match_pairs") renderMatchPairs(stage);
    else if(engType === "balance_scale") renderBalanceScale(stage);
    else if(engType === "build_number") renderBuildNumber(stage);
    else if(engType === "timer_challenge") renderTimerChallenge(stage);
    else if(engType === "symbol_calc") renderSymbolCalc(stage);
    else if(engType === "find_unknown") renderFindUnknown(stage);
    else if(engType === "input") renderInput(stage);
    else if(engType === "choice") renderChoice(stage);
    else if(engType === "tap_count") renderTapCount(stage);
    else if(engType === "corridor_choice") renderCorridorChoice(stage);
    else if(engType === "animation") renderAnimation(stage);
    else {
      setMessage("Unknown stage type: " + stage.type);
    }
    updateStageControls();
  }

  /** When meta.island_key is set, backgrounds are always PREFIX+1, PREFIX+2, "2", "3", PREFIX+3, PREFIX+4 (same as tutor server). */
  function islandPackBackgroundForIndex(islandKey, index){
    const prefix = String(islandKey || "").trim().replace(/\\s+/g, "_");
    if (!prefix) return "";
    const sn = index + 1;
    if (sn === 1) return prefix + "1";
    if (sn === 2) return prefix + "2";
    if (sn === 3) return "2";
    if (sn === 4) return "3";
    if (sn === 5) return prefix + "3";
    if (sn === 6) return prefix + "4";
    return "";
  }

  function resolveStageBackground(stage, index){
    const metaIsland = String(LESSON.meta?.island_key || LESSON.meta?.islandKey || "").trim();
    const fromIslandMeta = islandPackBackgroundForIndex(metaIsland, index);
    if (fromIslandMeta) return fromIslandMeta;
    const fromLesson = String(stage?.background || "").trim();
    if (fromLesson) return fromLesson;
    return (index === 2) ? "2" : (index === 3 ? "3" : "");
  }

  function setupPlayerAvatar(){
    const tag = $("pTag");
    const emoji = $("pEmoji");
    const img = $("pImg");
    const charKey = LESSON.meta?.character_key || LESSON.character?.image_key || Object.keys(CHARACTER_MAP)[0] || "";
    tag.textContent = LESSON.meta?.student_name || "Hero";
    emoji.textContent = LESSON.character?.emoji || "🧍";

    if(!charKey){
      img.style.display = "none";
      emoji.style.display = "block";
      return;
    }
    img.src = characterPath(charKey);
    img.onerror = () => {
      img.style.display = "none";
      emoji.style.display = "block";
    };
    img.onload = () => {
      img.style.display = "block";
      emoji.style.display = "none";
    };
  }

  function finishLesson(){
    clearStage();
    const stage6 = STAGES[5] || {};
    const artifactFromJson = stage6.artifact || {};
    let key = String(artifactFromJson.key || "").trim();
    const allArtifactKeys = Object.keys(ARTIFACT_MAP);
    if(!key && allArtifactKeys.length > 0){
      key = allArtifactKeys[Math.floor(Math.random() * allArtifactKeys.length)];
    }
    const reward = {
      key,
      image: artifactPathByKey(key),
      emoji: LESSON.story?.artifact_emoji || artifactFromJson.emoji || "🏆",
      name: LESSON.story?.artifact_name || titleFromKey(key) || artifactFromJson.name,
      description:
        LESSON.story?.artifact_power ||
        artifactFromJson.description ||
        "A magical reward for your adventure.",
    };
    state.completionArtifact = reward;
    state.earnedArtifacts.push(reward);
    showSuccess("The final challenge is complete!", () => {
      openShopScreen();
    }, "AMAZING! Your reward is ready.", "Go to shop");
  }

  function showEndingStoryScreen(){
    const stage6 = STAGES[5] || {};
    const text = String(
      stage6.post_story_text ||
      "The Monkey King is free! The King thanks you and gives you his Crown. But Doctor Krit is still out there — and the next island will be even more dangerous. Well done, hero!"
    );
    $("storyText").textContent = text;
    $("successScreen").classList.remove("on");
    $("stageBackBtn").classList.add("hidden");
    $("stageSkipBtn").classList.add("hidden");
    $("instruction").classList.add("hidden");
    $("coinsLabel").parentElement.classList.add("hidden");
    $("game").style.pointerEvents = "none";
    $("storyScreen").classList.add("on");
  }

  function renderShop(){
    const grid = $("shopGrid");
    grid.innerHTML = "";
    $("shopCoins").textContent = String(state.totalCoins);
    SHOP_ITEMS.forEach((it) => {
      const owned = state.earnedArtifacts.some((a) => a && a.key === it.id);
      const card = document.createElement("div");
      card.className = "shop-item";
      const img = document.createElement("img");
      img.src = it.img;
      img.alt = it.name;
      img.onerror = () => {
        const fallback = artifactPathByKey(it.id);
        if(fallback && fallback !== it.img){
          img.src = fallback;
        } else {
          img.style.display = "none";
        }
      };
      const name = document.createElement("div");
      name.className = "shop-name";
      name.textContent = it.name;
      const price = document.createElement("div");
      price.className = "shop-price";
      price.textContent = "🪙 " + it.price;
      const btn = document.createElement("button");
      btn.className = "shop-buy";
      const canBuy = state.totalCoins >= it.price && !owned;
      btn.textContent = owned ? "Owned" : "Buy";
      btn.disabled = !canBuy && !owned;
      btn.onclick = () => {
        if(state.totalCoins < it.price || owned) return;
        state.totalCoins -= it.price;
        state.earnedArtifacts.push({ key: it.id, name: it.name, image: it.img, description: "" });
        $("coinsLabel").textContent = String(state.totalCoins);
        renderShop();
      };
      card.append(img, name, price, btn);
      grid.appendChild(card);
    });
  }

  function openShopScreen(){
    $("storyScreen").classList.remove("on");
    showCompletionScreen();
    renderShop();
    $("completionScreen").classList.remove("on");
    $("shopBg").src = backgroundPath("shop");
    $("shopScreen").classList.add("on");
  }

  function renderCompletionInventory(){
    const row = $("completionInventory");
    row.innerHTML = "";
    const items = state.earnedArtifacts.slice(-12);
    for(const art of items){
      const wrap = document.createElement("div");
      wrap.className = "inventory-icon";
      if(art.image){
        const img = document.createElement("img");
        img.src = art.image;
        img.alt = art.name || art.key || "artifact";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        img.onerror = () => {
          wrap.textContent = art.emoji || "🏆";
          wrap.style.display = "flex";
          wrap.style.alignItems = "center";
          wrap.style.justifyContent = "center";
          wrap.style.fontSize = "28px";
        };
        wrap.appendChild(img);
      } else {
        wrap.textContent = art.emoji || "🏆";
        wrap.style.display = "flex";
        wrap.style.alignItems = "center";
        wrap.style.justifyContent = "center";
        wrap.style.fontSize = "28px";
      }
      row.appendChild(wrap);
    }
    if(items.length === 0) row.textContent = "—";
  }

  function showCompletionScreen(){
    ensureRingIceInventory();
    const art = state.completionArtifact || {};
    const charKey = LESSON.meta?.character_key || LESSON.character?.image_key || Object.keys(CHARACTER_MAP)[0] || "";
    const avatar = $("completionAvatar");
    avatar.src = characterPath(charKey);
    avatar.onerror = () => { avatar.style.display = "none"; };
    avatar.onload = () => { avatar.style.display = "block"; };

    $("completionName").textContent = LESSON.meta?.student_name || "Hero";
    const startLevel = Number(LESSON.meta?.student_level ?? 0);
    $("completionLevel").textContent = "Level " + (startLevel + 1);
    $("completionCoins").textContent = "🪙 " + state.totalCoins + " coins remaining";
    $("completionBg").decoding = "async";
    setStageBackgroundImg($("completionBg"), resolveStageBackground(STAGES[0] || {}, 0));
    $("completionArtifactName").textContent = art.name || "Mystery Artifact";
    $("completionArtifactDesc").textContent = art.description || "A magical reward for your journey.";

    const artImg = $("completionArtifactImg");
    const artFallback = $("completionArtifactFallback");
    artFallback.textContent = art.emoji || "🏆";
    if(art.image){
      artImg.src = art.image;
      artImg.classList.remove("hidden");
      artFallback.classList.add("hidden");
      artImg.onerror = () => {
        artImg.classList.add("hidden");
        artFallback.classList.remove("hidden");
      };
    } else {
      artImg.classList.add("hidden");
      artFallback.classList.remove("hidden");
    }
    renderCompletionInventory();

    $("successScreen").classList.remove("on");
    $("stageBackBtn").classList.add("hidden");
    $("stageSkipBtn").classList.add("hidden");
    $("instruction").classList.add("hidden");
    $("coinsLabel").parentElement.classList.add("hidden");
    $("game").style.pointerEvents = "none";
    $("completionScreen").classList.add("on");
    confetti(120);
  }

  function showSuccess(msg, cb, learnText, buttonLabel){
    state.successCb = cb;
    $("successMsg").textContent = msg || "Well done!";
    $("successLearn").textContent = learnText || "Great progress today!";
    $("successNextBtn").textContent = buttonLabel || "Next →";
    $("successScreen").classList.add("on");
    confetti();
  }

  function nextStep(){
    $("successScreen").classList.remove("on");
    if(state.successCb){
      const cb = state.successCb;
      state.successCb = null;
      cb();
    }
  }

  function confetti(count = 80){
    const pool = ["🎉", "✨", "🪙", "⭐", "🌈"];
    for(let i = 0; i < count; i++){
      const p = document.createElement("div");
      p.className = "conf";
      p.textContent = pool[Math.floor(Math.random() * pool.length)];
      p.style.left = (Math.random() * 100) + "vw";
      p.style.top = "-20px";
      p.style.setProperty("--d", (1.1 + Math.random() * 1.8) + "s");
      p.style.fontSize = (14 + Math.random() * 22) + "px";
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 3200);
    }
  }

  function enablePointerDrag(el, onDrop){
    let dragging = false;
    let dx = 0, dy = 0;
    el.addEventListener("pointerdown", (e) => {
      if(state.stageSolved) return;
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.style.zIndex = "50";
      const r = el.getBoundingClientRect();
      dx = e.clientX - r.left;
      dy = e.clientY - r.top;
      el.style.transform = "translate(0,0)";
    });
    el.addEventListener("pointermove", (e) => {
      if(!dragging) return;
      const parent = el.parentElement || izone;
      const area = parent.getBoundingClientRect();
      const x = e.clientX - area.left - dx;
      const y = e.clientY - area.top - dy;
      el.style.left = x + "px";
      el.style.top = y + "px";
    });
    el.addEventListener("pointerup", (e) => {
      if(!dragging) return;
      dragging = false;
      onDrop(e.clientX, e.clientY);
    });
  }

  $("successNextBtn").addEventListener("click", nextStep);
  $("completionPlayAgainBtn").addEventListener("click", () => location.reload());
  $("storyShopBtn").addEventListener("click", openShopScreen);
  $("shopFinishBtn").addEventListener("click", () => {
    $("shopScreen").classList.remove("on");
    showCompletionScreen();
    syncLessonProgressToServer();
  });
  $("completionBackBtn").addEventListener("click", () => {
    $("completionScreen").classList.remove("on");
    $("game").style.pointerEvents = "";
    $("stageBackBtn").classList.remove("hidden");
    $("stageSkipBtn").classList.remove("hidden");
    $("instruction").classList.remove("hidden");
    $("coinsLabel").parentElement.classList.remove("hidden");
    showIntroScreen();
    state.stageIndex = 0;
    state.stagePracticeDone = 0;
  });
  $("stageBackBtn").addEventListener("click", () => {
    if($("introScreen").classList.contains("hidden") === false) return;
    if(state.stageIndex > 0){
      state.stageIndex -= 1;
      state.stagePracticeDone = 0;
      renderStage(state.stageIndex);
      return;
    }
    showIntroScreen();
  });
  $("stageSkipBtn").addEventListener("click", () => {
    state.stagePracticeDone = state.stagePracticeTarget;
    advanceToNextStage();
  });
  $("introStartBtn").addEventListener("click", () => {
    $("introScreen").classList.add("hidden");
    state.stageIndex = 0;
    state.stagePracticeDone = 0;
    renderStage(0);
  });
  function idxFromOption(options, target){
    return Math.max(0, (options || []).indexOf(target));
  }

  function buildIntroNarrative(lesson){
    const s = lesson.story;
    if(s && (s.act1 || s.act2 || s.act3)){
      return [s.act1, s.act2, s.act3].filter(Boolean).join(" ");
    }
    return lesson.story_hook || "";
  }

  const introState = {
    text: "",
    idx: 0,
    timer: null,
    speedMs: 18
  };

  function stopIntroTyping(){
    if(introState.timer){
      clearTimeout(introState.timer);
      introState.timer = null;
    }
  }

  function renderIntroTyped(done){
    const body = introState.text.slice(0, introState.idx);
    $("introStory").innerHTML = "";
    $("introStory").append(document.createTextNode(body));
    if(!done){
      const cur = document.createElement("span");
      cur.className = "intro-cur";
      $("introStory").append(cur);
    }
  }

  function typeIntroStep(){
    if(introState.idx >= introState.text.length){
      renderIntroTyped(true);
      $("introStartBtn").classList.add("show");
      stopIntroTyping();
      return;
    }
    introState.idx += 1;
    renderIntroTyped(false);
    introState.timer = setTimeout(typeIntroStep, introState.speedMs);
  }

  function playIntroTyping(text){
    stopIntroTyping();
    introState.text = text || "";
    introState.idx = 0;
    $("introStartBtn").classList.remove("show");
    renderIntroTyped(false);
    typeIntroStep();
  }

  function showIntroScreen(){
    $("introScreen").classList.remove("hidden");
    playIntroTyping(buildIntroNarrative(LESSON) || "A new mystery is waiting on the island.");
  }

  setupPlayerAvatar();
  $("coinsLabel").textContent = String(state.totalCoins);
  $("introBg").decoding = "async";
  setStageBackgroundImg($("introBg"), resolveStageBackground(STAGES[0] || {}, 0));
  showIntroScreen();
  </script>
</body>
</html>`;
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg) {
    usage();
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  const outputPath = path.resolve(process.cwd(), outputArg || "game.html");

  const rawText = await fs.readFile(inputPath, "utf-8");
  const json = JSON.parse(rawText);
  const lesson = sanitizeLesson(json);
  const ik = String(lesson.meta?.island_key || "")
    .trim()
    .replace(/\s+/g, "_");
  if (!CANONICAL_ISLAND_KEYS.includes(ik)) {
    throw new Error(
      `Lesson JSON needs meta.island_key as one of the eight tutor islands (got: ${JSON.stringify(lesson.meta?.island_key)})`,
    );
  }
  lesson.meta = lesson.meta || {};
  lesson.meta.island_key = ik;
  applyIslandLessonCanon(lesson, {
    child: { name: lesson.meta?.student_name },
    context: { islandKey: ik },
  });
  const backgroundMap = await buildBackgroundMap(process.cwd());
  const characterMap = await buildCharacterMap(process.cwd());
  const itemsMap = await buildItemsMap(process.cwd());
  const targetsMap = await buildTargetsMap(process.cwd());
  const artifactsMap = await buildArtifactsMap(process.cwd());
  const html = buildHtml(lesson, backgroundMap, characterMap, itemsMap, targetsMap, artifactsMap);

  await fs.writeFile(outputPath, html, "utf-8");
  console.log("Generated:", outputPath);
  console.log("Stages:", lesson.stages.length);
  console.log("Backgrounds found:", Object.keys(backgroundMap).length);
  console.log("Characters found:", Object.keys(characterMap).length);
  console.log("Items found:", Object.keys(itemsMap).length);
  console.log("Targets found:", Object.keys(targetsMap).length);
  console.log("Artifacts found:", Object.keys(artifactsMap).length);
}

main().catch((err) => {
  console.error("Builder failed:", err.message);
  process.exit(1);
});
