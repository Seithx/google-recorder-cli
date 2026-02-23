# Recorder CLI | Google Recorder API tool

## Project Overview
CLI tool that calls Google Recorder's gRPC-Web APIs directly | Downloads transcripts and audio | Auth via persistent Chrome profile + SAPISIDHASH + file-based cookie persistence | No browser UI interaction needed after initial login

## Architecture
`cli.js` - Commander.js CLI entry point with all commands | `src/auth.js` - Chrome management, cookie extraction, SAPISIDHASH generation, file-based auth persistence | `src/api.js` - gRPC-Web client for PlaybackService endpoints + audio download from usercontent endpoint | Auth flow: check saved file -> try Chrome port 9222 -> extract cookies -> verify with test call -> fallback to launch/re-login

## CLI Commands
`auth` (--check, --clear, --authuser N) | `list` (--limit, --json) | `info <id>` (--json) | `transcript <id>` (-o, --json, --plain) | `audio <id>` (-o) | `search <query>` (--limit, --json) | `download` (-o, --limit, --since, --format, --skip-existing) | `download-audio` (-o, --limit, --since, --skip-existing) | `config`

## Key Technical Details
API host: `pixelrecorder-pa.clients6.google.com` | Audio host: `usercontent.recorder.google.com` | Service: `PlaybackService` | Content-Type: `application/json+protobuf` | API key: `AIzaSyCqafaaFzCP07GzWUSRw0oXErxSlrEX2Ro` | Auth header: `SAPISIDHASH {timestamp}_{sha1(timestamp + SAPISID + origin)}` | Chrome profile: `%LOCALAPPDATA%\recorder-cli\chrome-profile` | Auth file: `~/.config/recorder-cli/auth.json` | Debug port: 9222

## Response Parsing
GetRecordingList returns `[ [rec1, rec2, ...], [more...] ]` | Recording fields: [0]=internalId [1]=title [2]=[created_s,ns] [3]=[duration_s,ns] [4]=latitude [5]=longitude [6]=location [8]=audioInfo [11]=cloudId [13]=shareId | GetTranscription returns nested arrays: `[[[words], speakerId, langCode], ...]` | Word format: `[rawWord, displayText, startMs, endMs]` | Speaker diarization via speakerId field (0-based, displayed as "Speaker N+1")

## API Methods (src/api.js)
`listRecordings(auth, pageSize, beforeTimestamp)` | `listAllRecordings(auth, {limit, since, onPage})` - paginated with date filter | `getTranscription(auth, shareId)` - returns `{segments, fullText}` with speaker labels | `getRecordingInfo(auth, shareId)` | `downloadAudio(auth, recordingId)` - from usercontent endpoint | `getAudioTags(auth, shareId)` | `getWaveform(auth, shareId)` | `listLabels(auth)` | `getShareList(auth, shareId)` | `isValidUUID(id)` | `formatDuration(ms)` | `formatTime(ms)`

## Windows/Git Bash Notes
Use `cmd /c npx` for MCP servers (not bare `npx`) | `MSYS_NO_PATHCONV=1` to prevent `/c` -> `C:/` mangling | Chrome must use separate `--user-data-dir` (Chrome 136+ blocks debug on default profile) | `py` launcher for Python | ASCII symbols for console output: `[OK]` `[ERROR]` `[WARNING]` `[SUCCESS]`

## Dependencies
commander, puppeteer-core | Node.js built-in: https, crypto, path, fs, child_process, os

## Frontend (for reference)
Google Recorder web app uses Lit (Web Components) | Root element: `<recorder-main>` with shadow DOM | Bundled via Google Closure Compiler (not webpack) | Has protobuf globals (`window.proto`, `window.jspb`) | Service Worker active

### UI Components (shadow DOM, all require `>>>` piercing)
`recorder-main` > `recorder-sidebar` > `recorder-sidebar-recording` (list items) | `recorder-transcript` > `recorder-transcript-paragraph` > `recorder-transcript-word` | `recorder-transport` (playback controls: play, rewind 5s, forward 10s) | Other buttons: Edit recording, Share, Settings, Download, Delete, "Switch to Audio/Transcript view"

### Reverse Engineering Notes
Discovered via CDP network interception + DOM inspection (scripts deleted, knowledge retained here) | XSRF_TOKEN exists as window global but is NOT needed -- SAPISIDHASH is sufficient for all API calls | App also calls `ogads-pa.clients6.google.com` (AsyncDataService) and `peoplestack-pa.clients6.google.com` (PeopleStackAutocompleteService) for sharing features -- not used by CLI | A11y tree is very sparse (~39 meaningful nodes from ~890 raw) due to heavy canvas + shadow DOM -- use `aria-label`/`role` selectors, never dynamic IDs
