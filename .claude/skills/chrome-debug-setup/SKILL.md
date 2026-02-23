---
name: chrome-debug-setup
description: Set up Chrome DevTools MCP to connect to an existing logged-in Chrome browser on Windows (Git Bash). Use when needing to inspect authenticated websites, configure chrome-devtools-mcp, or debug MCP browser connection issues.
disable-model-invocation: true
---

# Chrome DevTools MCP - Windows/Git Bash Setup

Connect chrome-devtools MCP to a **user's already-logged-in Chrome** to inspect authenticated web apps without Google's "not secure" error.

```
User's Chrome (port 9222) <---> chrome-devtools-mcp <---> Claude Code
```

## Setup

**1. Launch Chrome** (PowerShell, not Git Bash):
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\chrome-debug-profile" `
  https://example.com
```
Fresh profile = log in manually once; session persists on reuse.

**2. Log in manually** to target website.

**3. Configure MCP** (see project CLAUDE.md for `cmd /c npx` and `MSYS_NO_PATHCONV=1` rationale):
```bash
MSYS_NO_PATHCONV=1 claude mcp add chrome-devtools -s user -- cmd /c npx chrome-devtools-mcp@latest --browserUrl=http://127.0.0.1:9222
```

**4. Restart Claude Code** (MCP reads config at startup only).

## Chrome DevTools Pitfalls

| # | Problem | Solution |
|---|---------|----------|
| 1 | MCP launches own Chrome (no login session) | Add `--browserUrl=http://127.0.0.1:9222` |
| 2 | Google blocks sign-in on automated browsers | Sign in manually BEFORE connecting MCP |
| 3 | `--browser-url` silently fails, MCP spawns own Chrome | Bypass MCP, use puppeteer-core directly |
| 4 | wsEndpoint changes each Chrome restart (stale ID = 404) | Prefer `--browserUrl` (auto-discovers WS). This is the #1 cause of 404 errors |
| 5 | MCP returns 404 with `--browserUrl` too | Fall back to puppeteer-core; `lib/auth.js` `launchChrome()` handles launch |
| 6 | Fresh `--user-data-dir` opens `chrome://intro/` not target URL | Navigate via CDP after launch: `pages[0].goto(url)` |

General GitBash pitfalls (`!` escaping, stdout swallowing, path mangling, `cmd /c npx`) are in `~/.claude/CLAUDE.md` and project `CLAUDE.md`.

## Verify

```bash
curl -s http://127.0.0.1:9222/json/version   # Chrome reachable?
curl -s http://127.0.0.1:9222/json            # List tabs
claude mcp get chrome-devtools                 # MCP config
```

GitBash-safe alternative (if curl output swallowed):
```javascript
// verify_chrome.js
const http = require('http');
http.get('http://127.0.0.1:9222/json/list', res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => console.log(JSON.parse(d).map(t => t.url)));
}).on('error', e => console.error('Not reachable:', e.message));
```

## Fallback: Direct puppeteer-core

When MCP won't cooperate:
```javascript
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes('target-site.com'));
// interact...
browser.disconnect(); // NOT .close() -- don't kill user's Chrome
```

## A11y Tree via CDP (Cheap Automation)

Get page content as structured text instead of expensive screenshots:
```javascript
const client = await page.createCDPSession();
const { nodes } = await client.send('Accessibility.getFullAXTree');
const meaningful = nodes.filter(n =>
  n.role?.value && !['generic','none'].includes(n.role.value)
  && !n.ignored && (n.name?.value || n.role.value === 'heading')
);
meaningful.forEach(n => console.log(`${n.role.value} "${n.name?.value || ''}"`));
```

Shadow DOM apps (Lit/Web Components) = very sparse trees (~39 meaningful from ~890 raw). Use semantic roles + aria-labels, never dynamic IDs. See `tools/snapshot-a11y.js` for production version with PII sanitization.

## MCP Flags

| Flag | Description |
|------|-------------|
| `--browser-url` / `-u` | HTTP debug endpoint (`http://127.0.0.1:9222`) |
| `--wsEndpoint` / `-w` | WebSocket (`ws://127.0.0.1:9222/devtools/browser/<id>`) |
| `--wsHeaders` | Custom WS headers as JSON |

`--browser-url` and `--wsEndpoint` conflict -- use only one.
