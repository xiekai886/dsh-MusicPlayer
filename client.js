window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-music",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var react = require("react");
		var react_dom = require("react-dom");
		var h = react.createElement;

		/** Poll interval for the host playback state. */
		var POLL_MS = 2000;
		/** Card width (compact). */
		var WIDTH = 264;
		/** Storage keys. */
		var STORE_COLLAPSED = "dsh-music:collapsed";
		var STORE_X = "dsh-music:x";
		var STORE_Y = "dsh-music:y";

		/** Player chrome styles (compact, draggable, dark frosted-glass). */
		var CSS = [
			"#dsh-music-root{position:fixed;left:0;top:0;z-index:2147483000;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;user-select:none}",
			".dshm-card{width:" + WIDTH + "px;border-radius:18px;overflow:hidden;background:linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03)),rgba(13,15,24,0.62);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);border:1px solid rgba(255,255,255,0.16);box-shadow:0 16px 48px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.18);color:#fff;cursor:default}",
			".dshm-drag{cursor:grab}.dshm-drag:active{cursor:grabbing}",
			".dshm-header{display:flex;align-items:center;gap:10px;padding:6px 10px;position:relative}",
			".dshm-cover{flex:none;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.25),0 4px 12px rgba(0,0,0,0.3);transition:width .35s cubic-bezier(.22,1,.36,1),height .35s cubic-bezier(.22,1,.36,1),border-radius .35s cubic-bezier(.22,1,.36,1),font-size .35s cubic-bezier(.22,1,.36,1)}",
			".dshm-cover-lg{width:48px;height:48px;border-radius:14px;font-size:22px}",
			".dshm-meta{flex:1;min-width:0}",
			".dshm-title{font-size:13px;font-weight:600;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.4);transition:font-size .35s cubic-bezier(.22,1,.36,1),line-height .35s cubic-bezier(.22,1,.36,1)}",
			".dshm-header-mini .dshm-title{font-size:12px;line-height:16px}",
			".dshm-head-actions{position:relative;flex:none;width:92px;height:34px}",
			".dshm-head-group{position:absolute;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:flex-end;gap:4px;opacity:0;pointer-events:none}",
			".dshm-head-group-in{opacity:1;pointer-events:auto}",
			".dshm-head-group-out{opacity:0;pointer-events:none;transition:opacity .18s ease-out}",
			// 视图过渡期间新快照会"冻结"透明度过渡导致闪现；
			// 搜索/折叠键改用 animation + delay，等视图过渡结束后再淡入
			".dshm-vt-fade{animation:dshm-fade-in .28s ease-out .42s both}",
			"@keyframes dshm-fade-in{from{opacity:0}to{opacity:1}}",
			".dshm-play-btn{view-transition-name:dshm-play}",
			".dshm-next-btn{view-transition-name:dshm-next}",
			".dshm-head-group-out .dshm-play-btn,.dshm-head-group-out .dshm-next-btn{view-transition-name:none}",
			".dshm-card:not(.dshm-card-expanded) .dshm-controls .dshm-play-btn,.dshm-card:not(.dshm-card-expanded) .dshm-controls .dshm-next-btn{view-transition-name:none}",
			"::view-transition-group(dshm-play),::view-transition-group(dshm-next){animation-duration:.38s;animation-timing-function:cubic-bezier(.22,1,.36,1)}",
			"::view-transition-old(root),::view-transition-new(root){animation:none}",
			".dshm-artist{font-size:10.5px;line-height:14px;color:rgba(255,255,255,0.78);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px rgba(0,0,0,0.35)}",
			".dshm-btn{flex:none;width:26px;height:26px;border:none;border-radius:9px;background:transparent;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;padding:0;text-shadow:0 1px 3px rgba(0,0,0,0.35)}",
			".dshm-btn:hover{background:rgba(255,255,255,0.18)}",
			".dshm-btn-primary{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,rgba(255,255,255,0.95),rgba(255,255,255,0.7));color:#11131f;box-shadow:0 4px 14px rgba(0,0,0,0.35);font-size:14px}",
			".dshm-btn-primary:hover{filter:brightness(1.05)}",
			".dshm-btn-active{background:rgba(255,255,255,0.24);color:#fff}",
			".dshm-body{padding:4px 12px 12px}",
			".dshm-row{display:flex;align-items:center;gap:8px;margin-top:6px}",
			".dshm-progress{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,0.26);position:relative;cursor:pointer;box-shadow:inset 0 1px 2px rgba(0,0,0,0.25)}",
			".dshm-progress-fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:linear-gradient(90deg,#fff,rgba(255,255,255,0.72));box-shadow:0 0 8px rgba(255,255,255,0.5)}",
			".dshm-time{font-size:10px;color:rgba(255,255,255,0.78);font-variant-numeric:tabular-nums;width:76px;text-align:center;flex:none;text-shadow:0 1px 3px rgba(0,0,0,0.3)}",
			".dshm-slider{flex:1;accent-color:#fff;height:4px;cursor:pointer}",
			".dshm-controls{display:flex;align-items:center;justify-content:center;gap:4px;margin-top:6px}",
			".dshm-search{display:flex;gap:6px;margin-top:6px}",
			".dshm-input{flex:1;min-width:0;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.22);border-radius:10px;color:#fff;font-size:12px;padding:5px 9px;outline:none;backdrop-filter:blur(6px)}",
			".dshm-input:focus{border-color:rgba(255,255,255,0.55);background:rgba(255,255,255,0.18)}",
			".dshm-input::placeholder{color:rgba(255,255,255,0.55)}",
			".dshm-list{max-height:168px;overflow-y:auto;overflow-x:hidden;margin-top:6px;padding-top:5px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.25) transparent}",
			".dshm-list::-webkit-scrollbar{width:4px}.dshm-list::-webkit-scrollbar-track{background:transparent}.dshm-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.22);border-radius:2px}.dshm-list:hover::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.4)}",
			".dshm-item{display:flex;align-items:center;gap:7px;padding:4px 6px;border-radius:9px;cursor:pointer;font-size:11.5px;line-height:15px;color:#fff}",
			".dshm-item:hover{background:rgba(255,255,255,0.16)}",
			".dshm-item-current{background:rgba(255,255,255,0.26);color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.22)}",
			".dshm-item-title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshm-item-sub{flex:none;font-size:9.5px;color:rgba(255,255,255,0.62);max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dshm-item-action{flex:none;border:none;background:transparent;color:rgba(255,255,255,0.72);cursor:pointer;font-size:12px;padding:2px 5px;border-radius:7px}",
			".dshm-item-action:hover{color:#7cffb2;background:rgba(124,255,178,0.15)}",
			".dshm-item-remove:hover{color:#ff8d9a;background:rgba(255,141,154,0.15)}",
			".dshm-error{display:flex;align-items:center;gap:7px;margin-top:8px;padding:7px 10px;border-radius:10px;background:rgba(255,107,107,0.13);border:1px solid rgba(255,107,107,0.28);color:#ffc9cd;font-size:10.5px;line-height:14px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);cursor:pointer;transition:background .15s ease}",
			".dshm-error:hover{background:rgba(255,107,107,0.2)}",
			".dshm-error svg{flex:none;opacity:0.9}",
			".dshm-mode{font-size:10.5px;color:rgba(255,255,255,0.8);text-shadow:0 1px 3px rgba(0,0,0,0.3)}",
			".dshm-empty{font-size:11px;color:rgba(255,255,255,0.66);text-align:center;padding:7px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshm-note{font-size:10px;color:rgba(255,255,255,0.55);margin-top:6px;line-height:14px}",
			".dshm-panel{display:grid;grid-template-rows:0fr;transform:translateY(-10px);pointer-events:none;transition:grid-template-rows .36s cubic-bezier(.22,1,.36,1),transform .36s cubic-bezier(.22,1,.36,1)}",
			".dshm-card-expanded .dshm-panel{grid-template-rows:1fr;transform:translateY(0);pointer-events:auto}",
			".dshm-panel-inner{overflow:hidden;min-height:0}"
		].join("");

		/** Inject the player stylesheet once. */
		function injectCss() {
			if (document.getElementById("dsh-music-css")) return;
			var tag = document.createElement("style");
			tag.id = "dsh-music-css";
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		/** mm:ss formatting. */
		function formatTime(seconds) {
			if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
			var m = Math.floor(seconds / 60);
			var s = Math.floor(seconds % 60);
			return m + ":" + (s < 10 ? "0" : "") + s;
		}

		/** Cover hue for a queue position. */
		function coverStyle(index) {
			return { background: "linear-gradient(135deg, hsl(" + ((index * 47) % 360) + ",62%,52%), hsl(" + (((index * 47) + 60) % 360) + ",62%,38%))" };
		}

		/** Cover art: album image when available, gradient placeholder otherwise. */
		function CoverArt(props) {
			var cls = "dshm-cover" + (props.large ? " dshm-cover-lg" : "");
			if (props.cover) {
				return h("div", {
					className: cls,
					style: { overflow: "hidden", padding: 0 }
				}, h("img", {
					src: props.cover,
					alt: "",
					draggable: false,
					style: { width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "inherit" }
				}));
			}
			return h("div", { className: cls, style: coverStyle(props.index || 0) },
				h("svg", {
					width: props.large ? 26 : 18,
					height: props.large ? 26 : 18,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 2,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					style: { opacity: 0.85 }
				}, [
					h("path", { d: "M9 18V5l12-2v13" }),
					h("circle", { cx: 6, cy: 18, r: 3 }),
					h("circle", { cx: 18, cy: 16, r: 3 })
				]));
		}

		/** Hand-drawn stroke icon set (Feather/Lucide style, currentColor). */
		var ICONS = {
			play: [["polygon", { points: "7 5 18 12 7 19", fill: "currentColor", stroke: "none" }]],
			pause: [
				["rect", { x: 6.5, y: 4.5, width: 3.6, height: 15, rx: 1, fill: "currentColor", stroke: "none" }],
				["rect", { x: 13.9, y: 4.5, width: 3.6, height: 15, rx: 1, fill: "currentColor", stroke: "none" }]
			],
			prev: [
				["polygon", { points: "19 20 9 12 19 4" }],
				["line", { x1: 5, y1: 19, x2: 5, y2: 5 }]
			],
			next: [
				["polygon", { points: "5 4 15 12 5 20" }],
				["line", { x1: 19, y1: 5, x2: 19, y2: 19 }]
			],
			shuffle: [
				["polyline", { points: "16 3 21 3 21 8" }],
				["line", { x1: 4, y1: 20, x2: 21, y2: 3 }],
				["polyline", { points: "21 16 21 21 16 21" }],
				["line", { x1: 15, y1: 15, x2: 21, y2: 21 }],
				["line", { x1: 4, y1: 4, x2: 9, y2: 9 }]
			],
			repeat: [
				["polyline", { points: "17 1 21 5 17 9" }],
				["path", { d: "M3 11V9a4 4 0 0 1 4-4h14" }],
				["polyline", { points: "7 23 3 19 7 15" }],
				["path", { d: "M21 13v2a4 4 0 0 1-4 4H3" }]
			],
			repeatOne: [
				["polyline", { points: "17 1 21 5 17 9" }],
				["path", { d: "M3 11V9a4 4 0 0 1 4-4h14" }],
				["polyline", { points: "7 23 3 19 7 15" }],
				["path", { d: "M21 13v2a4 4 0 0 1-4 4H3" }],
				["path", { d: "M11 10h1v4" }]
			],
			volume: [
				["polygon", { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5" }],
				["path", { d: "M15.54 8.46a5 5 0 0 1 0 7.07" }]
			],
			search: [
				["circle", { cx: 11, cy: 11, r: 8 }],
				["line", { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }]
			],
			import_: [
				["path", { d: "M3 5h13" }],
				["path", { d: "M3 11h13" }],
				["path", { d: "M3 17h7" }],
				["line", { x1: 18, y1: 15, x2: 18, y2: 21 }],
				["line", { x1: 15, y1: 18, x2: 21, y2: 18 }]
			],
			chevronDown: [["polyline", { points: "6 9 12 15 18 9" }]],
			chevronUp: [["polyline", { points: "6 15 12 9 18 15" }]],
			arrowLeft: [
				["line", { x1: 19, y1: 12, x2: 5, y2: 12 }],
				["polyline", { points: "12 19 5 12 12 5" }]
			],
			plus: [
				["line", { x1: 12, y1: 5, x2: 12, y2: 19 }],
				["line", { x1: 5, y1: 12, x2: 19, y2: 12 }]
			],
			close: [
				["line", { x1: 18, y1: 6, x2: 6, y2: 18 }],
				["line", { x1: 6, y1: 6, x2: 18, y2: 18 }]
			],
			restore: [
				["polyline", { points: "1 4 1 10 7 10" }],
				["path", { d: "M3.51 15a9 9 0 1 0 2.13-9.36L1 10" }]
			],
			alert: [
				["path", { d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }],
				["line", { x1: 12, y1: 9, x2: 12, y2: 13 }],
				["line", { x1: 12, y1: 17, x2: 12.01, y2: 17 }]
			]
		};

		/** Render one named icon as an inline SVG. */
		function Icon(props) {
			return h("svg", {
				width: props.size || 14,
				height: props.size || 14,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: props.thin ? 1.8 : 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				style: { display: "block", flex: "none" }
			}, (ICONS[props.name] || []).map(function (part) {
				return h(part[0], part[1]);
			}));
		}

		/** Resolve a possibly-relative track URL against the page origin. */
		function resolveUrl(url) {
			try { return new URL(url, location.href).href; } catch { return url; }
		}

		/** Fetch the current host state. */
		function fetchState() {
			return fetch("/dsh-music/state", { cache: "no-store" }).then(function (res) {
				if (!res.ok) throw new Error("state " + res.status);
				return res.json();
			});
		}

		/** Post a player intent; resolves to the applied state. */
		function postCommand(command) {
			return fetch("/dsh-music/command", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(command)
			}).then(function (res) {
				return res.json();
			});
		}

		/** Search NetEase Cloud Music through the host proxy. */
		function neteaseSearch(query) {
			return fetch("/dsh-music/netease/search?q=" + encodeURIComponent(query), { cache: "no-store" })
				.then(function (res) { return res.json(); });
		}

		/**
		 * The floating player. Compact and draggable: the mini bar
		 * collapses into a card with progress, volume, modes, the queue, and a
		 * NetEase Cloud Music search panel.
		 */
		function MusicPlayer() {
			var audioRef = react.useRef(null);
			var lastRef = react.useRef({ key: "", index: -1, playing: false });
			var posRef = react.useRef(null); // {x, y} | null = default bottom-right
			var dragRef = react.useRef(null);
			var suppressClickRef = react.useRef(false);
			var [remote, setRemote] = react.useState(null);
			var [pos, setPos] = react.useState(null);
			var [collapsed, setCollapsed] = react.useState(function () {
				try { return localStorage.getItem(STORE_COLLAPSED) === "1"; } catch { return false; }
			});
			var [current, setCurrent] = react.useState(0);
			var [duration, setDuration] = react.useState(0);
			var [error, setError] = react.useState(null);
			var [searchMode, setSearchMode] = react.useState(false);
			var [searchQuery, setSearchQuery] = react.useState("");
			var [searching, setSearching] = react.useState(false);
			var [results, setResults] = react.useState(null);
			var [searchError, setSearchError] = react.useState(null);
			var [playlistDraft, setPlaylistDraft] = react.useState("");

			// Restore the saved position, or fall back to the bottom-right corner.
			var restorePos = function () {
				try {
					var x = localStorage.getItem(STORE_X);
					var y = localStorage.getItem(STORE_Y);
					if (x !== null && y !== null) {
						var p = { x: Number(x), y: Number(y) };
						if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
							posRef.current = p;
							setPos(p);
							return;
						}
					}
				} catch { /* ignore */ }
				posRef.current = null;
				setPos(null);
			};
			react.useEffect(restorePos, []);

			// Keep the card inside the viewport (height changes when collapsing).
			react.useEffect(function () {
				var height = collapsed ? 52 : 440;
				var p = posRef.current;
				if (p) {
					var clamped = {
						x: Math.max(4, Math.min(window.innerWidth - WIDTH - 4, p.x)),
						y: Math.max(4, Math.min(window.innerHeight - height - 4, p.y))
					};
					if (clamped.x !== p.x || clamped.y !== p.y) {
						posRef.current = clamped;
						setPos(clamped);
					}
				}
			}, [collapsed]);

			// Consecutive failed tracks before we stop auto-skipping.
			var errorSkipRef = react.useRef(0);
			// Timestamp of the last explicit user action; failures right after a
			// user gesture must NOT auto-skip (respect the user's intent).
			var lastUserOpRef = react.useRef(0);

			// Own the audio element for the component lifetime.
			react.useEffect(function () {
				var audio = new Audio();
				audio.preload = "auto";
				audio.volume = 0.8;
				audioRef.current = audio;
				var onTime = function () { setCurrent(audio.currentTime); };
				var onMeta = function () { setDuration(audio.duration || 0); };
				var onEnded = function () {
					postCommand({ action: "ended" }).then(function (state) {
						if (state && state.queue) {
							setRemote(state);
							applyStateToAudio(state);
						}
					}).catch(function () {});
				};
				var onPlaying = function () { errorSkipRef.current = 0; };
				var onError = function () {
					// Reset the element so a bad source cannot wedge future play() calls.
					audio.removeAttribute("src");
					audio.load();
					var count = errorSkipRef.current;
					var recentUserOp = Date.now() - lastUserOpRef.current < 3000;
					if (!recentUserOp && count < 3 && lastRef.current.playing) {
						// Auto-skip only during unattended playback (e.g. one dead
						// VIP track in the middle of a queue); never right after a
						// user click, or the player would seem to hijack gestures.
						errorSkipRef.current = count + 1;
						setError(null);
						postCommand({ action: "next" }).then(function (state) {
							if (state && state.queue) {
								setRemote(state);
								applyStateToAudio(state);
							}
						}).catch(function () {});
					} else {
						errorSkipRef.current = 0;
						setError("播放失败：音频源不可达或格式不支持");
					}
				};
				audio.addEventListener("timeupdate", onTime);
				audio.addEventListener("loadedmetadata", onMeta);
				audio.addEventListener("ended", onEnded);
				audio.addEventListener("playing", onPlaying);
				audio.addEventListener("error", onError);
				return function () {
					audio.pause();
					audio.removeEventListener("timeupdate", onTime);
					audio.removeEventListener("loadedmetadata", onMeta);
					audio.removeEventListener("ended", onEnded);
					audio.removeEventListener("playing", onPlaying);
					audio.removeEventListener("error", onError);
				};
			}, []);

			// Ask the audio element to play the current track, healing a wedged
			// or errored source before retrying.
			var tryPlay = function (state) {
				var audio = audioRef.current;
				if (!audio) return;
				var track = state.queue[state.index];
				if (track) {
					var url = resolveUrl(track.url);
					if (audio.src !== url || audio.error) {
						audio.src = url;
						setCurrent(0);
						setDuration(0);
					}
				}
				audio.play().catch(function (err) {
					if (err && err.name === "NotAllowedError") setError("浏览器拦截了自动播放，点一下播放按钮即可");
					else setError("播放失败：音频源不可达或格式不支持");
				});
			};

			// Apply one host state snapshot to the audio element (idempotent diff).
			var applyStateToAudio = function (state) {
				var audio = audioRef.current;
				if (!audio) return;
				var key = state.queue.map(function (t) { return t.id; }).join("|");
				var last = lastRef.current;
				if (key !== last.key || state.index !== last.index) {
					last.key = key;
					last.index = state.index;
					last.playing = state.playing;
					var track = state.queue[state.index];
					if (track) {
						var url = resolveUrl(track.url);
						if (audio.src !== url) {
							audio.src = url;
							setCurrent(0);
							setDuration(0);
							setError(null);
						}
						if (state.playing) tryPlay(state);
						else audio.pause();
					}
				} else if (state.playing !== last.playing) {
					last.playing = state.playing;
					if (state.playing) tryPlay(state);
					else audio.pause();
				}
				if (Math.abs(audio.volume - state.volume) > 0.01) audio.volume = state.volume;
			};

			// Poll the host state and apply diffs to the audio element.
			react.useEffect(function () {
				var alive = true;
				var poll = function () {
					fetchState().then(function (state) {
						if (!alive) return;
						setRemote(state);
						applyStateToAudio(state);
					}).catch(function () { /* host restarting */ });
				};
				poll();
				var timer = setInterval(poll, POLL_MS);
				return function () { alive = false; clearInterval(timer); };
			}, []);

			// Error toast auto-dismisses after a few seconds.
			react.useEffect(function () {
				if (!error) return;
				var timer = setTimeout(function () { setError(null); }, 6000);
				return function () { clearTimeout(timer); };
			}, [error]);

			// ── drag to reposition ─────────────────────────────────────────────
			var startDrag = function (event) {
				if (event.button !== 0) return;
				dragRef.current = {
					startX: event.clientX,
					startY: event.clientY,
					origX: posRef.current ? posRef.current.x : null,
					origY: posRef.current ? posRef.current.y : null,
					moved: false
				};
				window.addEventListener("mousemove", onDragMove);
				window.addEventListener("mouseup", onDragUp);
			};
			var onDragMove = function (event) {
				var drag = dragRef.current;
				if (!drag) return;
				var dx = event.clientX - drag.startX;
				var dy = event.clientY - drag.startY;
				if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
				drag.moved = true;
				var height = collapsed ? 52 : 440;
				var baseX = drag.origX !== null ? drag.origX : window.innerWidth - WIDTH - 18;
				var baseY = drag.origY !== null ? drag.origY : window.innerHeight - height - 18;
				var x = Math.max(4, Math.min(window.innerWidth - WIDTH - 4, baseX + dx));
				var y = Math.max(4, Math.min(window.innerHeight - height - 4, baseY + dy));
				posRef.current = { x: x, y: y };
				setPos({ x: x, y: y });
			};
			var onDragUp = function () {
				var drag = dragRef.current;
				dragRef.current = null;
				window.removeEventListener("mousemove", onDragMove);
				window.removeEventListener("mouseup", onDragUp);
				if (drag && drag.moved) {
					suppressClickRef.current = true;
					try {
						localStorage.setItem(STORE_X, String(posRef.current.x));
						localStorage.setItem(STORE_Y, String(posRef.current.y));
					} catch { /* ignore */ }
				}
			};
			var handleClick = function (handler) {
				return function (event) {
					if (suppressClickRef.current) {
						suppressClickRef.current = false;
						return;
					}
					handler(event);
				};
			};

			// Keep the queue list's wheel scrolling from bleeding into the page:
			// at the edges, swallow the gesture instead of scrolling the document.
			var stopListWheel = function (event) {
				var el = event.currentTarget;
				if (el.scrollHeight <= el.clientHeight + 1) return;
				var atTop = el.scrollTop <= 0;
				var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
				if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
					event.preventDefault();
				}
			};

			// FLIP shared play/next buttons between the header and the controls row:
			// Shared play/next buttons between the header and the controls row.
			// Preferred: the View Transitions API (browser-native same-element
			// cross-position transition). Fallback: manual FLIP.
			var playFlipRef = react.useRef(null);
			var nextFlipRef = react.useRef(null);
			var flipFromRef = react.useRef(null);

			var toggleCollapsed = function () {
				// Record the old button rects for the manual-FLIP fallback.
				var p = playFlipRef.current;
				var n = nextFlipRef.current;
				flipFromRef.current = {
					play: p ? p.getBoundingClientRect() : null,
					next: n ? n.getBoundingClientRect() : null
				};
				var apply = function () {
					setCollapsed(function (prev) {
						var next = !prev;
						try { localStorage.setItem(STORE_COLLAPSED, next ? "1" : "0"); } catch { /* ignore */ }
						return next;
					});
				};
				if (document.startViewTransition && react_dom.flushSync) {
					// Let the browser cross-fade/move the named view (play/next buttons)
					// between their two DOM locations; flushSync forces the React DOM
					// commit before the view snapshot is taken.
					document.startViewTransition(function () {
						react_dom.flushSync(apply);
					});
				} else {
					apply();
				}
			};

			// Manual FLIP fallback (used when View Transitions is unavailable):
			// animate the newly rendered buttons from the recorded old positions.
			// The transform reset MUST happen on the next frame (rAF), otherwise
			// the browser only ever paints the final frame and no motion occurs.
			react.useLayoutEffect(function () {
				var from = flipFromRef.current;
				flipFromRef.current = null;
				if (!from) return;
				var fly = function (el, fromRect) {
					if (!el || !fromRect) return;
					var to = el.getBoundingClientRect();
					var dx = fromRect.left - to.left;
					var dy = fromRect.top - to.top;
					var sx = fromRect.width / to.width;
					var sy = fromRect.height / to.height;
					el.style.transition = "none";
					el.style.transform = "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")";
					void el.getBoundingClientRect(); // commit the initial frame
					requestAnimationFrame(function () {
						el.style.transition = "transform .38s cubic-bezier(.22,1,.36,1)";
						el.style.transform = "";
					});
				};
				fly(playFlipRef.current, from.play);
				fly(nextFlipRef.current, from.next);
			}, [collapsed]);
			var run = function (command) {
				lastUserOpRef.current = Date.now();
				postCommand(command).then(function (state) {
					if (state && state.queue) {
						setRemote(state);
						applyStateToAudio(state);
					}
				}).catch(function () { setError("播放器服务连接失败，稍后重试"); });
			};
			// ── draggable progress bar ─────────────────────────────────────────
			var progressRef = react.useRef(null);
			var draggingRef = react.useRef(false);
			var [dragRatio, setDragRatio] = react.useState(null);

			// Seek to a 0..1 position; only meaningful when the duration is finite
			// (the host proxy now serves Range requests, so streamed tracks have
			// a real duration instead of Infinity).
			var seekTo = function (ratio) {
				var audio = audioRef.current;
				if (audio && Number.isFinite(duration) && duration > 0) {
					audio.currentTime = ratio * duration;
				}
			};
			var progressRatio = function (event, el) {
				var rect = (el || event.currentTarget).getBoundingClientRect();
				return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
			};
			var onProgressMove = function (event) {
				var el = progressRef.current;
				if (!el || !draggingRef.current) return;
				var ratio = progressRatio(event, el);
				setDragRatio(ratio);
				seekTo(ratio);
			};
			var onProgressUp = function () {
				draggingRef.current = false;
				setDragRatio(null);
				window.removeEventListener("mousemove", onProgressMove);
				window.removeEventListener("mouseup", onProgressUp);
			};
			var onProgressDown = function (event) {
				if (event.button !== 0) return;
				draggingRef.current = true;
				var ratio = progressRatio(event);
				setDragRatio(ratio);
				seekTo(ratio);
				window.addEventListener("mousemove", onProgressMove);
				window.addEventListener("mouseup", onProgressUp);
			};
			var volume = function (event) {
				var value = Number(event.target.value);
				if (audioRef.current) audioRef.current.volume = value;
				run({ action: "volume", volume: value });
			};
			var cycleMode = function () {
				var order = { list: "single", single: "shuffle", shuffle: "list" };
				var mode = remote ? (order[remote.mode] || "list") : "list";
				run({ action: "mode", mode: mode });
			};
			var doSearch = function () {
				var query = searchQuery.trim();
				if (!query) return;
				setSearching(true);
				setSearchError(null);
				setResults(null);
				neteaseSearch(query).then(function (data) {
					setSearching(false);
					if (data.error) {
						setSearchError(String(data.error));
						setResults([]);
						return;
					}
					setResults(data.songs || []);
				}).catch(function () {
					setSearching(false);
					setSearchError("搜索失败（网络或服务问题）");
					setResults([]);
				});
			};
			var addNetease = function (song) {
				run({
					action: "add",
					url: "/dsh-music/netease/stream?id=" + encodeURIComponent(song.id),
					title: song.name + " - " + song.artist
				});
			};
			var importPlaylist = function () {
				var raw = playlistDraft.trim();
				var match = /(\d+)/.exec(raw);
				if (!raw || !match) {
					setSearchError("请输入歌单 id 或分享链接");
					return;
				}
				run({ action: "importPlaylist", id: match[1], clear: true });
				setPlaylistDraft("");
				setSearchMode(false);
				setResults(null);
				setSearchError(null);
			};

			var track = remote && remote.queue[remote.index] ? remote.queue[remote.index] : null;
			var modeLabel = { list: "列表循环", single: "单曲循环", shuffle: "随机播放" };
			var modeIcon = { list: "repeat", single: "repeatOne", shuffle: "shuffle" };
			var cardStyle = pos
				? { position: "fixed", left: pos.x, top: pos.y }
				: { position: "fixed", right: 18, bottom: 18 };
			var height = collapsed ? 52 : 440;

			var expanded = !collapsed;
			return h("div", { style: cardStyle }, h("div", { className: "dshm-card" + (expanded ? " dshm-card-expanded" : "") }, [
				// 共享头部：封面/歌名/歌手在同一节点上做非线性尺寸过渡，
				// 两种形态的按钮组交叉淡入淡出
				h("div", {
					className: "dshm-header dshm-drag" + (collapsed ? " dshm-header-mini" : ""),
					onMouseDown: startDrag,
					onClick: collapsed ? handleClick(toggleCollapsed) : void 0
				}, [
					h(CoverArt, { cover: track ? track.cover : "", index: remote ? remote.index : 0, large: expanded }),
					h("div", { className: "dshm-meta" }, [
						h("div", { className: "dshm-title" }, track ? track.title : (expanded ? "未在播放" : "音乐播放器")),
						h("div", { className: "dshm-artist" }, track ? track.artist : (expanded ? "点一首歌开始吧" : "点击展开"))
					]),
					h("div", { className: "dshm-head-actions" }, [
						// 折叠态按钮组：播放 / 下一首 / 展开（切换时 FLIP 飞到面板控制行）
						h("div", { className: "dshm-head-group" + (expanded ? " dshm-head-group-out" : " dshm-head-group-in"), key: "mini" }, [
							h("button", {
								ref: playFlipRef,
								className: "dshm-btn dshm-btn-primary dshm-play-btn",
								title: remote && remote.playing ? "暂停" : "播放",
								onClick: handleClick(function (event) {
									event.stopPropagation();
									run({ action: remote && remote.playing ? "pause" : "play" });
								})
							}, h(Icon, { name: remote && remote.playing ? "pause" : "play", size: 14 })),
							h("button", {
								ref: nextFlipRef,
								className: "dshm-btn dshm-next-btn",
								title: "下一首",
								onClick: handleClick(function (event) {
									event.stopPropagation();
									run({ action: "next" });
								})
							}, h(Icon, { name: "next", size: 14 })),
							h("button", {
								className: "dshm-btn",
								title: "展开播放器",
								onClick: handleClick(function (event) {
									event.stopPropagation();
									toggleCollapsed();
								})
							}, h(Icon, { name: "chevronDown", size: 14 }))
						]),
						// 展开态按钮组：搜索切换 / 折叠（视图过渡结束后淡入）
						h("div", { className: "dshm-head-group" + (expanded ? " dshm-head-group-in" : " dshm-head-group-out"), key: "full" }, [
							h("button", {
								className: "dshm-btn dshm-vt-fade",
								title: searchMode ? "返回播放列表" : "搜索网易云音乐",
								onClick: handleClick(function (event) {
									event.stopPropagation();
									setSearchMode(function (prev) {
										if (!prev) { setSearchQuery(""); setResults(null); setSearchError(null); }
										return !prev;
									});
								})
							}, h(Icon, { name: searchMode ? "arrowLeft" : "search", size: 14 })),
							h("button", {
								className: "dshm-btn dshm-vt-fade",
								title: "折叠",
								onClick: handleClick(function (event) {
									event.stopPropagation();
									toggleCollapsed();
								})
							}, h(Icon, { name: "chevronUp", size: 14 }))
						])
					])
				]),
				// 展开面板：grid 行高非线性动画展开/收起
				h("div", { className: "dshm-panel" }, h("div", { className: "dshm-panel-inner" }, [
					h("div", { className: "dshm-body" }, [
						h("div", { className: "dshm-row" }, [
							h("div", {
								className: "dshm-progress",
								ref: progressRef,
								onMouseDown: onProgressDown,
								title: "拖动调整播放进度"
							}, h("div", {
								className: "dshm-progress-fill",
								style: {
									width: (dragRatio !== null
										? dragRatio * 100
										: duration > 0 ? Math.min(100, current / duration * 100) : 0) + "%"
								}
							})),
							h("span", { className: "dshm-time" }, formatTime(current) + " / " + formatTime(duration))
						]),
						h("div", { className: "dshm-controls" }, [
							h("button", { className: "dshm-btn", title: "上一首", onClick: handleClick(function () { run({ action: "prev" }); }) }, h(Icon, { name: "prev", size: 15 })),
							h("button", {
								ref: playFlipRef,
								className: "dshm-btn dshm-btn-primary dshm-play-btn",
								title: remote && remote.playing ? "暂停" : "播放",
								onClick: handleClick(function () { run({ action: remote && remote.playing ? "pause" : "play" }); })
							}, h(Icon, { name: remote && remote.playing ? "pause" : "play", size: 16 })),
							h("button", {
								ref: nextFlipRef,
								className: "dshm-btn dshm-next-btn",
								title: "下一首",
								onClick: handleClick(function () { run({ action: "next" }); })
							}, h(Icon, { name: "next", size: 15 })),
							h("button", {
								className: "dshm-btn" + (remote && remote.mode !== "list" ? " dshm-btn-active" : ""),
								title: "切换模式：" + modeLabel[remote ? remote.mode : "list"],
								onClick: handleClick(cycleMode)
							}, h(Icon, { name: modeIcon[remote ? remote.mode : "list"], size: 14 }))
						]),
						h("div", { className: "dshm-row" }, [
							h("span", { style: { display: "flex", flex: "none" } }, h(Icon, { name: "volume", size: 13 })),
							h("input", {
								type: "range",
								className: "dshm-slider",
								min: 0,
								max: 1,
								step: 0.02,
								value: remote ? remote.volume : 0.8,
								onChange: volume
							}),
							h("span", { className: "dshm-mode" }, modeLabel[remote ? remote.mode : "list"])
						]),
						searchMode
							? [
								h("div", { className: "dshm-search" }, [
									h("input", {
										className: "dshm-input",
										placeholder: "网易云歌单链接或 id",
										title: "粘贴网易云歌单链接或 id，回车导入",
										value: playlistDraft,
										onChange: function (event) { setPlaylistDraft(event.target.value); },
										onKeyDown: function (event) { if (event.key === "Enter") importPlaylist(); }
									}),
									h("button", {
										className: "dshm-btn dshm-btn-primary",
										title: "导入歌单（替换默认歌单）",
										onClick: handleClick(importPlaylist)
									}, h(Icon, { name: "import_", size: 13 }))
								]),
								h("div", { className: "dshm-search" }, [
									h("input", {
										className: "dshm-input",
										placeholder: "歌名或歌手，回车搜索",
										title: "输入歌名或歌手，回车搜索",
										value: searchQuery,
										onChange: function (event) { setSearchQuery(event.target.value); },
										onKeyDown: function (event) { if (event.key === "Enter") doSearch(); }
									}),
									h("button", {
										className: "dshm-btn dshm-btn-primary",
										title: "搜索",
										disabled: searching,
										onClick: handleClick(doSearch)
									}, h(Icon, { name: "search", size: 13 }))
								]),
								h("div", { className: "dshm-list", onWheel: stopListWheel },
									searching
										? h("div", { className: "dshm-empty" }, "搜索中…")
										: results === null
											? null
											: results.length === 0
												? h("div", { className: "dshm-empty" }, searchError || "没有搜索结果")
												: results.map(function (song) {
													return h("div", {
														className: "dshm-item",
														key: song.id,
														onClick: handleClick(function () { addNetease(song); })
													}, [
														h("span", { className: "dshm-item-title" }, song.name + " - " + song.artist),
														h("span", { className: "dshm-item-sub" }, song.durationMs ? formatTime(song.durationMs / 1000) : ""),
														h("button", {
															className: "dshm-item-action",
															title: "加入播放列表",
															onClick: function (event) {
																event.stopPropagation();
																addNetease(song);
															}
														}, h(Icon, { name: "plus", size: 12 }))
													]);
												})
								),
								h("div", { className: "dshm-note" }, "受版权/VIP 限制的歌曲可能无法播放")
							]
							: [
								h("div", { className: "dshm-list", onWheel: stopListWheel },
									remote && remote.queue.length === 0
										? h("div", { className: "dshm-empty" }, "播放列表为空")
										: remote && remote.queue.map(function (item, i) {
											return h("div", {
												className: "dshm-item" + (i === remote.index ? " dshm-item-current" : ""),
												key: item.id + "-" + i,
												onClick: handleClick(function () { run({ action: "play", index: i }); })
											}, [
												h("span", { className: "dshm-item-title" }, item.title),
												h("span", { className: "dshm-item-sub" }, item.artist),
												h("button", {
													className: "dshm-item-action dshm-item-remove",
													title: "移除",
													onClick: function (event) {
														event.stopPropagation();
														run({ action: "remove", index: i });
													}
												}, h(Icon, { name: "close", size: 10 }))
											]);
										})
								),
								remote && !remote.builtin
									? h("div", {
										className: "dshm-empty",
										style: { cursor: "pointer", color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 },
										title: "恢复默认歌单",
										onClick: handleClick(function () { run({ action: "builtin", enable: true }); })
									}, [h(Icon, { name: "restore", size: 11 }), "恢复默认歌单"])
									: null
							],
						error ? h("div", {
							className: "dshm-error",
							title: "点击关闭",
							onClick: handleClick(function () { setError(null); })
						}, [h(Icon, { name: "alert", size: 12 }), h("span", null, error)]) : null
					])
				])
			)]));
		}

		/**
		 * Client plugin entry: mount the floating player and its stylesheet.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(function () {
				var root = document.createElement("div");
				root.id = "dsh-music-root";
				document.body.appendChild(root);
				injectCss();
				react_dom.render(h(MusicPlayer), root);
				return function () {
					react_dom.unmountComponentAtNode(root);
					if (root.parentNode) root.parentNode.removeChild(root);
				};
			});
		}

		var inject = [];
		exports.apply = apply;
		exports.inject = inject;
		exports.name = "dsh-music";
		return module.exports;
	}
});
