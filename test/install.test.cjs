const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { install, restore, mergeCli, mergeTerminal } = require('../install.cjs');
const { makeProfile, PROFILE_ID } = require('../build-theme.cjs');
const { WINDOW_THEME_NAME } = require('../build-theme.cjs');
const { decorateTerminal, enableTerminal } = require('../install.cjs');

function fixture(run) {
  const parent = path.join(process.env.OPENCODE_TEST_TEMP || os.tmpdir(), 'opencode-cli-theme-tests');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'fixture-'));
  try {
    fs.mkdirSync(path.join(root, 'assets'));
    fs.mkdirSync(path.join(root, 'themes'));
    fs.writeFileSync(path.join(root, 'assets', 'maid-whale.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    fs.copyFileSync(path.join(__dirname, '..', 'themes', 'ds-maid.json'), path.join(root, 'themes', 'ds-maid.json'));
    const target = path.join(root, 'targets');
    fs.mkdirSync(target);
    const paths = { terminal: path.join(target, 'terminal.json'), cliConfig: path.join(target, 'cli.json'),
      theme: path.join(target, 'themes', 'ds-maid.json'), wallpaper: path.join(target, 'assets', 'wallpaper.png'),
      cli: 'C:\\cli\\opencode.exe', directory: 'C:\\project' };
    const original = { defaultProfile: 'existing', copyOnSelect: false, actions: ['keep'], profiles: { defaults: { font: { size: 15 } }, list: [{ guid: 'existing', name: 'PowerShell' }] }, schemes: [] };
    fs.writeFileSync(paths.terminal, JSON.stringify(original, null, 4));
    run({ root, paths, original });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('merges preserve permission, keybinding, model-like and unrelated terminal fields', () => {
  const cli = { theme: { name: 'old', mode: 'light' }, keybinds: { leader: 'ctrl+x' }, session: { permissions: 'prompt' } };
  const next = mergeCli(cli);
  assert.deepEqual(next.keybinds, cli.keybinds);
  assert.deepEqual(next.session, cli.session);
  assert.equal(cli.theme.name, 'old');
  fixture(({ original }) => {
    const profile = makeProfile('opencode.exe', 'wallpaper.png', 'project');
    const merged = mergeTerminal(original, profile);
    assert.equal(merged.defaultProfile, original.defaultProfile);
    assert.deepEqual(merged.profiles.defaults, original.profiles.defaults);
    assert.deepEqual(merged.profiles.list[0], original.profiles.list[0]);
    assert.deepEqual(merged.actions, original.actions);
    assert.throws(() => mergeTerminal(merged, profile), /already exists/);
  });
});

test('install and restore round-trip raw Terminal bytes and absent CLI config', () => fixture(({ root, paths }) => {
  const before = fs.readFileSync(paths.terminal);
  install(root, paths);
  assert.equal(JSON.parse(fs.readFileSync(paths.cliConfig)).theme.name, 'ds-maid');
  assert.ok(JSON.parse(fs.readFileSync(paths.terminal)).profiles.list.some((p) => p.guid === PROFILE_ID));
  install(root, paths); // Idempotent and does not replace the first backup.
  restore(root);
  assert.deepEqual(fs.readFileSync(paths.terminal), before);
  assert.equal(fs.existsSync(paths.cliConfig), false);
  assert.equal(fs.existsSync(paths.theme), false);
  assert.equal(fs.existsSync(paths.wallpaper), false);
}));

test('restore refuses to overwrite configuration changed after installation', () => fixture(({ root, paths }) => {
  install(root, paths);
  const changed = JSON.parse(fs.readFileSync(paths.terminal));
  changed.defaultProfile = 'user-new-default';
  fs.writeFileSync(paths.terminal, JSON.stringify(changed));
  assert.throws(() => restore(root), /Configuration changed/);
  assert.equal(JSON.parse(fs.readFileSync(paths.terminal)).defaultProfile, 'user-new-default');
}));

test('existing standalone theme and invalid JSON are rejected before config writes', () => fixture(({ root, paths }) => {
  fs.mkdirSync(path.dirname(paths.theme), { recursive: true });
  fs.writeFileSync(paths.theme, 'user custom theme');
  const before = fs.readFileSync(paths.terminal);
  assert.throws(() => install(root, paths), /Unowned/);
  assert.deepEqual(fs.readFileSync(paths.terminal), before);
  fs.unlinkSync(paths.theme);
  fs.writeFileSync(paths.terminal, '{ invalid JSON }');
  assert.throws(() => install(root, paths), /Cannot parse standard JSON/);
  assert.equal(fs.existsSync(paths.cliConfig), false);
}));

test('backup corruption blocks restore without changing live settings', () => fixture(({ root, paths }) => {
  install(root, paths);
  const state = JSON.parse(fs.readFileSync(path.join(root, 'runtime', 'installation.json')));
  const original = state.files.find((f) => f.existed);
  fs.writeFileSync(path.join(root, original.backup), 'broken backup');
  const before = fs.readFileSync(paths.terminal);
  assert.throws(() => restore(root), /Backup integrity mismatch/);
  assert.deepEqual(fs.readFileSync(paths.terminal), before);
}));

test('Terminal global defaults preserve profile overrides, commands, directories, fonts and shortcuts', () => fixture(({ original }) => {
  const input = structuredClone(original);
  input.profiles.list.push({ guid: 'custom-shell', name: 'Windows PowerShell', commandline: 'powershell.exe', startingDirectory: 'C:\\work', font: { size: 18 }, backgroundImage: 'my-custom-image.png' });
  const installed = mergeTerminal(input, makeProfile('opencode.exe', 'maid.png', 'project'));
  const decorated = decorateTerminal(installed, 'maid.png');
  assert.equal(decorated.theme, WINDOW_THEME_NAME);
  assert.equal(decorated.defaultProfile, input.defaultProfile);
  assert.deepEqual(decorated.profiles.list[0], input.profiles.list[0]);
  const shell = decorated.profiles.list.find((p) => p.guid === 'custom-shell');
  assert.equal(shell.commandline, 'powershell.exe');
  assert.equal(shell.startingDirectory, 'C:\\work');
  assert.deepEqual(shell.font, { size: 18 });
  assert.equal(shell.backgroundImage, 'my-custom-image.png');
  assert.equal(decorated.profiles.defaults.backgroundImage, 'maid.png');
  assert.deepEqual(decorated.profiles.defaults.font, input.profiles.defaults.font);
  assert.deepEqual(decorated.profiles.list, installed.profiles.list);
  assert.equal(decorated.themes[0].window.useMica, true);
  assert.deepEqual(decorateTerminal(decorated, 'maid.png'), decorated);
}));

test('Terminal global decoration updates restore metadata while preserving the original backup', () => fixture(({ root, paths }) => {
  const before = JSON.parse(fs.readFileSync(paths.terminal));
  before.profiles.list.push({ guid: 'powershell', name: 'Windows PowerShell', commandline: 'powershell.exe' });
  const originalBytes = Buffer.from(JSON.stringify(before));
  fs.writeFileSync(paths.terminal, originalBytes);
  install(root, paths);
  enableTerminal(root);
  enableTerminal(root);
  restore(root);
  assert.deepEqual(fs.readFileSync(paths.terminal), originalBytes);
}));

test('failed Terminal metadata publication rolls the global appearance back', () => fixture(({ root, paths }) => {
  install(root, paths);
  const before = fs.readFileSync(paths.terminal);
  const metadata = path.join(root, 'runtime', 'installation.json');
  const beforeState = fs.readFileSync(metadata);
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (to === metadata) throw new Error('SIMULATED_METADATA_FAILURE');
    return rename(from, to);
  };
  try { assert.throws(() => enableTerminal(root), /METADATA_FAILURE/); }
  finally { fs.renameSync = rename; }
  assert.deepEqual(fs.readFileSync(paths.terminal), before);
  assert.deepEqual(fs.readFileSync(metadata), beforeState);
}));
