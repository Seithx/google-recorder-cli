# Recorder CLI | Google Recorder API tool

## Project Overview
CLI tool that calls Google Recorder's gRPC-Web APIs directly | Downloads transcripts and audio | Auth via persistent Chrome profile + SAPISIDHASH + file-based cookie persistence | No browser UI interaction needed after initial login

## Architecture
`cli.js` - Commander.js CLI entry point with all commands | `src/auth.js` - Chrome management, cookie extraction, SAPISIDHASH generation, file-based auth persistence | `src/api.js` - gRPC-Web client for PlaybackService endpoints + audio download from usercontent endpoint | Auth flow: check saved file -> try Chrome port 9222 -> extract cookies -> verify with test call -> fallback to launch/re-login

## CLI Commands
`auth` (--check, --clear, --authuser N) | `list` (--limit, --json) | `info <id>` (--json) | `transcript <id>` (-o, --json, --plain) | `audio <id>` (-o) | `search <query>` (--limit, --json) | `download` (-o, --limit, --since, --format, --skip-existing) | `download-audio` (-o, --limit, --since, --skip-existing) | `config`

## Key Technical Details
API host: `pixelrecorder-pa.clients6.google.com` | Audio host: `usercontent.recorder.google.com` | Content-Type: `application/json+protobuf` | User-Agent: `grpc-web-javascript/0.1` | API key: `AIzaSyCqafaaFzCP07GzWUSRw0oXErxSlrEX2Ro` | Auth header: `SAPISIDHASH {timestamp}_{sha1(timestamp + SAPISID + origin)}` | Chrome profile: `%LOCALAPPDATA%\recorder-cli\chrome-profile` | Auth file: `~/.config/recorder-cli/auth.json` | Debug port: 9222

**Two ID systems**: Read methods use web share UUID (`shareId`, field [13]). Write/mutate methods use device internal ID (`internalId`, field [0]). Both returned by GetRecordingInfo.

## Response Parsing
GetRecordingList returns `[ [rec1, rec2, ...], [more...] ]` | Recording fields: [0]=internalId [1]=title [2]=[created_s,ns] [3]=[duration_s,ns] [4]=latitude [5]=longitude [6]=location [8]=audioInfo [9]=labels [10]=audioTags [11]=cloudId [13]=shareId [14]=sharedUsers [15]=shareState(1=private) | GetTranscription returns nested arrays: `[[[words], speakerId, langCode], ...]` | Word format: `[rawWord, displayText, startMs, endMs]` | Speaker diarization via speakerId field (0-based, displayed as "Speaker N+1")

## Full API Surface (live-verified March 2026)

### PlaybackService (16 methods)
Path: `/$rpc/java.com.google.wireless.android.pixel.recorder.protos.PlaybackService/{Method}`

**Read (implemented in src/api.js):**
`GetRecordingList` `[[ts_s,ns], pageSize]` | `GetRecordingInfo` `[shareId]` | `GetTranscription` `[shareId]` | `GetAudioTag` `[shareId]` | `GetWaveform` `[shareId]` | `ListLabels` `[]` | `GetShareList` `[shareId]` | `GetGlobalSearchReadiness` `[]`

**Search (not yet implemented -- CLI uses client-side filtering):**
`Search` `[query, null, shareId, null, limit]` -- pagination via base64 cursor: `[query, null, uuid, null, limit, null, null, "cursor"]` | Cursor format (base64-decoded): `0,TIMESTAMP "2026-01-15 12:30:15.657+00",488080052996,"uuid"` | `SingleRecordingSearch` `[query, shareId]`

**Write (not yet implemented):**
`UpdateRecordingLabels` `[shareId, [["label-name", action]]]` action: 1=add, 2=remove | `DeleteRecordingList` `[[internalId]]` double-bracketed for batch | `ChangeShareState` `[internalId, state]` states: 1=Private, 2=Public link | `UpdateRecordingTitle` (in source, not triggered -- mobile-only?) | `WriteShareList` (in source) | `BlockPerson` (in source)

### EditingService (9 methods)
Path: `/$rpc/java.com.google.wireless.android.pixel.recorder.sharedclient.audioediting.protos.EditingService/{Method}`
Session lifecycle: `OpenSession` -> edits -> `SaveAudio` or `CloseSession`

**Live-confirmed:** `OpenSession` `[shareId]` -> returns `[sessionId]` | `CropAudio` `[sessionId, [[start_ns], [end_sec]]]` | `RemoveAudio` `[sessionId, [[start_ns_offset, end_ns], [end_sec]]]` | `UndoEdit` `[sessionId]` | `SaveAudio` `[sessionId, "new-title"]` -> returns `[newRecordingId, 1]` (creates copy) | `CloseSession` `[sessionId]` -> discards edits

**In source only:** `SplitTranscription` | `RenameSpeaker` | `SwitchSpeaker`

### Other Services
`PeopleStackAutocompleteService` at `peoplestack-pa.clients6.google.com`: Warmup `[218,[1]]`, Autocomplete, Lookup -- used for sharing contacts, not needed by CLI
`PeopleStackExperimentsService`: GetExperimentFlags -- A/B testing, not needed

### REST Endpoints
Audio download: `GET usercontent.recorder.google.com/download/playback/{uuid}?authuser=N&download=true` (m4a, supports range requests 206) | Telemetry: `recorder.google.com/api/monitoring/{apicall,pageview}` | `play.google.com/log`

## Implemented Methods (src/api.js)
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
