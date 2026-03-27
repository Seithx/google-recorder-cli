# TODO - Recorder CLI & Automation

## Goal
Automated pipeline: when a new Google Recorder recording is created, download the audio,
transcribe it in Hebrew (Gemini), summarize it (Gemini), save to Google Drive, and email
the summary to asafl@rh.co.il via Gmail.

## Architecture

```
[VPS with Chrome + Node.js]
        |
  [Persistent headless Chrome] -- browser-as-runtime (not raw HTTP)
        |
  [Polling loop] -- every 5 min
        |
  [Poll Recorder API via page.evaluate(fetch)] -- new recordings?
        | yes
  [Download audio (m4a)]
        |
  [Gemini API] -- transcribe Hebrew + summarize
        |
  [Save transcript + summary to Google Drive]
        |
  [Send summary via Gmail to asafl@rh.co.il]
```

## Why Browser-as-Runtime (not raw HTTP)
- **Google rejects raw HTTP clients after ~2 hours** even with valid cookies
  - Learned from NotebookLM project: extracted cookies work in browser but fail via httpx/requests
  - TLS fingerprint (JA3) differs between Chromium and raw HTTP clients
- Solution: keep headless Chrome alive, execute `fetch()` inside browser JS context
  - Google sees real browser with authentic TLS, cookies, and JS execution
  - Session survives 9+ hours (tested on NotebookLM)
- Phase 1 CLI (raw `https.request()`) works fine for one-off commands
- Phase 2 automation MUST use browser-as-runtime for long-running polling

## Why VPS (not Vercel / Cloud Functions)
- Need persistent headless Chrome (browser-as-runtime for auth)
- Vercel = serverless, no browser, no persistent filesystem
- Google Cloud Functions = same limitations
- VPS options: DigitalOcean, Hetzner, Linode (~$5/mo)

## Phase 1 - Done (CLI)
- [x] Build proper CLI with commander.js (Issue #1)
- [x] Audio download from usercontent endpoint
- [x] Speaker diarization in transcript parsing
- [x] File-based auth persistence (~/.config/recorder-cli/auth.json)
- [x] Multi-account support (--authuser flag)
- [x] Client-side search (Issue #5)
- [x] Bulk download with --since, --skip-existing, --format
- [x] UUID validation, location data, duration formatting
- [x] A11y tree snapshot tool (tools/snapshot-a11y.js) with PII sanitization
- [x] .gitignore hardened for secrets (.env, auth.json, *.pem, *.key)
- [x] Browser automation via CDP + a11y tree (cheap alternative to screenshots)
- [x] Codebase cleanup: deleted 9 exploration/POC scripts, retained knowledge in CLAUDE.md
- [x] Renamed lib/ -> src/, ref/ -> ref-dylantmoore-recorder-cli/, updated all references

## Phase 2 - Automation Pipeline
- [ ] Gemini integration (transcription + summarization)
  - `@google/generative-ai` package
  - Send m4a audio -> transcribe in Hebrew
  - Summarize transcript
  - Needs: Gemini API key
- [ ] Google Drive integration
  - `googleapis` package
  - Upload transcript + summary files
  - Needs: OAuth2 credentials or service account
- [ ] Gmail integration
  - Send summary email to asafl@rh.co.il
  - Needs: OAuth2 credentials (or SMTP with app password)
- [ ] Browser-as-runtime layer -- **MUST be built before polling works**
  - Keep persistent headless Chrome alive, run `fetch()` via `page.evaluate()`
  - Google rejects raw HTTP after ~2hrs (TLS/JA3 fingerprint mismatch)
  - Stealth stack: `channel="chrome"`, playwright-stealth, disable automation flags
  - Persistent browser profile preserves Google session across restarts
  - Cache cleanup on startup (ShaderCache, GPUCache, *.CHROME_DELETE)
  - Serialize page access (one request at a time, or page pool for parallelism)
  - First-time: visible browser for manual login; subsequent: headless from profile
- [ ] Error recovery + watchdog
  - Force page reload on RPC error (re-extract tokens, retry transparently)
  - Full browser restart on crash (persistent profile = no re-login)
  - Heartbeat every 10 min with exponential backoff on repeated failure
  - Pushover/email alert on unrecoverable auth failure
- [ ] Polling / scheduler (depends on browser-as-runtime ^)
  - Track last-checked timestamp (file or DB)
  - `listRecordings()` -> compare `createdSec` > `lastChecked` -> download new
  - Auto-retry on transient failures
  - Detect AUTH_EXPIRED -> trigger page reload -> retry

## Phase 3 - Deployment
- [ ] Choose deployment target (VPS Linux or Windows Docker)
- [ ] Dockerize: Node.js + headless Chrome + persistent browser profile volume
- [ ] Two-layer health monitoring (from watchdog architecture):
  - Host watchdog (systemd on Linux / NSSM on Windows): Docker daemon + container liveness
  - In-container monitor: app-level health (session alive, API responding)
  - Escalating recovery: page reload -> browser restart -> container restart -> alert
- [ ] Alert strategy: Pushover for host-level (works when container is dead), email for app-level
- [ ] Alert throttling: prevent storm during crash loops (10min cooldown)
- [ ] Crash forensics: capture exit code, OOM flag, last logs BEFORE restart
- [ ] Startup recovery: priority-order catch-up (fast local tasks first, slow API calls last)
- [ ] Cross-platform support for Linux (Issue #2)
  - Chrome path: /usr/bin/google-chrome
  - Profile dir: ~/.local/share/recorder-cli/chrome-profile

## Discovered API Methods (not yet implemented)
- [ ] Server-side Search + SingleRecordingSearch (replace client-side filtering)
- [ ] UpdateRecordingLabels (favorite/unfavorite)
- [ ] DeleteRecordingList (uses device internalId, not shareId)
- [ ] ChangeShareState (private/public link)
- [ ] EditingService: OpenSession, CropAudio, RemoveAudio, SaveAudio, CloseSession, UndoEdit
- [ ] EditingService (source-only): SplitTranscription, RenameSpeaker, SwitchSpeaker

## API Monitoring & Testing (inspired by notebooklm-py)
- [ ] Nightly health check script -- call each RPC method, assert 200
  - Auto-create GitHub issue with `api-breakage` label on failure
  - Run via GitHub Actions cron schedule
  - Same watchdog pattern as NotebookLM project
- [ ] VCR cassettes -- record real HTTP responses as fixtures for offline tests
  - Test parsing logic without hitting Google servers
  - Replay captured responses in CI
- [ ] `RECORDER_DEBUG_RPC=1` env var -- dump raw request/response bodies
  - Useful when Google changes response format silently
  - Shows method name, request body, status code, raw response

## Remaining CLI Issues (lower priority)
- [ ] Add transcript export formats: SRT, VTT (Issue #3)
- [ ] Parse getAudioTags and getWaveform responses (Issue #4)
