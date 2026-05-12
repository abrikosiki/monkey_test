# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start tutor web server (default port 8787)
npm run tutor:web

# Generate assets for output_lesson.json (requires OPENAI_API_KEY)
npm run assets

# Build lesson_game.html from output_lesson.json
npm run build:lesson

# Both in sequence
npm run build:all
```

Required `.env` file:
```
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...          # only needed for asset generation
SUPABASE_URL=...            # optional, falls back to tutor_data/children.json
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_CHILDREN_TABLE=children     # default
SUPABASE_CHILD_LOOKUP_COLUMN=code    # default
```

## Architecture

This is a **Node.js lesson-generation tool** for a children's math game called Monkey Archipelago. It has no build step or framework — every file is plain ESM or vanilla HTML+JS.

### Data flow

1. **Tutor fills the form** in `tutor_ui.html` (served at `/`).
2. The UI POSTs a **draft** (`tutor_data/current_draft.json`) — child code, island, 6 stages × 5 examples with mechanic-specific fields.
3. `tutor_server.mjs` calls Claude (`claude-sonnet-4-5`) with `system_prompt.txt` + a structured user prompt built from the draft. Claude returns a lesson JSON.
4. Post-processing pipeline in the server: `applyDraftToLessonStages` → `enforceEnglishText` → `clampLessonAssetKeys` → `applyIslandLessonCanon`.
5. The result is saved to `output_lesson.json`.
6. `builder.mjs` embeds the JSON into `lesson_game.html` (self-contained playable HTML).
7. Optionally `generate_assets.mjs` uses DALL-E 3 (via OpenAI) to generate missing PNGs/WebPs into `assets/`.

### Key files

| File | Role |
|------|------|
| `tutor_server.mjs` | HTTP server, all API routes, lesson generation logic |
| `tutor_ui.html` | Single-page tutor UI; all frontend JS is inline |
| `island_canon.mjs` | Single source of truth for 8 islands: fixed background keys + canonical English story text |
| `builder.mjs` | Embeds `output_lesson.json` into `lesson_game.html` |
| `generate_assets.mjs` | Generates missing image assets via DALL-E 3 |
| `system_prompt.txt` | Main Claude system prompt for lesson generation |
| `autofill_prompt.txt` | Claude system prompt for the autofill draft endpoint |
| `output_lesson.json` | Current lesson (written by server, read by builder) |
| `tutor_data/current_draft.json` | Persisted tutor form state |
| `tutor_data/children.json` | Local child records (fallback when Supabase is not configured) |

### Lesson JSON structure

```
{
  meta: { student_code, student_name, island_key, character_key, ... },
  story: { island_name, villain, artifact_name, greeting, act1, goal, ... },
  stages: [ /* exactly 6 */ { id, type (= mechanic id), background, rounds: [ /* exactly 5 */ ] } ],
  images_needed: { library, backgrounds, items, targets, artifact, generate_with_dalle },
  tutor_notes: []
}
```

`stage.type` is always one of the 15 mechanic IDs defined at the top of `tutor_server.mjs` (e.g. `drag_drop`, `fill_blank`, `balance_scale`).

### Islands

Eight canonical islands are defined in `island_canon.mjs`:
`cherry_blossom_island`, `jelly_bay_island`, `snowy_peaks_island`, `neon_city_island`, `blue_crab_island`, `antigravity_island`, `mushroom_island`, `crystal_island`.

Each island has a fixed 6-step background pattern: stages 1–2 and 5–6 use island-specific keys (e.g. `blue_crab_island1`), stages 3–4 always use shared cave keys `"2"` and `"3"`. After Claude generates a lesson, `applyIslandLessonCanon` overwrites both backgrounds and story fields with the canon values — model output for those fields is discarded.

### Asset keys

All image references in lesson JSON must be filename stems (no extension) from the `assets/` subfolders: `items/`, `targets/`, `backgrounds/`, `characters/`, `artifacts/`. The server enforces this via `clampLessonAssetKeys` / `resolveToAllowedStems` after generation.

### API routes (tutor_server.mjs)

| Method + Path | Purpose |
|---------------|---------|
| `GET /` | Serve `tutor_ui.html` |
| `GET /api/bootstrap` | Draft + lesson + mechanic list on page load |
| `POST /api/child/fetch` | Lookup child by code (Supabase or local JSON) |
| `POST /api/autofill` | Claude autofills draft from a free-text tutor prompt |
| `POST /api/drafts/save` | Persist draft to disk |
| `POST /api/generate` | Start async lesson generation (returns jobId) |
| `GET /api/generate-status?jobId=` | Poll generation job |
| `POST /api/build-from-draft` | Build lesson without AI (manual mode) |
| `POST /api/build-lesson` | Run builder.mjs → lesson_game.html + generated_lessons/ |
| `POST /api/save-lesson` | Overwrite output_lesson.json |
| `POST /api/lesson-complete` | PATCH child record in Supabase after game |
