#!/usr/bin/env node
/**
 * snapshot-a11y.js - Capture sanitized accessibility tree from Recorder app.
 * Strips PII (emails, names, account info) before writing output.
 *
 * Usage:
 *   node tools/snapshot-a11y.js [--raw]       # --raw skips PII sanitization
 *   node tools/snapshot-a11y.js --output FILE # write to specific file
 *
 * Requires Chrome running on port 9222 with Recorder loaded.
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = 'C:/tmp';
const DEFAULT_OUTPUT = path.join(OUTPUT_DIR, 'a11y_recorder.txt');

// ---- PII sanitization patterns ----
const PII_PATTERNS = [
  // Email addresses
  { regex: /[\w.-]+@[\w.-]+\.\w{2,}/g, replacement: '<EMAIL_REDACTED>' },
  // "Google Account: Name (email)" pattern
  { regex: /Google Account:\s*[^"(]+/g, replacement: 'Google Account: <NAME_REDACTED>' },
  // Phone numbers (various formats)
  { regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '<PHONE_REDACTED>' },
  // Names after "Hi " or "Hello " or "Welcome "
  { regex: /(?:Hi|Hello|Welcome),?\s+[A-Z][a-z]+/g, replacement: '$1 <NAME_REDACTED>' },
];

function sanitize(text) {
  let result = text;
  for (const { regex, replacement } of PII_PATTERNS) {
    result = result.replace(regex, replacement);
  }
  return result;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    raw: args.includes('--raw'),
    output: args.includes('--output') ? args[args.indexOf('--output') + 1] : DEFAULT_OUTPUT,
    json: args.includes('--json'),
    navigate: args.includes('--navigate') ? args[args.indexOf('--navigate') + 1] : null,
  };
}

async function main() {
  const opts = parseArgs();

  // Connect to Chrome
  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: null,
    });
  } catch (e) {
    console.error('[ERROR] Cannot connect to Chrome on port 9222.');
    console.error('  Launch Chrome with: node cli.js auth');
    process.exit(1);
  }

  const pages = await browser.pages();
  let page = pages.find(p => p.url().includes('recorder.google.com'));

  if (!page) {
    console.error('[ERROR] No recorder.google.com tab found.');
    browser.disconnect();
    process.exit(1);
  }

  // Optional navigation
  if (opts.navigate) {
    const url = opts.navigate.startsWith('http')
      ? opts.navigate
      : `https://recorder.google.com${opts.navigate.startsWith('/') ? '' : '/'}${opts.navigate}`;
    console.log('[INFO] Navigating to:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('[INFO] URL:', page.url());

  // Get a11y tree
  const client = await page.createCDPSession();
  const tree = await client.send('Accessibility.getFullAXTree');
  console.log('[INFO] Total nodes:', tree.nodes.length);

  // Save full JSON (always raw for machine use, outside project)
  if (opts.json) {
    const jsonPath = opts.output.replace(/\.txt$/, '.json');
    fs.writeFileSync(jsonPath, JSON.stringify(tree, null, 2));
    console.log('[INFO] JSON saved to:', jsonPath);
  }

  // Build readable output
  const lines = [];
  for (const node of tree.nodes) {
    const role = node.role?.value || '';
    const name = node.name?.value || '';
    const val = node.value?.value || '';
    if (node.ignored) continue;
    if (role === 'none' || role === 'generic' || role === 'InlineTextBox') continue;

    let line = role;
    if (name) line += ` "${name.substring(0, 200)}"`;
    if (val) line += ` value="${val.substring(0, 100)}"`;
    lines.push(line);
  }

  let output = lines.join('\n');

  // Sanitize unless --raw
  if (!opts.raw) {
    output = sanitize(output);
    console.log('[INFO] PII sanitization applied.');
  } else {
    console.log('[WARNING] Raw mode - PII NOT sanitized.');
  }

  fs.writeFileSync(opts.output, output);
  console.log('[OK] Saved to:', opts.output);
  console.log('[INFO] Lines:', lines.length);

  browser.disconnect();
}

main().catch(e => {
  console.error('[ERROR]', e.message);
  process.exit(1);
});
