# Local Tutor Workflow

## One-time setup

1. Install Node.js.
2. Open this project folder.
3. Run:
   ```bash
   npm install
   ```
4. Create `.env` with:
   ```bash
   ANTHROPIC_API_KEY=your_anthropic_key
   OPENAI_API_KEY=your_openai_key
   ```

`OPENAI_API_KEY` is only needed if you want the **Generate Assets** button.

## Start the tutor app

```bash
npm run tutor:web
```

Open the URL printed in the terminal.

## Tutor workflow

1. Fill the tutor form.
2. Click **Generate Lesson**.
3. Edit the lesson in the web editor.
4. Click **Save Lesson JSON**.
5. Optional: click **Generate Assets**.
6. Click **Build lesson_game.html**.
7. Click **Open Game Preview**.

## Main files

- `output_lesson.json` — generated lesson data
- `lesson_game.html` — playable lesson

## Notes

- The tutor does **not** need to edit raw JSON.
- If the default port is busy, the app may start on the next port.
