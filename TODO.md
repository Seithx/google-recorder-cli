# Roadmap

## Phase 1 - CLI (done)
- [x] Commander.js CLI with all commands (list, info, transcript, audio, search, download, config)
- [x] Audio download from usercontent endpoint
- [x] Speaker diarization in transcript parsing
- [x] File-based auth persistence
- [x] Multi-account support (--authuser)
- [x] Bulk download with --since, --skip-existing, --format
- [x] Full API surface discovery: 16 PlaybackService + 9 EditingService methods

## Phase 2 - Automation Pipeline
- [ ] Browser-as-runtime for long-running sessions (raw HTTP expires after ~2hrs)
- [ ] Polling: detect new recordings, download automatically
- [ ] Gemini integration: Hebrew transcription + summarization
- [ ] Google Drive upload
- [ ] Email summary delivery
- [ ] Error recovery + health monitoring

## Phase 3 - Deployment
- [ ] Dockerize with persistent headless Chrome
- [ ] Health monitoring with alerting
- [ ] Linux support (Issue #2)

## Discovered API Methods (not yet implemented)
- [ ] Server-side Search + SingleRecordingSearch
- [ ] Write operations: favorite, delete, share state
- [ ] EditingService: crop, remove, save, undo, speaker management

## CLI Improvements
- [ ] Transcript export: SRT, VTT (Issue #3)
- [ ] Parse getAudioTags and getWaveform responses (Issue #4)
- [ ] `RECORDER_DEBUG_RPC=1` debug mode
- [ ] API health check (nightly CI with auto-issue on breakage)
