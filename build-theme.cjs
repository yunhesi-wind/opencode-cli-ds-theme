const fs = require('node:fs');
const path = require('node:path');

const THEME_NAME = 'ds-maid';
const PROFILE_ID = '{76fb82d3-6b1f-4c95-9fd7-65b0e9a6e7b8}';
const PROFILE_NAME = 'OpenCode DS';
const SCHEME_NAME = 'OpenCode DS Midnight';
const WINDOW_THEME_NAME = 'OpenCode DS Glass';

function terminalAppearance(wallpaper) {
  return { colorScheme: SCHEME_NAME, backgroundImage: wallpaper, backgroundImageOpacity: 0.28,
    backgroundImageStretchMode: 'uniformToFill', backgroundImageAlignment: 'center', opacity: 92, useAcrylic: true };
}

const windowTheme = {
  name: WINDOW_THEME_NAME,
  window: { applicationTheme: 'dark', useMica: true },
  tabRow: { background: '#00000000', unfocusedBackground: '#0b152860' },
  tab: { background: '#12213a', unfocusedBackground: '#0b152840', showCloseButton: 'hover' },
};

function makeTheme(template) {
  const theme = structuredClone(template);
  delete theme.light; // This wallpaper-oriented theme intentionally supports dark mode only.
  const base = theme.base;
  base.categorical = ['blue', 'purple', 'green', 'orange', 'cyan'];
  base.text.base = '#e8eef8';
  base.text.muted = '#aabbd1';
  base.text.action.primary.$selected = '#a8d0ff';
  base.background.base = 'transparent';
  base.background.raised = { base: '#16263d66', high: '#182a45bb', max: '#1d3252e6' };
  base.background.action.primary.$hovered = '#1b315477';
  base.background.formfield = { base: 'transparent', $focused: '#14274388', $selected: '#28486c' };
  base.border.base = '#55749b';
  base.scrollbar.base = '#6e8bb4';
  base.syntax = {
    comment: '#8da4c1', keyword: '#c3a6f5', function: '#91c6ff', variable: '#e8eef8',
    string: '#a3d9bd', number: '#edbd91', type: '#8ed9e3', operator: '#b9cce5', punctuation: '#aabbd1',
  };
  base.markdown.heading = '#9ac8ff';
  base.markdown.strong = '#eaf2ff';
  base.markdown.link = '#91c6ff';
  base.markdown.linkText = '#8ed9e3';
  base.diff.text = { added: '#a3d9bd', removed: '#f2a6b0', context: '#b8c9e0', hunkHeader: '#91c6ff' };
  base.diff.background = { added: '#14352d', removed: '#402331', context: '#0d1b2f' };
  base.diff.lineNumber = { text: '#91a8c8', background: { added: '#112c26', removed: '#331e28' } };
  base['@dialog'].background = {
    base: '#0d1b2feb', raised: { base: '#162a43', high: '#223d5e', max: '#2c5078' },
    action: { primary: { base: 'transparent', $hovered: '#223d5e', $selected: '#294b72' } },
  };
  theme.dark.hue.gray = Object.fromEntries([
    '#f4f7fc', '#e8eef8', '#c3d2e7', '#aabbd1', '#6e87a9', '#29405e', '#192d47', '#0d1b2f', '#07111f',
  ].map((color, i) => [(i + 1) * 100, color]));
  theme.dark.hue.accent = '$hue.blue';
  theme.dark.hue.interactive = '$hue.cyan';
  theme.dark.hue.yellow = '$hue.orange';
  return theme;
}

const scheme = {
  name: SCHEME_NAME, background: '#0b1528', foreground: '#e8eef8', cursorColor: '#9ac8ff',
  selectionBackground: '#355479', black: '#17243b', red: '#e894a3', green: '#94cbb0',
  yellow: '#e5bd88', blue: '#83b8f0', purple: '#bba0eb', cyan: '#7cc8d9', white: '#cfdbeb',
  brightBlack: '#7892b3', brightRed: '#f2a6b0', brightGreen: '#a9dfbf', brightYellow: '#f0d0a6',
  brightBlue: '#a3cdff', brightPurple: '#d0b8ff', brightCyan: '#9adfeb', brightWhite: '#f4f7fc',
};

function makeProfile(cli, wallpaper, directory) {
  return {
    guid: PROFILE_ID, name: PROFILE_NAME, commandline: '"' + cli + '"', hidden: false,
    startingDirectory: directory, ...terminalAppearance(wallpaper), font: { face: 'Cascadia Mono', size: 12 },
    padding: '12, 10, 12, 10', cursorShape: 'bar', scrollbarState: 'hidden',
  };
}

if (require.main === module) {
  const template = JSON.parse(fs.readFileSync(path.join(__dirname, 'vendor', 'opencode-v2.json'), 'utf8'));
  const directory = path.join(__dirname, 'themes');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, THEME_NAME + '.json'), JSON.stringify(makeTheme(template), null, 2) + '\n');
  console.log('Generated complete V2 theme: ' + THEME_NAME);
}

module.exports = { makeTheme, makeProfile, scheme, THEME_NAME, PROFILE_ID, PROFILE_NAME, SCHEME_NAME,
  terminalAppearance, windowTheme, WINDOW_THEME_NAME };
