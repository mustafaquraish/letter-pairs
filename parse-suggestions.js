'use strict';
const fs = require('fs');
const path = require('path');

const DIR = '/Users/mustafa/Downloads/Letter Pairs';

function extractText(html) {
  return html
    // unwrap softmerge divs
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1')
    // unwrap links (keep link text)
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    // strip remaining tags
    .replace(/<[^>]+>/g, '')
    // decode entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFile(filename) {
  const content = fs.readFileSync(path.join(DIR, filename), 'utf8');

  const tbodyMatch = content.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return {};

  // Split into rows
  const allRows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = rowRe.exec(tbodyMatch[1])) !== null) {
    allRows.push(m[1]);
  }
  if (allRows.length < 3) return {};

  // Row 0: pair header labels (each spans 3 columns → one <td colspan="3"> per pair)
  const pairHeaders = [];
  const hdrRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  while ((m = hdrRe.exec(allRows[0])) !== null) {
    const text = extractText(m[1]).toUpperCase();
    // Only keep standard 2-uppercase-letter pairs
    pairHeaders.push(/^[A-Z]{2}$/.test(text) ? text : null);
  }

  const result = {};
  for (const p of pairHeaders) if (p) result[p] = new Set();

  // Row 1 = "Person / Verb or Adjective / Object" — skip
  // Rows 2+ = actual entries; every 3 cells = one pair (same order as pairHeaders)
  for (let ri = 2; ri < allRows.length; ri++) {
    const cells = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    while ((m = cellRe.exec(allRows[ri])) !== null) {
      cells.push(extractText(m[1]));
    }
    for (let ci = 0; ci < cells.length; ci++) {
      const pairIdx = Math.floor(ci / 3);
      if (pairIdx >= pairHeaders.length) break;
      const pair = pairHeaders[pairIdx];
      if (!pair) continue;
      const text = cells[ci];
      if (text) result[pair].add(text);
    }
  }

  // Convert Sets to sorted arrays
  const out = {};
  for (const [k, v] of Object.entries(result)) {
    if (v.size > 0) out[k] = [...v];
  }
  return out;
}

// Parse A.html through Z.html
const allPairs = {};
let filesFound = 0;
for (let c = 65; c <= 90; c++) {
  const letter = String.fromCharCode(c);
  const filePath = path.join(DIR, letter + '.html');
  if (!fs.existsSync(filePath)) { console.warn(`Missing: ${letter}.html`); continue; }
  filesFound++;
  const pairs = parseFile(letter + '.html');
  for (const [k, v] of Object.entries(pairs)) {
    if (!allPairs[k]) allPairs[k] = [];
    allPairs[k].push(...v.filter(s => !allPairs[k].includes(s)));
  }
}

console.error(`Parsed ${filesFound} files, ${Object.keys(allPairs).length} pairs`);

// Summary of pair counts
const counts = Object.values(allPairs).map(v => v.length);
console.error(`Suggestions per pair — min: ${Math.min(...counts)}, max: ${Math.max(...counts)}, avg: ${(counts.reduce((a,b)=>a+b,0)/counts.length).toFixed(1)}`);
console.error(`Pairs with 0 suggestions: ${Object.entries(allPairs).filter(([,v])=>v.length===0).map(([k])=>k).join(', ') || 'none'}`);

// Write output JSON
fs.writeFileSync(
  path.join(__dirname, 'suggestions.json'),
  JSON.stringify(allPairs, null, 2)
);
console.error('Written to suggestions.json');
