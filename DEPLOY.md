# Deploy Tutor UI

## Local

1. Install dependencies:
   ```bash
   npm install
   ```
2. Add `.env` with:
   ```bash
   ANTHROPIC_API_KEY=your_key_here
   ```
3. Start:
   ```bash
   npm run tutor:web
   ```
4. Open the printed URL in browser.

## Render

1. Push this project to GitHub.
2. Create a new Web Service in Render.
3. Connect the repository.
4. Render will detect `render.yaml`.
5. Add environment variable:
   - `ANTHROPIC_API_KEY`
6. Deploy.

After deploy, the app will provide:
- lesson generation,
- lesson editing without raw JSON,
- saving `output_lesson.json`,
- building `lesson_game.html`,
- opening game preview.

## Notes

- The tutor should use the web editor, not edit JSON manually.
- If local port `8787` is busy, the server can move to the next port.
