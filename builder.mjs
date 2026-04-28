import fs from "fs/promises";
import path from "path";

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
      const key = path.basename(entry.name, ext);
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
      const key = path.basename(entry.name, ext);
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
      const key = path.basename(entry.name, ext);
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
      const key = path.basename(entry.name, ext);
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
      const key = path.basename(entry.name, ext);
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
    .choice-box{
      position:absolute;
      left:4%;
      width:92%;
      top:12%;
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
      align-items:flex-end;
      justify-content:center;
      background:#101522;
    }
    .intro-screen.hidden{display:none}
    .intro-bg{
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      object-fit:cover;
    }
    .intro-panel{
      position:relative;
      z-index:2;
      width:100%;
      padding:18px 60px 24px;
      text-align:center;
      background:rgba(5,15,30,.88);
      border-top:2px solid rgba(244,208,63,.45);
    }
    .intro-story{
      font-size:clamp(14px,1.6vw,19px);
      color:#c8e8c8;
      line-height:1.6;
      max-width:1200px;
      margin:0 auto 12px;
    }
    .intro-start{
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
  </style>
</head>
<body>
  <div class="intro-screen" id="introScreen">
    <img class="intro-bg" id="introBg" alt="">
    <div class="intro-panel">
      <div class="intro-story" id="introStory"></div>
      <button class="intro-start" id="introStartBtn">BEGIN ADVENTURE</button>
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
    <div class="player-side">
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
      <button class="completion-reload" id="completionReloadBtn">🔄 Play Again</button>
    </div>
  </div>

  <script>
  const LESSON = ${payload};
  const BACKGROUND_MAP = ${bgPayload};
  const CHARACTER_MAP = ${charPayload};
  const ITEMS_MAP = ${itemsPayload};
  const TARGETS_MAP = ${targetsPayload};
  const ARTIFACT_MAP = ${artifactsPayload};

  const $ = (id) => document.getElementById(id);
  const izone = $("izone");
  const PRACTICE_TARGET = 5;
  let lane = null;
  const state = {
    stageIndex: 0,
    stagePracticeDone: 0,
    stagePracticeTarget: PRACTICE_TARGET,
    totalCoins: 0,
    stageSolved: false,
    selectedSortId: null,
    drag: null,
    zoneCounts: {},
    animationTimers: [],
    successCb: null,
    sortBadges: {},
    earnedArtifacts: [],
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

  function imagePathByKey(key, kind = "item"){
    if(!key) return "";
    if(kind === "target"){
      const target = fuzzyFindPath(TARGETS_MAP, key);
      if(target) return target;
      return "assets/targets/" + key + ".png";
    }
    const item = fuzzyFindPath(ITEMS_MAP, key);
    if(item) return item;
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
    if(!bgKey) return "";
    const mapped = fuzzyFindPath(BACKGROUND_MAP, bgKey);
    if(mapped) return mapped;
    if(bgKey === "stage1_generated"){
      const stageFallback = fuzzyFindPath(BACKGROUND_MAP, "2");
      if(stageFallback) return stageFallback;
    }
    if(bgKey === "stage6_generated"){
      const stageFallback = fuzzyFindPath(BACKGROUND_MAP, "5");
      if(stageFallback) return stageFallback;
    }
    return "assets/backgrounds/" + bgKey + ".webp";
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

  function titleFromKey(key){
    return String(key || "Mystery Artifact")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function posStyle(x, y){
    return "left:" + mapXToRightLane(x) + "%;top:" + Number(y || 0) + "%;transform:translate(-50%,-50%);";
  }

  function setMessage(_text){}

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
      "inputs", "question", "options", "items", "correct_order", "target_count", "image_key",
      "left_path", "right_path", "sequence", "round", "operator_tasks"
    ];
    for(const k of pass){
      if(round[k] !== undefined) out[k] = round[k];
    }
    if(round.type) out.type = round.type;
    if(round.coins != null) out.coins = round.coins;
    if(round.success_message) out.success_message = round.success_message;
    if(round.title) out.title = round.title;
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
    overlay.innerHTML = '<div class="round-pop-inner"><span class="round-check">✓</span><span class="round-plus">+2 🪙</span></div>';
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
        addCoins(bonus);
        showRoundSuccess(() => {
          state.stageSolved = false;
          renderStage(state.stageIndex);
        });
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
        "target"
      );
      zoneWrap.appendChild(img);
      lane.appendChild(zoneWrap);
      state.zoneCounts[z.id] = Number(prefill[z.id] ?? 0);
      zoneById[z.id] = zoneWrap;
      const need = Number(required[z.id] ?? 0);
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
    const rowY = useTwoRows ? [72, 86] : [80];

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
      slot.innerHTML = "<div class='sort-slot-line'></div><div class='sort-slot-label'>#" + (i + 1) + "</div>";
      slot.onclick = () => onSortSlotClick(stage, slot);
      slots.push(slot);
      lane.appendChild(slot);
    }

    const items = stage.items || [];
    const itemSpots = buildScatterPositions(items.length, {
      xMin: 10, xMax: 90, yMin: 10, yMax: useTwoRows ? 40 : 46, minDistance: 19,
    });

    items.forEach((item, i) => {
      const spot = itemSpots[i];
      const el = makeImg("game-img sort-item", item.image_key, posStyle(spot.x, spot.y));
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
    const shelfY = slot.offsetTop + 26;
    itemEl.style.cssText += "left:" + (slot.offsetLeft + slot.offsetWidth/2) + "px;top:" + shelfY + "px;transform:translate(-50%,-100%) scale(.88);";
    const badge = state.sortBadges[state.selectedSortId];
    if(badge){
      badge.style.left = (slot.offsetLeft + slot.offsetWidth / 2) + "px";
      badge.style.top = (slot.offsetTop - 8) + "px";
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
    const sub = document.createElement("div");
    sub.className = "choice-sub";
    sub.textContent = stage.instruction || "Read the story and choose one correct equation.";
    box.appendChild(sub);
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
        if(opt.correct){
          btn.classList.add("ok");
          markSuccess(stage);
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
    const target = Number(stage.target_count || 5);
    let count = 0;
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:absolute;left:50%;top:38%;transform:translateX(-50%);text-align:center;z-index:12;";
    const counter = document.createElement("div");
    counter.textContent = "0 / " + target;
    counter.style.cssText = "font-size:32px;font-weight:900;margin-bottom:12px;color:var(--sand);";
    const img = makeImg("game-img", stage.image_key || "banana", "position:relative;cursor:pointer;");
    img.style.width = "128px";
    img.style.height = "128px";
    img.addEventListener("click", () => {
      if(state.stageSolved) return;
      count += 1;
      counter.textContent = count + " / " + target;
      if(count >= target) markSuccess(stage);
    });
    wrap.appendChild(counter);
    wrap.appendChild(img);
    lane.appendChild(wrap);
  }

  function renderCorridorChoice(stage){
    const box = document.createElement("div");
    box.className = "choice-box";
    const sub = document.createElement("div");
    sub.className = "choice-sub";
    sub.textContent = stage.instruction || "Read both options and tap the one that matches division.";
    box.appendChild(sub);
    const q = document.createElement("div");
    q.className = "choice-q";
    q.textContent = stage.question || "Choose a path";
    box.appendChild(q);
    const row = document.createElement("div");
    row.className = "corridor-row";
    const left = stage.left_path || {};
    const right = stage.right_path || {};
    const emojiFor = (lbl) => {
      const t = String(lbl || "").toLowerCase();
      if(t.includes("basket") || t.includes("bag") || t.includes("crate")) return "🧺";
      if(t.includes("banana")) return "🍌";
      if(t.includes("apple")) return "🍎";
      if(t.includes("cookie")) return "🍪";
      if(t.includes("sticker")) return "⭐";
      if(t.includes("wrong")) return "❌";
      return "🧩";
    };

    const makeCorridorIcon = (pathObj) => {
      const imageKey = pathObj.image_key;
      const imageKind = pathObj.image_kind === "target" ? "target" : "item";
      if(imageKey){
        const img = document.createElement("img");
        img.className = "corridor-icon";
        img.src = imagePathByKey(imageKey, imageKind);
        img.alt = imageKey;
        img.onerror = () => {
          img.replaceWith(Object.assign(document.createElement("div"), {
            className: "corridor-emoji",
            textContent: emojiFor(pathObj.label),
          }));
        };
        return img;
      }
      const em = document.createElement("div");
      em.className = "corridor-emoji";
      em.textContent = emojiFor(pathObj.label);
      return em;
    };

    [
      { path: left, key: "L" },
      { path: right, key: "R" },
    ].forEach(({ path }, i) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn corridor-choice";
      const icon = makeCorridorIcon(path);
      const label = document.createElement("div");
      label.className = "corridor-label";
      label.textContent = path.label || (i === 0 ? "Left" : "Right");
      btn.appendChild(icon);
      btn.appendChild(label);
      btn.onclick = () => {
        if(state.stageSolved) return;
        if(path.correct){
          btn.classList.add("ok");
          markSuccess(stage);
        }else{
          shake(btn);
        }
      };
      row.appendChild(btn);
    });
    box.appendChild(row);
    const hint = document.createElement("div");
    hint.className = "choice-hint";
    hint.textContent = "Tap one path";
    box.appendChild(hint);
    lane.appendChild(box);
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
    const stage = resolveCurrentTask(baseStage);

    const engType = resolveEngineType(stage.type);
    const engStage = { ...stage, type: engType };
    const instruction = stage.instruction || stage.question || LESSON.story_hook || "";
    const cleanInstruction = String(instruction).trim() ? instruction : englishStageFallback(engStage);
    $("instruction").textContent = cleanInstruction + "  (" + (state.stagePracticeDone + 1) + "/" + state.stagePracticeTarget + ")";
    $("bg").src = backgroundPath(resolveStageBackground(stage, index));
    $("bg").onerror = () => {
      $("bg").src = "";
      $("game").style.background = "radial-gradient(circle at 20% 20%, #204a66, #0b1426)";
    };
    setMessage("");
    if(engType === "drag_drop") renderDragDrop(stage);
    else if(engType === "drag_sort") renderDragSort(stage);
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

  function resolveStageBackground(stage, index){
    if(index === 0) return "stage1_generated";
    if(index === 1) return "2";
    if(index === 2) return "3";
    if(index === 3) return "4";
    if(index === 4) return "5";
    if(index === 5) return "stage6_generated";
    return stage.background || "stage1_generated";
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
      emoji: artifactFromJson.emoji || LESSON.story?.artifact_emoji || "🏆",
      name: artifactFromJson.name || LESSON.story?.artifact_name || titleFromKey(key),
      description: artifactFromJson.description || "A magical reward for your adventure.",
    };
    state.completionArtifact = reward;
    state.earnedArtifacts.push(reward);
    showCompletionScreen();
  }

  function renderCompletionInventory(){
    const row = $("completionInventory");
    row.innerHTML = "";
    const items = state.earnedArtifacts.slice(-12);
    for(const art of items){
      const img = document.createElement("img");
      img.className = "inventory-icon";
      img.src = art.image;
      img.alt = art.name || art.key || "artifact";
      img.onerror = () => img.remove();
      row.appendChild(img);
    }
    if(items.length === 0) row.textContent = "—";
  }

  function showCompletionScreen(){
    const art = state.completionArtifact || {};
    const charKey = LESSON.meta?.character_key || LESSON.character?.image_key || Object.keys(CHARACTER_MAP)[0] || "";
    const avatar = $("completionAvatar");
    avatar.src = characterPath(charKey);
    avatar.onerror = () => { avatar.style.display = "none"; };
    avatar.onload = () => { avatar.style.display = "block"; };

    $("completionName").textContent = LESSON.meta?.student_name || "Hero";
    $("completionLevel").textContent = "Level " + Math.max(1, Number(LESSON.meta?.lesson_number || 1) + 1);
    $("completionCoins").textContent = "🪙 " + state.totalCoins + " coins earned!";
    $("completionBg").src = backgroundPath("stage1_generated");
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

  function showSuccess(msg, cb, learnText){
    state.successCb = cb;
    $("successMsg").textContent = msg || "Well done!";
    $("successLearn").textContent = learnText || "Great progress today!";
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
  $("completionReloadBtn").addEventListener("click", () => location.reload());
  $("completionBackBtn").addEventListener("click", () => {
    $("completionScreen").classList.remove("on");
    $("game").style.pointerEvents = "";
    $("stageBackBtn").classList.remove("hidden");
    $("stageSkipBtn").classList.remove("hidden");
    $("instruction").classList.remove("hidden");
    $("coinsLabel").parentElement.classList.remove("hidden");
    $("introScreen").classList.remove("hidden");
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
    $("introScreen").classList.remove("hidden");
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

  setupPlayerAvatar();
  $("introBg").src = backgroundPath("second");
  $("introStory").textContent = buildIntroNarrative(LESSON) || "A new mystery is waiting on the island.";
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
