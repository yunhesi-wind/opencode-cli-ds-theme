const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTheme, makeProfile, scheme } = require('../build-theme.cjs');
const template = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vendor', 'opencode-v2.json')));
const generated = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'themes', 'ds-maid.json')));

test('generated theme matches its source generator and keeps all native base token groups', () => {
  assert.deepEqual(generated, makeTheme(template));
  assert.deepEqual(Object.keys(generated.base).sort(), Object.keys(template.base).sort());
  assert.equal(generated.$schema, 'https://opencode.ai/theme.json');
  assert.equal(generated.base.background.base, 'transparent');
  assert.equal(generated.light, undefined);
  for (const group of ['text', 'background']) {
    for (const action of ['primary', 'secondary', 'destructive']) assert.equal(typeof generated.base[group].action[action].base, 'string');
    for (const feedback of ['error', 'warning', 'success', 'info']) assert.equal(typeof generated.base[group].feedback[feedback].base, 'string');
  }
  for (const key of Object.keys(template.base.syntax)) assert.ok(generated.base.syntax[key]);
  for (const key of Object.keys(template.base.markdown)) assert.ok(generated.base.markdown[key]);
});

test('all palette aliases and semantic references resolve without cycles', () => {
  const source = { ...generated.base, hue: generated.dark.hue };
  function lookup(reference, stack = []) {
    assert.ok(!stack.includes(reference), 'Cyclic reference: ' + reference);
    let value = source;
    for (const part of reference.slice(1).split('.')) {
      if (typeof value === 'string' && value.startsWith('$')) value = lookup(value, [...stack, reference]);
      value = value?.[part];
    }
    assert.notEqual(value, undefined, 'Missing reference: ' + reference);
    if (typeof value === 'string' && value.startsWith('$')) return lookup(value, [...stack, reference]);
    return value;
  }
  function walk(value) {
    if (Array.isArray(value)) return;
    if (value && typeof value === 'object') { Object.values(value).forEach(walk); return; }
    assert.equal(typeof value, 'string');
    if (value.startsWith('$')) walk(lookup(value));
    else assert.match(value, /^(transparent|#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8})$/i);
  }
  walk(source);
  for (const hue of ['gray', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'accent', 'interactive', 'neutral']) {
    const palette = lookup('$hue.' + hue);
    for (let step = 100; step <= 900; step += 100) assert.match(palette[step], /^#[\da-f]{6}$/i);
  }
});

test('dialog and diff state backgrounds remain readable instead of globally transparent', () => {
  assert.match(generated.base['@dialog'].background.base, /^#[\da-f]{8}$/i);
  assert.notEqual(generated.base.diff.background.added, 'transparent');
  assert.notEqual(generated.base.diff.background.removed, 'transparent');
  assert.notEqual(generated.base.diff.background.added, generated.base.diff.background.removed);
});

test('Terminal appearance is restricted to the dedicated profile', () => {
  const profile = makeProfile('C:\\cli\\opencode.exe', 'C:\\assets\\maid.png', 'C:\\project');
  assert.equal(profile.commandline, '"C:\\cli\\opencode.exe"');
  assert.equal(profile.backgroundImageOpacity, 0.28);
  assert.equal(profile.opacity, 92);
  assert.equal(profile.useAcrylic, true);
  assert.equal(profile.colorScheme, scheme.name);
});
