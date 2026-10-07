# OpenCode CLI DS Theme

**OpenCode V2 CLI 深蓝透明主题 + Windows Terminal 全局玻璃风格。**
普通 PowerShell、命令提示符等未显式配置背景的标签页继承壁纸；保留原有命令、工作目录、字体、快捷键及默认 profile 选择。
另提供独立 `OpenCode DS` profile。由 **yunhesi-wind** 维护，含 **OpenAI GPT** 辅助贡献。

> 非官方美化，不修改 OpenCode 可执行文件或桌面版应用，不改变模型、MCP、skills 和会话数据。
> 仓库只发布源码与完整主题 JSON，不分发背景视频／图片、个人配置、截图或备份。

## 兼容性

- 本机验收：Windows、Windows Terminal 1.25、OpenCode CLI 2.0.24。
- Node.js >=22.12；PowerShell、curl.exe；OpenCode CLI 必须在 PATH 中。
- Mica 需要 Windows 11 build >=22621；其他系统可能退化为普通深色顶栏。
- 传统 conhost 窗口不支持本项目的 Terminal 壁纸；请使用 Windows Terminal。
- 安装器目前要求标准 JSON，带注释的 JSONC 在修改前拒绝；不会盲目重写注释。

## 首次安装

```powershell
git clone https://github.com/yunhesi-wind/opencode-cli-ds-theme.git
cd opencode-cli-ds-theme
npm ci --ignore-scripts
```

### 1. 获取背景并提取静态画面

先阅读 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)，自行确认素材使用权限。
素材 CC BY-NC-SA 4.0 信息仅依据上游声明，尚未独立核实权利链。

```powershell
node download-background.cjs --accept-upstream-license
# Windows 使用系统代理时，可改为：
node download-background.cjs --accept-upstream-license --system-proxy
```

下载器只从上游 HTTPS 地址获取素材，检查大小及 SHA-256，不执行下载内容。
用户确认选项不等于取得版权授权。也可自行放入哈希匹配的 `assets/zipzip-1080p.mp4`。

```powershell
node tools/capture-frame.cjs .\assets\zipzip-1080p.mp4
```

用浏览器打开脚本输出的 `http://127.0.0.1:8832`。
脚本使用浏览器解码视频第 2 秒，保存为 `assets/maid-whale.png` 后自动退出，无需 FFmpeg。
视频不会在终端中播放。已有 PNG 不会被自动覆盖。

### 2. 安装完整主题

```powershell
node build-theme.cjs
npm test
node install.cjs install
node install.cjs enable-terminal
```

也可双击 `Install-Theme.cmd` 完成最后两步。
基础安装新增独立 profile／色板并合并 CLI 主题；`enable-terminal` 设置 Terminal 外壳主题和
`profiles.defaults` 默认外观，不逐个覆盖已有 profile。原始设置先备份，两步共用恢复记录。

### 3. 使用

重新打开 Windows Terminal 的普通 PowerShell 标签页，直接输入 `opencode` 即有背景。
已有 profile 显式配置的背景、配色等优先于全局默认，不会被覆盖。

想直接打开美化版 CLI，可双击 `Launch-OpenCode.cmd`，或在项目中运行：

```powershell
wt -w new new-tab -p "OpenCode DS" -d "$PWD"
```

## 外观参数

| 项目 | 默认值 |
|---|---|
| 壁纸显示 opacity | 28%，位于深蓝终端底色上 |
| 窗口 opacity | 92%，启用 acrylic |
| 顶栏／标签 | `OpenCode DS Glass`，请求 Mica |
| CLI 主题 | `ds-maid`，暗色、主背景透明 |
| 对话／菜单 | 独立深色阅读底色 |
| 代码差异 | 保留绿色／红色状态背景，不全局透明化 |

背景 opacity、窗口 opacity 与 CLI 各区域背景 alpha 是不同参数。
终端不能完全复刻桌面版逐面板 CSS 模糊。专用 DS profile 使用 Cascadia Mono 12pt；
全局默认不改其他 profile 的字体或命令。

## 恢复与更新

```powershell
node install.cjs restore
```

或双击 `Restore-Theme.cmd`。恢复原始 CLI 和 Terminal 文件；校验备份与当前配置。
如果安装后又手动修改过配置，恢复会拒绝覆盖，需要先检查差异。
重复安装会验证并跳过；主题源码变化时先恢复再安装。不要删除 `backups/` 或 `runtime/`。

## 开发与验证

无运行时 npm 依赖；`npm test` 不需要背景素材，也不连接模型或 MCP。
测试覆盖完整 V2 token 树、颜色引用、独立及全局 profile 保留、安装／恢复及失败回退。
真实视觉仍需在终端启动后验收，静态检查不等于所有设备效果保证。

`vendor/opencode-v2.json` 来自官方 2.0.24 源码提交
`32a67d2d0aae927d5cab5a471b43192cbff1199f`；生成器保留完整 `base/dark` 结构。
没有使用 V1 的 `defs/theme` 写法或把终端配置放入 `opencode.jsonc`。

项目结构：`build-theme.cjs`、`themes/`、`install.cjs`、`tools/`、`test/`。
已移除只给 PowerShell 配壁纸的临时方案，集中通过 Terminal 全局默认外观实现。

## 许可与声明

代码采用 [MIT](LICENSE)，保留官方模板原始许可；背景不属于 MIT 范围。
原作署名、素材许可限制与 AI 辅助披露见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
本项目与 OpenCode、DeepSeek、原作者没有官方关联或背书。

官方参考：[CLI Theme](https://opencode.ai/v2/docs/cli/theme)、
[CLI Settings](https://opencode.ai/v2/docs/cli/config)、
[Terminal Appearance](https://learn.microsoft.com/en-us/windows/terminal/customize-settings/profile-appearance)、
[Terminal Themes](https://learn.microsoft.com/en-us/windows/terminal/customize-settings/themes)。
