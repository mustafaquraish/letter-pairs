'use strict';
/**
 * Injects the parsed suggestions.json into index.html,
 * replacing the existing PAIRS_DATA constant.
 */
const fs = require('fs');

const suggestions = JSON.parse(fs.readFileSync('suggestions.json', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');

// Build compact JS representation
const lines = ['const PAIRS_DATA = {'];
const keys = Object.keys(suggestions).sort();
for (let i = 0; i < keys.length; i++) {
  const pair = keys[i];
  const vals = suggestions[pair];
  const comma = i < keys.length - 1 ? ',' : '';
  // escape any backticks/backslashes in values
  const escaped = vals.map(v =>
    JSON.stringify(v)
  );
  lines.push(`  ${pair}:[${escaped.join(',')}]${comma}`);
}
lines.push('};');
const newPairsData = lines.join('\n');

// Find and replace existing PAIRS_DATA block
// It starts with "const PAIRS_DATA = {" and ends with "};"
// Use a regex that matches across newlines
const re = /const PAIRS_DATA = \{[\s\S]*?\n\};/;
if (!re.test(html)) {
  console.error('ERROR: Could not find PAIRS_DATA block in index.html');
  process.exit(1);
}

const newHtml = html.replace(re, newPairsData);

// Sanity check: still has ALL_PAIRS
if (!newHtml.includes('ALL_PAIRS')) {
  console.error('ERROR: ALL_PAIRS disappeared after replacement');
  process.exit(1);
}

fs.writeFileSync('index.html', newHtml);
console.log(`Done. ${keys.length} pairs injected.`);
console.log(`New index.html size: ${Buffer.byteLength(newHtml)} bytes`);
