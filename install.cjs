const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { makeProfile, scheme, THEME_NAME, PROFILE_ID, SCHEME_NAME,
  terminalAppearance, windowTheme, WINDOW_THEME_NAME } = require('./build-theme.cjs');

const ROOT = __dirname;
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const readJson = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { throw new Error('Cannot parse standard JSON: ' + file + '. No configuration overwritten. ' + error.message); }
};

function atomicWrite(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), '.ds-theme-' + crypto.randomUUID());
  try {
    fs.writeFileSync(temporary, bytes, { flag: 'wx' });
    const fd = fs.openSync(temporary, 'r+');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

function mergeTerminal(settings, profile) {
  const next = structuredClone(settings);
  next.profiles ||= {};
  next.profiles.list ||= [];
  next.schemes ||= [];
  if (!Array.isArray(next.profiles.list) || !Array.isArray(next.schemes)) throw new Error('Unexpected Terminal configuration shape.');
  if (next.profiles.list.some((p) => p.guid?.toLowerCase() === PROFILE_ID.toLowerCase() || p.name === profile.name)) {
    throw new Error('OpenCode DS profile already exists but is not owned by this installation.');
  }
  if (next.schemes.some((s) => s.name === SCHEME_NAME)) throw new Error('DS color scheme already exists; refusing to overwrite.');
  next.profiles.list.push(profile);
  next.schemes.push(scheme);
  return next;
}

function mergeCli(settings) {
  return { ...settings, $schema: settings.$schema || 'https://opencode.ai/v2/cli.json',
    theme: { ...(settings.theme || {}), name: THEME_NAME, mode: 'dark' } };
}

function decorateTerminal(settings, wallpaper) {
  const next = structuredClone(settings);
  if (!next.profiles || !Array.isArray(next.profiles.list)) throw new Error('Unexpected Terminal profile structure.');
  if (!next.schemes?.some((entry) => entry.name === SCHEME_NAME)) throw new Error('DS color scheme missing. Install the CLI theme first.');
  next.themes ||= [];
  const existing = next.themes.find((entry) => entry.name === WINDOW_THEME_NAME);
  if (existing && JSON.stringify(existing) !== JSON.stringify(windowTheme)) throw new Error('An independently modified DS window theme already exists.');
  if (!existing) next.themes.push(windowTheme);
  next.theme = WINDOW_THEME_NAME;
  next.profiles.defaults = { ...(next.profiles.defaults || {}), ...terminalAppearance(wallpaper) };
  return next;
}

function settingsPath() {
  const local = process.env.LOCALAPPDATA;
  if (!local) throw new Error('LOCALAPPDATA unavailable.');
  const candidates = [
    path.join(local, 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    path.join(local, 'Packages', 'Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    path.join(local, 'Microsoft', 'Windows Terminal', 'settings.json'),
  ];
  const found = candidates.find((file) => fs.existsSync(file));
  if (!found) throw new Error('Windows Terminal settings.json not found. Open Windows Terminal once first.');
  return found;
}

function cliPath() {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '(Get-Command opencode -ErrorAction Stop).Source'], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('OpenCode CLI is not on PATH.');
  const file = result.stdout.trim();
  if (!fs.existsSync(file) || !file.endsWith('.exe')) throw new Error('A Windows OpenCode executable is required.');
  return file;
}

function systemPaths() {
  if (process.platform !== 'win32') throw new Error('The installer supports Windows only.');
  const config = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'opencode');
  return { terminal: settingsPath(), cliConfig: path.join(config, 'cli.json'),
    theme: path.join(config, 'themes', THEME_NAME + '.json'),
    wallpaper: path.join(config, 'cli-theme', 'maid-whale.png'),
    cli: cliPath(), directory: path.resolve(__dirname, '..') };
}

function installationFile(root) { return path.join(root, 'runtime', 'installation.json'); }

function verifyCurrent(state) {
  for (const item of state.files) {
    if (!fs.existsSync(item.target) || hash(fs.readFileSync(item.target)) !== item.afterHash) {
      throw new Error('Configuration changed since installation: ' + item.target + '. Restore refused to avoid overwriting newer work.');
    }
  }
}

function install(root = ROOT, paths = systemPaths()) {
  const stateFile = installationFile(root);
  if (fs.existsSync(stateFile)) {
    const saved = readJson(stateFile);
    if (saved.phase !== 'installed') throw new Error('Incomplete installation metadata found. Inspect runtime/ before retrying.');
    verifyCurrent(saved);
    if (saved.files.find((item) => item.target === paths.theme)?.afterHash !== hash(fs.readFileSync(path.join(root, 'themes', THEME_NAME + '.json')))) {
      throw new Error('Theme source changed. Restore the previous installation before reinstalling.');
    }
    console.log('CLI theme already installed and verified.');
    return;
  }
  const wallpaper = fs.readFileSync(path.join(root, 'assets', 'maid-whale.png'));
  if (!wallpaper.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Wallpaper is not PNG.');
  const themeBytes = fs.readFileSync(path.join(root, 'themes', THEME_NAME + '.json'));
  const theme = JSON.parse(themeBytes);
  if (!theme.base || !theme.dark || theme.base.background?.base !== 'transparent') throw new Error('Invalid generated CLI theme.');
  if (fs.existsSync(paths.theme) || fs.existsSync(paths.wallpaper)) throw new Error('Unowned DS theme or wallpaper already exists. Move it aside before installing.');
  const terminalBefore = readJson(paths.terminal);
  const cliBefore = fs.existsSync(paths.cliConfig) ? readJson(paths.cliConfig) : {};
  const terminalNext = mergeTerminal(terminalBefore, makeProfile(paths.cli, paths.wallpaper, paths.directory));
  const cliNext = mergeCli(cliBefore);
  const changes = [
    { role: 'theme', target: paths.theme, bytes: themeBytes }, { role: 'wallpaper', target: paths.wallpaper, bytes: wallpaper },
    { role: 'cli', target: paths.cliConfig, bytes: jsonBytes(cliNext) }, { role: 'terminal', target: paths.terminal, bytes: jsonBytes(terminalNext) },
  ];
  fs.mkdirSync(path.join(root, 'backups'), { recursive: true });
  const backup = fs.mkdtempSync(path.join(root, 'backups', 'installation-'));
  const state = { format: 1, phase: 'prepared', created: new Date().toISOString(), files: [] };
  changes.forEach((change, i) => {
    const existed = fs.existsSync(change.target);
    const before = existed ? fs.readFileSync(change.target) : undefined;
    const name = path.join(path.relative(root, backup), String(i) + '.bin');
    if (before) fs.writeFileSync(path.join(root, name), before, { flag: 'wx' });
    state.files.push({ role: change.role, target: change.target, existed, backup: name,
      beforeHash: before ? hash(before) : null, afterHash: hash(change.bytes) });
  });
  atomicWrite(stateFile, jsonBytes(state));
  const written = [];
  try {
    changes.forEach((change, i) => {
      const item = state.files[i];
      const current = fs.existsSync(item.target) ? hash(fs.readFileSync(item.target)) : null;
      if (current !== item.beforeHash) throw new Error('Configuration changed while installing: ' + item.target);
      atomicWrite(item.target, change.bytes);
      written.push(item);
    });
    state.phase = 'installed';
    atomicWrite(stateFile, jsonBytes(state));
    console.log('Installed CLI theme and dedicated OpenCode DS Terminal profile. Default profile unchanged.');
  } catch (error) {
    for (const item of written.reverse()) {
      if (hash(fs.readFileSync(item.target)) !== item.afterHash) throw new Error('Rollback stopped: a concurrently modified file was detected. Keep runtime/ and backups/.');
      if (item.existed) atomicWrite(item.target, fs.readFileSync(path.join(root, item.backup)));
      else fs.unlinkSync(item.target);
    }
    fs.unlinkSync(stateFile);
    throw error;
  }
}

function restore(root = ROOT) {
  const file = installationFile(root);
  if (!fs.existsSync(file)) throw new Error('No installation record here.');
  const state = readJson(file);
  if (state.format !== 1 || state.phase !== 'installed') throw new Error('Unsupported or incomplete installation record.');
  verifyCurrent(state);
  for (const item of state.files.filter((f) => f.existed)) {
    if (hash(fs.readFileSync(path.join(root, item.backup))) !== item.beforeHash) throw new Error('Backup integrity mismatch.');
  }
  for (const item of [...state.files].reverse()) {
    if (item.existed) atomicWrite(item.target, fs.readFileSync(path.join(root, item.backup)));
    else fs.unlinkSync(item.target);
  }
  fs.renameSync(file, path.join(root, 'runtime', 'restored-' + Date.now() + '.json'));
  console.log('Original CLI and Windows Terminal configuration restored.');
}

function enableTerminal(root = ROOT) {
  const file = installationFile(root);
  const state = readJson(file);
  if (state.format !== 1 || state.phase !== 'installed') throw new Error('Install the CLI theme before decorating Windows Terminal.');
  verifyCurrent(state);
  const terminal = state.files.find((item) => item.role === 'terminal' || path.basename(item.target) === 'settings.json');
  const wallpaper = state.files.find((item) => item.role === 'wallpaper' || path.basename(item.target) === 'maid-whale.png');
  if (!terminal || !wallpaper) throw new Error('Missing Terminal or wallpaper installation record.');
  const before = fs.readFileSync(terminal.target);
  const next = jsonBytes(decorateTerminal(readJson(terminal.target), wallpaper.target));
  if (before.equals(next)) { console.log('Windows Terminal is already decorated.'); return; }
  const updated = structuredClone(state);
  Object.assign(updated.files.find((item) => item.target === terminal.target), { role: 'terminal', afterHash: hash(next) });
  updated.files.find((item) => item.target === wallpaper.target).role = 'wallpaper';
  updated.terminalDefaultsDecorated = true;
  updated.windowTheme = WINDOW_THEME_NAME;
  if (hash(fs.readFileSync(terminal.target)) !== terminal.afterHash) throw new Error('Terminal settings changed concurrently.');
  atomicWrite(terminal.target, next);
  try { atomicWrite(file, jsonBytes(updated)); }
  catch (error) {
    if (hash(fs.readFileSync(terminal.target)) !== hash(next)) throw new Error('Metadata publication failed and settings changed concurrently; keep recovery records.');
    atomicWrite(terminal.target, before);
    throw error;
  }
  console.log('Windows Terminal chrome and profile defaults decorated. Explicit profile overrides, commands and default profile unchanged.');
}

if (require.main === module) {
  try {
    if (process.argv[2] === 'install') install();
    else if (process.argv[2] === 'restore') restore();
    else if (process.argv[2] === 'enable-terminal') enableTerminal();
    else throw new Error('Usage: node install.cjs install|restore|enable-terminal');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { mergeTerminal, mergeCli, install, restore, systemPaths, atomicWrite, decorateTerminal, enableTerminal };
