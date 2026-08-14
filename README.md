# dsh-music 🎵

**dsh-music** 是一款面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 的 APlayer 风格悬浮音乐播放器插件，支持折叠/展开双形态与自由拖拽定位。深度接入网易云音乐：按链接或 ID 导入歌单、按歌名/歌手搜索单曲一键加入播放列表；多层音频源解析（Meting → outer/url）绕开浏览器跨域与防盗链，最大化可播放曲目覆盖（含部分受限歌曲，实际可播性取决于版权状态与解析源）。内置 agent 音乐工具，对话中即可点歌、切歌、控制音量。零外部前端依赖——手写模块格式与内联 SVG 图标。

An APlayer-inspired floating music player plugin for DeepSeek Harness Web with a collapsible/expandable draggable frosted-glass card, deep NetEase Cloud Music integration (playlist import by link/ID, search by title/artist), a multi-layer audio source resolver (Meting → outer/url) that works around browser CORS and anti-leeching for maximum playable coverage, and an agent-facing music tool — queue, skip, pause, and control volume right from the chat. Zero external front-end dependencies.

## Features

- **悬浮播放器**：右下角深色毛玻璃小卡片，**可拖动记忆位置**，展开/收起带物理曲线动画；播放/暂停、上下首、可点进度条、音量、列表循环/单曲循环/随机、播放列表
- **网易云音乐接入**：一键**导入/切换歌单**（粘贴链接或 id）、**搜索单曲**（搜索 + 加入）；host 端代理搜索/歌单/音频流，绕过浏览器跨域与防盗链，支持解析 Meting 同源地址（能播 VIP 试听/下架类歌曲）
- **默认曲库可配置**：通过环境变量 `DSH_MUSIC_PLAYLIST` 指定歌单 id，启动时自动加载为内置曲库（未配置则使用内置 SoundHelix 离线兜底曲目）
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

未设置时内置曲库为 SoundHelix 免费示例曲目（离线兜底）。

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
