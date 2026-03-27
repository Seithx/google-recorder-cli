# TODO - Recorder CLI & Automation

## Goal
Automated pipeline: when a new Google Recorder recording is created, download the audio,
transcribe it in Hebrew (Gemini), summarize it (Gemini), save to Google Drive, and email
the summary to asafl@rh.co.il via Gmail.

## Architecture

```
[VPS with Chrome + Node.js]
        |
  [Cron / scheduler] -- every 5-15 min
        |
  [Poll Recorder API] -- any new recordings since last check?
        | yes
  [Download audio (m4a)]
        |
  [Gemini API] -- transcribe Hebrew + summarize
        |
  [Save transcript + summary to Google Drive]
        |
  [Send summary via Gmail to asafl@rh.co.il]
```

## Why VPS (not Vercel / Cloud Functions)
- Need persistent Chrome for cookie refresh (SAPISIDHASH auth)
- Vercel = serverless, no browser, no persistent filesystem
- Google Cloud Functions = same limitations
- VPS options: DigitalOcean, Hetzner, Linode (~$5/mo)
- Chrome runs headless on VPS for auto cookie refresh

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
- [ ] Polling / scheduler
  - Track last-checked timestamp
  - Detect new recordings since last poll
  - Auto-retry on transient failures
- [ ] Auto cookie refresh (Issue #7)
  - Headless Chrome on VPS for automatic re-auth
  - Alert email if re-auth fails

## Phase 3 - VPS Deployment
- [ ] Choose VPS provider
- [ ] Set up Node.js + headless Chrome
- [ ] Deploy automation as systemd service or pm2 process
- [ ] Set up cron schedule
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
