/**
 * Single source of truth: 8 islands × fixed 6-step background keys + canon story (English).
 * Used by tutor_server (after Claude) and builder (embedding into HTML) so gameplay never
 * depends on model-invented story/background tokens.
 */

export const ISLAND_STAGE_BG_KEYS = {
  cherry_blossom_island: {
    1: "cherry_blossom_island1",
    2: "cherry_blossom_island2",
    3: "2",
    4: "3",
    5: "cherry_blossom_island3",
    6: "cherry_blossom_island4",
  },
  jelly_bay_island: {
    1: "jelly_bay_island1",
    2: "jelly_bay_island2",
    3: "2",
    4: "3",
    5: "jelly_bay_island3",
    6: "jelly_bay_island4",
  },
  snowy_peaks_island: {
    1: "snowy_peaks_island1",
    2: "snowy_peaks_island2",
    3: "2",
    4: "3",
    5: "snowy_peaks_island3",
    6: "snowy_peaks_island4",
  },
  neon_city_island: {
    1: "neon_city_island1",
    2: "neon_city_island2",
    3: "2",
    4: "3",
    5: "neon_city_island3",
    6: "neon_city_island4",
  },
  blue_crab_island: {
    1: "blue_crab_island1",
    2: "blue_crab_island2",
    3: "2",
    4: "3",
    5: "blue_crab_island3",
    6: "blue_crab_island4",
  },
  antigravity_island: {
    1: "antigravity_island1",
    2: "antigravity_island2",
    3: "2",
    4: "3",
    5: "antigravity_island3",
    6: "antigravity_island4",
  },
  mushroom_island: {
    1: "mushroom_island1",
    2: "mushroom_island2",
    3: "2",
    4: "3",
    5: "mushroom_island3",
    6: "mushroom_island4",
  },
  crystal_island: {
    1: "crystal_island1",
    2: "crystal_island2",
    3: "2",
    4: "3",
    5: "crystal_island3",
    6: "crystal_island4",
  },
};

/** Verbatim narratives (English). Name is prefixed by the pipeline, not inside the string. */
export const ISLAND_STORY_CANON = {
  cherry_blossom_island: {
    island_name: "Cherry Blossom Island",
    villain: "Monkey samurai",
    artifact_name: "Blossom Core",
    artifact_power: "The sacred power at the heart of the shrine.",
    artifact_emoji: "🌸",
    narrative:
      "On Cherry Blossom Island, petals drift through the air like falling snow, covering silent temples and winding paths. Among them moves a monkey samurai, swift and precise, its blade guided by the will of Doctor Krit. It strikes without warning, guarding the island's sacred grounds. At the heart of the shrine lies the Blossom Core, the source of its power. We must reach it, break its hold, and free the samurai before the petals fall forever.",
  },
  jelly_bay_island: {
    island_name: "Jelly Bay Island",
    villain: "Monkey jellyfish king",
    artifact_name: "Pulse Core",
    artifact_power: "The power that binds the jellyfish swarm beneath the bay.",
    artifact_emoji: "🪼",
    narrative:
      "On Jelly Bay Island, the waters glow with drifting jellyfish, lighting the shore in eerie colors. Beneath the surface rules a monkey jellyfish king, its body entwined with pulsing tentacles, commanding the swarm as one. Enslaved by Doctor Krit, it spreads control through the tides. Deep below the bay lies the Pulse Core that binds them. We must dive in, destroy its power, and free the jelly king before the ocean itself turns against us.",
  },
  snowy_peaks_island: {
    island_name: "Snowy Peaks Island",
    villain: "Yeti-monkey Viking",
    artifact_name: "Frost Core",
    artifact_power: "Ancient frozen power atop the highest peak.",
    artifact_emoji: "❄️",
    narrative:
      "On Snowy Peaks Island, jagged mountains rise through endless blizzards, where a towering yeti-monkey Viking roams the frozen ridges. Wielding an icy axe and driven by the will of Doctor Krit, it raids anything that dares cross its path. At the highest peak lies the Frost Core, pulsing with ancient power. We must reach it, shatter its influence, and free the yeti monkey from Krit's control before the storm swallows the island whole.",
  },
  neon_city_island: {
    island_name: "Neon City Island",
    villain: "Cyber-enhanced monkey",
    artifact_name: "Neon Core",
    artifact_power: "The city's central power — shut it down to break the signal.",
    artifact_emoji: "🌃",
    narrative:
      "On Neon City Island, glowing towers hum with energy while neon lights flicker through endless streets. In the shadows moves a cyber-enhanced monkey, its mind enslaved by Doctor Krit's signal, controlling the city's systems like a living network. At the heart of the metropolis lies the Neon Core, pulsing with power. We must reach it, shut it down, and free the monkey before the entire city turns against us.",
  },
  blue_crab_island: {
    island_name: "Blue Crab Island",
    villain: "Four-armed monkey",
    artifact_name: "Tidal Core",
    artifact_power: "Hidden power beneath the reef that fuels the crab army.",
    artifact_emoji: "🦀",
    narrative:
      "On Blue Crab Island, swarms of snapping blue crabs guard the shores while a four-armed monkey rules from the tide pools, striking with impossible speed. Twisted by the will of Doctor Krit, it commands the crabs like an army. Hidden beneath the reef lies the Tidal Core that fuels its power. We must reach it first and break Krit's control before the island is overrun.",
  },
  antigravity_island: {
    island_name: "Antigravity Island",
    villain: "Flying monkey",
    artifact_name: "Gravity Anchor",
    artifact_power: "The source that warps gravity across the island.",
    artifact_emoji: "🪶",
    narrative:
      "On Antigravity Island, where rocks float and the sky twists beneath your feet, a flying monkey patrols the air, striking anyone who dares to enter. Its movements are unnatural — guided by the unseen hand of our greatest enemy, Doctor Krit. At the island's core drifts the Gravity Anchor, the source of its power. We must reach it, shut it down, and free the flying monkey from Krit's control before the island collapses into chaos.",
  },
  mushroom_island: {
    island_name: "Mushroom Island",
    villain: "Monkey shaman",
    artifact_name: "Heart Cap",
    artifact_power: "The fungal heart that powers the shaman's trance.",
    artifact_emoji: "🍄",
    narrative:
      "On the Island of Mushrooms, a hypnotic monkey shaman has begun bending minds with glowing spores and ancient rhythms. Travelers who breathe the mist fall under his control, becoming part of his silent tribe. Deep in the fungal forest lies the source of his power — the Heart Cap. We need to reach it first and break the shaman's trance before the island is lost.",
  },
  crystal_island: {
    island_name: "Crystal Island",
    villain: "Crystal monkey golem",
    artifact_name: "Focusing crystal",
    artifact_power: "The crystal Doctor Krit needs for his mind-control machine.",
    artifact_emoji: "💎",
    narrative:
      "Evil Doctor Krit is hunting the magical crystals from this island to power up his mind-control machine. He has awakened and taken control of the mind of an ancient crystal monkey golem. We need to reach the focusing crystal first and free the monkey golem from Doctor Krit's control.",
  },
};

export const CANONICAL_ISLAND_KEYS = Object.keys(ISLAND_STAGE_BG_KEYS);

export function getIslandStageBgMap(islandKey) {
  const ik = String(islandKey || "")
    .trim()
    .replace(/\s+/g, "_");
  return ISLAND_STAGE_BG_KEYS[ik] || null;
}

function childNameFrom(lesson, draft) {
  return String(draft?.child?.name || lesson?.meta?.student_name || "Hero").trim() || "Hero";
}

/** Insert ", {name}," after the mission phrase (first match only). Jelly Bay: "We must dive in," — comma right after "in". */
export function narrativeWithChildNameAtReach(narrative, name) {
  const text = String(narrative || "");
  const nm = String(name || "").trim() || "Hero";
  const patterns = [
    /\b(We need to reach)(\s+)/i,
    /\b(We must reach)(\s+)/i,
    /\b(We must dive in)(,\s*)/i,
    /\b(We must dive in)(\s+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    return text.replace(re, (_, phrase, tail) =>
      tail.startsWith(",") ? `${phrase}, ${nm}${tail}` : `${phrase}, ${nm},${tail}`,
    );
  }
  return text;
}

/** Force the six stage background stem keys from the selected island (ignores model output). */
export function applyIslandBackgroundStemsToLesson(lesson, islandKey) {
  const ik = String(islandKey || lesson?.meta?.island_key || "").trim();
  const map = ISLAND_STAGE_BG_KEYS[ik];
  if (!map || !Array.isArray(lesson?.stages)) return;
  lesson.meta = lesson.meta || {};
  lesson.meta.island_key = ik;
  for (let i = 0; i < lesson.stages.length; i++) {
    const st = lesson.stages[i];
    if (!st || typeof st !== "object") continue;
    const sn = Number(st.id ?? i + 1) || i + 1;
    const stem = map[sn];
    if (stem) st.background = stem;
  }
}

/** Replace story.* with fixed canon + child's name (English only). */
export function applyCanonStoryToLesson(lesson, draft) {
  const ik = String(lesson?.meta?.island_key || draft?.context?.islandKey || "").trim();
  const canon = ISLAND_STORY_CANON[ik];
  if (!canon) return;
  const name = childNameFrom(lesson, draft);
  lesson.story = lesson.story && typeof lesson.story === "object" ? lesson.story : {};
  lesson.story.island_name = canon.island_name;
  lesson.story.villain = canon.villain;
  lesson.story.artifact_name = canon.artifact_name;
  lesson.story.artifact_power = canon.artifact_power;
  lesson.story.artifact_emoji = canon.artifact_emoji || "⭐";
  lesson.story.greeting = `${name}, your island mission begins now — listen closely.`;
  lesson.story.act1 = narrativeWithChildNameAtReach(canon.narrative, name);
  lesson.story.act2 = "";
  lesson.story.act3 = "";
  lesson.story.goal = `${name}, master every math trial, reach the island's core in time, and break Doctor Krit's hold.`;
}

/** Full pipeline used before saving lesson JSON / building HTML. */
export function applyIslandLessonCanon(lesson, draft) {
  const ik = String(lesson?.meta?.island_key || draft?.context?.islandKey || "").trim();
  if (!ik || !lesson?.stages?.length) return;
  applyIslandBackgroundStemsToLesson(lesson, ik);
  applyCanonStoryToLesson(lesson, draft);
}
