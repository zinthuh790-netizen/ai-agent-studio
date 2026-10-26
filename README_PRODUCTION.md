# AI Video Translator — Production Starter

The original frontend is retained. The `server/` folder adds a real upload API and a safe server-side integration point.

## Run locally

```bash
cd server
npm install
npm start
```

Open `http://localhost:8080`.

## Production processing

Connect your preferred providers to `/api/translate`:
- FFmpeg for audio extraction and subtitle burning
- Timestamped speech-to-text (Whisper or equivalent)
- Translation model/API
- Object storage for source/output files
- Job queue for long videos

Do not expose API keys in `app.js` or `index.html`.
