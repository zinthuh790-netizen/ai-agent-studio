# AI Agent Studio — Movie Recap & Video Translator

A mobile-friendly website starter with three tools:
- Video translation: uploads a video, extracts audio, transcribes speech with Whisper, translates subtitle segments and returns a downloadable SRT plus translated transcript.
- Movie recap: turns detected speech into a recap/voiceover script. It can only recap story details present in the audio transcript; it does not visually understand silent scenes.
- AI video prompt: turns an idea into a prompt for a separate video-generation service. It does not generate the video itself.

## Requirements
- Node.js 20+ recommended
- An OpenAI API key with API billing enabled
- Internet access on the server for API calls

## Run locally
1. Extract this ZIP on a computer or a cloud Node.js host.
2. Open a terminal in `server/` and run `npm install`.
3. Copy `.env.example` to `.env` and put your key in `OPENAI_API_KEY`.
4. Run `npm start` and open `http://localhost:8080`.

Do not publish `.env`, and never put the API key in `app.js` or `index.html`.

## Deploy online
Deploy the whole project to a Node.js host that supports persistent server processes, FFmpeg and file uploads. Set `OPENAI_API_KEY` and optionally `TEXT_MODEL` as environment variables in the host dashboard. Set the start command to `cd server && npm install && npm start` (or the host's equivalent). For production, add authentication, rate limits, storage cleanup, job queueing, request timeouts and privacy notices before making it public.

## Current limits
- The starter rejects uploads above 200 MB.
- Extracted audio must be no larger than 24 MB for the transcription request.
- Long processing requests may exceed serverless request time limits; use a persistent Node server for real use.
- Translated subtitles are downloadable as `.srt`; this version does not burn subtitles into the original video or synthesize a dubbed voice track.
- AI API usage costs money. API access is separate from a ChatGPT subscription.
