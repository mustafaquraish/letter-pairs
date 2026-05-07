'use strict';
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

// Extract script content
const scriptStart = html.indexOf('<script>') + '<script>'.length;
const scriptEnd = html.indexOf('</script>');
if (scriptStart < 0 || scriptEnd < 0) { console.error('No script found'); process.exit(1); }
let script = html.slice(scriptStart, scriptEnd);

// Stub render/attachHandlers to avoid DOM errors but keep logic testable
script = script
  .replace(/^function render\(\) \{/m, 'function render() { return; } function _render() {')
  .replace(/^function attachHandlers\(\) \{/m, 'function attachHandlers() { return; } function _attachHandlers() {')
  .replace(/^loadState\(\);$/m, 'loadState();')
  .replace(/^render\(\);$/m, '/* render() skipped */');

// Build a context with all required globals
const ctx = vm.createContext({
  ctx_ALL_PAIRS_LEN: 0,
  ctx_TEST_RESULTS: null,
  localStorage: (() => {
    let store = {};
    return {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    };
  })(),
  document: {
    getElementById: () => null,
    querySelectorAll: () => ({ forEach: () => {} }),
    querySelector: () => null,
    addEventListener: () => {},
  },
  confirm: () => true,
  URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
  clearTimeout: () => {},
  setTimeout: () => {},
  console,
  process,
  // vars declared with var/function will be placed on ctx
});

// Append test-runner code that stores results on ctx
const runnerCode = `
  ctx_ALL_PAIRS_LEN = typeof ALL_PAIRS !== 'undefined' ? ALL_PAIRS.length : -1;
  ctx_TEST_RESULTS = runAllTests();
`;

try {
  vm.runInContext(script + '\n' + runnerCode, ctx);
  const pairCount = ctx.ctx_ALL_PAIRS_LEN;
  const results = ctx.ctx_TEST_RESULTS;

  console.log('✓ Script loaded');
  console.log(`✓ Total pairs: ${pairCount}`);

  if (!results) { console.error('runAllTests() returned nothing'); process.exit(1); }

  const pass = results.filter(r => r.status === 'pass').length;
  const fail = results.filter(r => r.status === 'fail').length;

  results.forEach(r => {
    const icon = r.status === 'pass' ? '✓' : '✗';
    console.log(`  ${icon} ${r.name}`);
    if (r.error) console.error(`    Error: ${r.error}`);
  });

  console.log(`\nResults: ${pass}/${results.length} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
} catch(e) {
  console.error('Script error:', e.message);
  console.error(e.stack);
  process.exit(1);
}
