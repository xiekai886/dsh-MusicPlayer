# dsh-MusicPlayer 🎵

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

**这是一个可以让你边对话边听歌的 DeepSeek Harness 插件**，具有折叠和展开两种可自由拖动的悬浮窗口形态，利用 Meting API 等解析源接入网易云音乐，支持网易云歌单导入和按歌名或歌手搜索单曲导入。

An animated floating music player plugin for DeepSeek Harness Web with a collapsible/expandable draggable frosted-glass card, deep NetEase Cloud Music integration (playlist import by link/ID, search by title/artist), a multi-layer audio source resolver (Meting → outer/url) that works around browser CORS and anti-leeching for maximum playable coverage, and an agent-facing music tool — queue, skip, pause, and control volume right from the chat. Zero external front-end dependencies.

## Features

- **悬浮播放器**：右下角深色毛玻璃小卡片，**可拖动记忆位置**，展开/收起带物理曲线动画；播放/暂停、上下首、可点进度条、音量、列表循环/单曲循环/随机、播放列表
- **网易云音乐接入**：一键**导入/切换歌单**（粘贴链接或 id）、**搜索单曲**（搜索 + 加入）；host 端代理搜索/歌单/音频流，绕过浏览器跨域与防盗链，支持解析 Meting 同源地址（能播 VIP 试听/下架类歌曲）
- **默认曲库可配置**：通过环境变量 `DSH_MUSIC_PLAYLIST` 指定歌单 id，启动时自动加载为内置曲库（未配置则播放列表为空，可在播放器内手动导入）
- **agent 音乐工具**：对模型说"放首歌 / 把我的歌单放进去"即可——`music` 工具支持播放指定歌曲（本地无匹配自动搜网易云）、导入歌单、搜索、切歌、暂停、调音量、切模式、恢复/隐藏默认歌单、查看/添加/移除队列
- **状态同步**：浏览器播放器与 host 状态机通过 REST 同步（`/dsh-music/state` 轮询 + `/dsh-music/command` 控制），无持久化，每次启动全新加载默认曲库
- **零外部前端依赖**：播放器为手写 `__ModuleLoader__` 格式，内联 SVG 图标，不依赖 CDN

## Install

需要 [DSH CLI](https://github.com/deepseek-ai/deepseek-harness) 与 pnpm：

```sh
dsh plugin --profile web add "github:你的用户名/dsh-music"
# 重启 dsh web（dsh --profile web）后生效，页面右下角出现 🎵 播放器
```

源码本地开发调试也可以：

```sh
dsh plugin --profile web add "file:/path/to/dsh-music"
```

## 配置默认歌单

播放器启动时自动加载的内置曲库来自网易云歌单，通过环境变量配置：

```sh
# 例如把默认曲库设为歌单 13060319975
set DSH_MUSIC_PLAYLIST=13060319975
dsh --profile web
```

未设置时播放列表为空，可打开播放器 🔍 手动导入歌单。

## 可选：登录态解锁全曲（含 VIP）

默认匿名解析下，网易云对免费歌曲返回全曲、对受限/VIP 歌曲只返回 30 秒试听。若希望受限歌曲也能播放完整音频，可配置你自己的网易云登录 cookie（含 `MUSIC_U`）：

```sh
# 从浏览器网易云登录态中复制 MUSIC_U=...（和必要 cookie）拼成 Cookie 串
set DSH_MUSIC_COOKIE=MUSIC_U=xxxx;__csrf=xxxx
dsh --profile web
```

配置后插件将通过官方 weapi 协议携带该登录态解析播放地址（有对应权益的歌曲返回完整音频）。Cookie 仅保存在本机环境变量中，不会上传到任何第三方。未配置时自动回退匿名解析。

> ⚠️ 仅用于个人使用；账号权益以网易云实际返回为准。

## Usage

- 点右下角 🎵 卡片展开播放器；拖动卡片顶部任意位置可移动（位置自动记忆）；点右上角箭头展开/收起（带动画）
- 点 🔍 进入网易云搜索：输入歌名/歌手回车搜索，点 + 加入播放列表
- 第一行输入框粘贴网易云歌单链接或 id，回车一键导入（替换当前曲库）
- 对话里直接说「放首歌 / 放一首周杰伦的晴天 / 导入我的歌单 / 下一首 / 暂停 / 随机播放 / 音量调到 50%」，agent 会调用 `music` 工具控制播放器

## 免责声明

- 本项目与 DeepSeek、网易云音乐无关；音频来自网易云公开接口与第三方 Meting 解析服务，仅供学习交流
- 受版权/VIP 限制的歌曲可能无法播放
- `music` 工具与 UI 的操作均在本地 DSH 实例内完成

## Structure

- `index.js` — host 端：状态机、REST API（state / command / netease search / playlist / stream）、`music` 工具、多层音频源解析（Meting → outer/url）
- `client.js` — 浏览器端：悬浮播放器（手写 `__ModuleLoader__` 格式，内联 SVG 图标，零外部依赖）
- `cordis.patch.yml` — bundle 层声明

## Uninstall

```sh
dsh plugin --profile web remove @dsh-external/dsh-music
```

## License

[MIT](LICENSE)
