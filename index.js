/**
 * @dsh-external/dsh-music — host half.
 *
 * Owns the playback state machine (queue, index, playing, volume, mode),
 * exposes it to the browser player over REST routes on the web server, and
 * gives the agent a `music` tool so the model can queue songs, skip, pause,
 * and adjust volume while chatting.
 *
 * No persistence by design: every load starts fresh, and the default library
 * is the configured NetEase Cloud Music playlist, fetched at startup (with a
 * built-in offline fallback). The browser player polls `/dsh-music/state` and
 * posts intents to `/dsh-music/command`; tool calls mutate the same state.
 *
 * @module
 */
import { defineTool } from "@deepseek-ai/dsh-tools";
import { createCipheriv, createPublicKey, publicEncrypt, randomBytes } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

export const name = "dsh-music";
export const inject = ["webServer", "tools"];

/** Fake browser identity for NetEase Cloud Music public endpoints. */
const NET_EASE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const NET_EASE_REFERER = "https://music.163.com/";
const NET_EASE_COOKIE = "NMTID=00Kf3uH0LvXq0vXq0vXq0vXq0vXq0vXq";
/** Optional logged-in NetEase cookie (e.g. MUSIC_U=...) that unlocks full tracks. */
const DSH_MUSIC_COOKIE = process.env.DSH_MUSIC_COOKIE ?? "";
/** Optional cloud proxy base (e.g. http://1.2.3.4:3000/<token>): when set, VIP
 *  full tracks are resolved through the cloud proxy (eapi + VIP session). */
const DSH_MUSIC_API = process.env.DSH_MUSIC_API ?? "";

/** weapi (official app protocol) crypto constants. */
const WEAPI_MODULUS = "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7";
const WEAPI_IV = "0102030405060708";
const WEAPI_PRESET = "0CoJUm6Qyw8W8jud";
/** A streamable NetEase track URL served by this plugin. */
const neteaseStreamUrl = (id) => `/dsh-music/netease/stream?id=${encodeURIComponent(id)}`;

/**
 * The built-in library is a NetEase Cloud Music playlist, configured through
 * the DSH_MUSIC_PLAYLIST environment variable (a playlist id or share link).
 * On startup the plugin loads it as the default queue; without a configured
 * playlist the queue starts empty and can be filled via the player UI or the
 * agent tool.
 */
const DEFAULT_PLAYLIST_ID = process.env.DSH_MUSIC_PLAYLIST ?? "";

/** Built-in default tracks: filled from the configured playlist at startup. */
let BUILTIN_TRACKS = [];

/** Refresh the built-in library from the configured playlist. */
async function refreshBuiltinTracks() {
	if (DEFAULT_PLAYLIST_ID === "") return;
	try {
		const playlist = await neteasePlaylist(DEFAULT_PLAYLIST_ID);
		if (playlist.tracks.length === 0) return;
		BUILTIN_TRACKS = playlist.tracks.map((row) => ({
			id: `netease-${row.id}`,
			title: row.name,
			artist: row.artist,
			cover: row.cover,
			url: neteaseStreamUrl(row.id)
		}));
	} catch {
		/* keep the empty queue; the player can still import playlists manually */
	}
}

/** Playback modes. */
const MODES = ["list", "single", "shuffle"];

/** Clamp a number into [0, 1]. */
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

/** Compose the queue: built-ins first (when enabled), then session custom tracks. */
function composeQueue(custom, useBuiltin) {
	return [...(useBuiltin ? BUILTIN_TRACKS : []), ...custom];
}

/** Fresh state on every load: no persistence, the default library is the playlist. */
function defaultState() {
	return {
		queue: [...BUILTIN_TRACKS],
		index: 0,
		playing: false,
		volume: 0.8,
		mode: "list",
		custom: [],
		useBuiltin: true,
		version: 1
	};
}

/** Write the client-facing subset of the state. */
function publicState(state) {
	return {
		queue: state.queue.map(({ id, title, artist, url, cover }) => ({ id, title, artist, url, cover })),
		index: state.index,
		playing: state.playing,
		volume: state.volume,
		mode: state.mode,
		builtin: state.useBuiltin,
		version: state.version
	};
}

/** Apply one command intent to the state machine. */
async function applyCommand(state, command) {
	const { action } = command;
	const len = state.queue.length;
	switch (action) {
		case "play": {
			const target = Number(command.index);
			if (Number.isInteger(target) && target >= 0 && target < len) state.index = target;
			state.playing = true;
			break;
		}
		case "pause":
			state.playing = false;
			break;
		case "toggle":
			state.playing = !state.playing;
			break;
		case "next":
			if (len > 0) state.index = nextIndex(state, +1);
			state.playing = true;
			break;
		case "prev":
			if (len > 0) state.index = (state.index - 1 + len) % len;
			state.playing = true;
			break;
		case "ended":
			// Natural end of a track: single mode replays, others advance.
			if (state.mode === "single" || len === 0) {
				state.playing = state.mode === "single";
			} else {
				state.index = nextIndex(state, +1);
				state.playing = true;
			}
			break;
		case "volume":
			state.volume = clamp01(command.volume);
			break;
		case "mode":
			if (MODES.includes(command.mode)) state.mode = command.mode;
			break;
		case "add": {
			const url = typeof command.url === "string" ? command.url.trim() : "";
			const isExternal = /^https?:\/\/\S+$/.test(url);
			const isLocal = /^\/dsh-music\/\S*$/.test(url);
			if (!isExternal && !isLocal) return { ok: false, message: "需要 http(s) 音频直链或站内音乐链接" };
			const track = {
				id: `custom-${Date.now().toString(36)}`,
				title: (typeof command.title === "string" && command.title.trim() !== ""
					? command.title.trim()
					: url.split("/").pop() || url).slice(0, 120),
				artist: "自定义",
				url
			};
			state.custom.push(track);
			state.queue = composeQueue(state.custom, state.useBuiltin);
			state.version += 1;
			return { ok: true, message: `已添加「${track.title}」到播放列表` };
		}
		case "remove": {
			const target = Number(command.index);
			if (!Number.isInteger(target) || target < 0 || target >= len) return { ok: false, message: "索引无效" };
			const removed = state.queue[target];
			state.custom = state.custom.filter((track) => track.id !== removed.id);
			state.queue = composeQueue(state.custom, state.useBuiltin);
			if (state.index > target) state.index -= 1;
			else if (state.index === target && state.queue.length > 0) state.index = state.index % state.queue.length;
			if (state.queue.length === 0) {
				state.index = 0;
				state.playing = false;
			}
			state.version += 1;
			return { ok: true, message: `已移除「${removed.title}」` };
		}
		case "importPlaylist": {
			const raw = typeof command.id === "string" ? command.id.trim() : "";
			const id = /(\d+)/.exec(raw)?.[1] ?? "";
			if (id === "") return { ok: false, message: "歌单 id 或链接无效" };
			const playlist = await neteasePlaylist(id);
			if (playlist.tracks.length === 0) return { ok: false, message: "歌单为空、不可访问或已失效" };
			state.custom = playlist.tracks.map((row) => ({
				id: `netease-${row.id}`,
				title: row.name,
				artist: row.artist,
				cover: row.cover,
				url: neteaseStreamUrl(row.id)
			}));
			state.useBuiltin = command.clear === false;
			state.queue = composeQueue(state.custom, state.useBuiltin);
			// Random start support: explicit shuffle, or already in shuffle mode.
			if (command.shuffle === true || state.mode === "shuffle") {
				state.mode = "shuffle";
				state.index = state.queue.length > 0 ? Math.floor(Math.random() * state.queue.length) : 0;
			} else {
				state.index = 0;
			}
			state.playing = true;
			state.version += 1;
			return {
				ok: true,
				message: `已导入歌单「${playlist.name}」（${playlist.tracks.length} 首）${state.useBuiltin ? "" : "，默认歌单已隐藏"}，开始播放第一首`
			};
		}
		case "builtin": {
			state.useBuiltin = command.enable === true;
			state.queue = composeQueue(state.custom, state.useBuiltin);
			state.version += 1;
			return { ok: true, message: state.useBuiltin ? "已恢复默认歌单" : "已隐藏默认歌单" };
		}
		case "reset":
			state.custom = [];
			state.useBuiltin = true;
			state.queue = composeQueue(state.custom, state.useBuiltin);
			state.index = 0;
			state.playing = false;
			state.version += 1;
			return { ok: true, message: "播放列表已重置为默认歌单" };
		default:
			return { ok: false, message: `未知操作: ${String(action)}` };
	}
	state.version += 1;
	return { ok: true, message: "ok" };
}

/** Advance index by one step honoring the playback mode. */
function nextIndex(state, step) {
	const len = state.queue.length;
	if (len === 0) return 0;
	if (state.mode === "shuffle") {
		if (len === 1) return 0;
		let next = state.index;
		while (next === state.index) next = Math.floor(Math.random() * len);
		return next;
	}
	return (state.index + step + len) % len;
}

/** Write a JSON response. */
function json(res, body, status = 200) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(JSON.stringify(body));
}

/** Collect the request body as text. */
function readBody(req) {
	return new Promise((resolve, reject) => {
		let data = "";
		req.on("data", (chunk) => {
			data += chunk;
			if (data.length > 1e6) {
				req.destroy();
				reject(new Error("body too large"));
			}
		});
		req.on("end", () => resolve(data));
		req.on("error", reject);
	});
}

/** Find a queue entry whose title matches the query. */
function findTrack(state, query) {
	const needle = query.trim().toLowerCase();
	if (needle === "") return void 0;
	return state.queue.find((track) => track.title.toLowerCase().includes(needle))
		?? state.queue.find((track) => track.artist.toLowerCase().includes(needle));
}

/** Format the queue as one line per track. */
function renderQueue(state) {
	return state.queue.map((track, i) => {
		const marker = i === state.index ? (state.playing ? "▶" : "⏸") : " ";
		return `${marker} [${i}] ${track.title} — ${track.artist}`;
	}).join("\n") || "（播放列表为空）";
}

// ── NetEase Cloud Music integration ──────────────────────────────────────────

/** NetEase search cache (30s). */
const neteaseCache = new Map();

/** Search NetEase Cloud Music for songs; resolves to trimmed song rows. */
async function neteaseSearch(query, limit = 20) {
	const key = `${query}:${limit}`;
	const cached = neteaseCache.get(key);
	if (cached !== void 0 && Date.now() - cached.at < 30_000) return cached.rows;
	const encoded = encodeURIComponent(query);
	const attempts = [
		`https://music.163.com/api/search/get/web?s=${encoded}&type=1&limit=${limit}&offset=0`,
		`https://music.163.com/api/search/get?s=${encoded}&type=1&limit=${limit}&offset=0`
	];
	let rows = [];
	for (const url of attempts) {
		try {
			const res = await fetch(url, {
				headers: {
					"user-agent": NET_EASE_UA,
					referer: NET_EASE_REFERER,
					cookie: NET_EASE_COOKIE
				}
			});
			if (!res.ok) continue;
			const data = await res.json();
			const songs = data?.result?.songs;
			if (!Array.isArray(songs)) continue;
			rows = songs.filter((song) => song && typeof song.id === "number").map((song) => ({
				id: String(song.id),
				name: String(song.name ?? "未知歌曲"),
				artist: Array.isArray(song.artists) && song.artists.length > 0
					? song.artists.map((artist) => artist?.name ?? "").filter(Boolean).join(" / ")
					: "未知歌手",
				album: song.album?.name ?? "",
				cover: typeof song.album?.picUrl === "string" && song.album.picUrl !== ""
					? `${song.album.picUrl}?param=160y160`
					: "",
				durationMs: typeof song.duration === "number" ? song.duration : 0
			}));
			if (rows.length > 0) break;
		} catch {
			/* try next endpoint */
		}
	}
	neteaseCache.set(key, { rows, at: Date.now() });
	return rows;
}

/** Fetch one NetEase playlist's visible tracks (cached 5 minutes). */
async function neteasePlaylist(id) {
	const key = `pl:${id}`;
	const cached = neteaseCache.get(key);
	if (cached !== void 0 && Date.now() - cached.at < 300_000) return { name: cached.name, tracks: cached.rows };
	const encoded = encodeURIComponent(id);
	const attempts = [
		`https://music.163.com/api/v6/playlist/detail?id=${encoded}&limit=500&n=500`,
		`https://music.163.com/api/playlist/detail?id=${encoded}`
	];
	let name = "";
	let rows = [];
	for (const url of attempts) {
		try {
			const res = await fetch(url, {
				headers: {
					"user-agent": NET_EASE_UA,
					referer: NET_EASE_REFERER,
					cookie: NET_EASE_COOKIE
				}
			});
			if (!res.ok) continue;
			const data = await res.json();
			const playlist = data?.playlist ?? data?.result;
			const tracks = playlist?.tracks;
			if (!Array.isArray(tracks)) continue;
			name = String(playlist?.name ?? "");
			rows = tracks.filter((song) => song && typeof song.id === "number").map((song) => ({
				id: String(song.id),
				name: String(song.name ?? "未知歌曲"),
				artist: Array.isArray(song.artists ?? song.ar)
					? (song.artists ?? song.ar).map((artist) => artist?.name ?? "").filter(Boolean).join(" / ")
					: "未知歌手",
				album: (song.album ?? song.al)?.name ?? "",
				cover: typeof (song.album ?? song.al)?.picUrl === "string" && (song.album ?? song.al)?.picUrl !== ""
					? `${(song.album ?? song.al)?.picUrl}?param=160y160`
					: "",
				durationMs: typeof song.duration === "number" ? song.duration : (typeof song.dt === "number" ? song.dt : 0)
			}));
			if (rows.length > 0) break;
		} catch {
			/* try next endpoint */
		}
	}
	neteaseCache.set(key, { name, rows, at: Date.now() });
	return { name, tracks: rows };
}

/** Issue an http(s) request choosing the module by protocol. */
function agentRequest(url, headers) {
	return url.startsWith("https:")
		? httpsRequest(url, { headers })
		: httpRequest(url, { headers });
}

/** Resolved CDN url cache for Meting lookups (signed links expire ~10 min). */
const metingCache = new Map();

/** Resolve via the Meting third-party API (matches the blog setup; unlocks tracks outer/url cannot). */
function resolveMetingUrl(id) {
	return new Promise((resolve) => {
		const url = `https://api.injahow.cn/meting/?server=netease&type=url&id=${encodeURIComponent(id)}`;
		const req = agentRequest(url, { "user-agent": NET_EASE_UA })
			.on("error", () => resolve(void 0));
		req.setTimeout(10000, () => {
			req.destroy();
			resolve(void 0);
		});
		req.on("response", (res) => {
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				res.resume();
				resolve(res.headers.location);
				return;
			}
			res.resume();
			resolve(void 0);
		});
		req.end();
	});
}

/** Resolve via NetEase's public outer-link endpoint (free tracks). */
function resolveOuterUrl(id) {
	return new Promise((resolve) => {
		const url = `https://music.163.com/song/media/outer/url?id=${encodeURIComponent(id)}.mp3`;
		const req = agentRequest(url, { "user-agent": NET_EASE_UA, referer: NET_EASE_REFERER })
			.on("error", () => resolve(void 0));
		req.setTimeout(10000, () => {
			req.destroy();
			resolve(void 0);
		});
		req.on("response", (res) => {
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				res.resume();
				resolve(res.headers.location);
				return;
			}
			res.resume();
			resolve(void 0);
		});
		req.end();
	});
}

/** Pick a playable CDN url. Priority: cloud proxy (VIP full tracks via eapi)
 * → logged-in weapi (full tracks, incl. VIP when the provided cookie has the
 * entitlement) → Meting (full free tracks, trial for restricted ones) →
 * outer-link (free tracks). */
async function resolveStreamUrl(id) {
	const cached = metingCache.get(id);
	if (cached !== void 0 && Date.now() - cached.at < 480_000) return cached.url;
	if (DSH_MUSIC_API !== "") {
		const cloud = await resolveCloudUrl(id);
		if (cloud !== void 0) {
			metingCache.set(id, { url: cloud, at: Date.now() });
			return cloud;
		}
	}
	if (DSH_MUSIC_COOKIE !== "") {
		const weapi = await resolveWeapiUrl(id);
		if (weapi !== void 0) {
			metingCache.set(id, { url: weapi, at: Date.now() });
			return weapi;
		}
	}
	const meting = await resolveMetingUrl(id);
	if (meting !== void 0) {
		metingCache.set(id, { url: meting, at: Date.now() });
		return meting;
	}
	return await resolveOuterUrl(id);
}

/** Resolve a full playable url via the cloud proxy (DSH_MUSIC_API). */
async function resolveCloudUrl(id) {
	try {
		const base = DSH_MUSIC_API.replace(/\/+$/, "");
		const res = await fetch(`${base}/song/url?id=${encodeURIComponent(id)}&level=exhigh`, {
			signal: AbortSignal.timeout(12000)
		});
		if (!res.ok) return void 0;
		const data = await res.json().catch(() => null);
		const url = data?.url;
		return typeof url === "string" && /^https?:\/\//.test(url) ? url : void 0;
	} catch {
		return void 0;
	}
}

/** weapi AES+RSA request body for the official player-url endpoint. */
function weapiBody(payload) {
	const secret = randomBytes(16);
	const aes = (text, key) => {
		const cipher = createCipheriv("aes-128-cbc", key, WEAPI_IV);
		return cipher.update(text, "utf8", "base64") + cipher.final("base64");
	};
	const params = aes(aes(JSON.stringify(payload), WEAPI_PRESET), secret);
	const jwk = { kty: "RSA", n: Buffer.from(WEAPI_MODULUS, "hex").toString("base64url"), e: "AQAB" };
	const pub = createPublicKey({ key: jwk, format: "jwk" });
	const encSecKey = publicEncrypt(
		{ key: pub, padding: 1 }, // RSA_PKCS1_PADDING
		Buffer.from(secret.toString("base64"), "utf8")
	).toString("hex");
	return `params=${encodeURIComponent(params)}&encSecKey=${encodeURIComponent(encSecKey)}`;
}

/** Resolve a full playable url via the official weapi endpoint using the
 * optional logged-in cookie (DSH_MUSIC_COOKIE). Returns void on any failure. */
async function resolveWeapiUrl(id) {
	try {
		const body = weapiBody({ ids: `[${id}]`, br: 320000, csrf_token: "", os: "pc", e_r: true });
		const res = await fetch("https://music.163.com/weapi/song/enhance/player/url", {
			method: "POST",
			headers: {
				"user-agent": NET_EASE_UA,
				referer: NET_EASE_REFERER,
				cookie: DSH_MUSIC_COOKIE,
				"content-type": "application/x-www-form-urlencoded"
			},
			body,
			signal: AbortSignal.timeout(12000)
		});
		if (!res.ok) return void 0;
		const data = await res.json().catch(() => null);
		const url = data?.data?.[0]?.url;
		return typeof url === "string" && /^https?:\/\//.test(url) ? url : void 0;
	} catch {
		return void 0;
	}
}

/** Write audio response head mirroring the upstream status and range headers. */
function writeAudioHead(res, upstream) {
	res.writeHead(upstream.statusCode ?? 200, {
		"content-type": upstream.headers["content-type"] ?? "audio/mpeg",
		"cache-control": "no-store",
		"accept-ranges": upstream.headers["accept-ranges"] ?? "bytes",
		...(upstream.headers["content-range"] ? { "content-range": upstream.headers["content-range"] } : {}),
		...(upstream.headers["content-length"] ? { "content-length": upstream.headers["content-length"] } : {})
	});
}

/** Pipe one final audio url into the browser response with timeout/abort safety. */
function pipeStream(url, range, res, fail) {
	const headers = { "user-agent": NET_EASE_UA, referer: NET_EASE_REFERER };
	if (typeof range === "string" && range !== "") headers.range = range;
	let active;
	// When the browser aborts (seek/skip/reload), tear the upstream down instead
	// of letting it pipe into a dead response and emit unhandled errors.
	res.on("close", () => active?.destroy());
	const req = agentRequest(url, headers).on("error", () => fail("音频流获取失败"));
	req.setTimeout(12000, () => {
		req.destroy();
		fail("音频流获取超时");
	});
	active = req;
	req.on("response", (upstream) => {
		if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
			upstream.resume();
			const next = agentRequest(upstream.headers.location, { "user-agent": NET_EASE_UA, ...(typeof range === "string" && range !== "" ? { range } : {}) })
				.on("error", () => fail("音频流获取失败"));
			next.setTimeout(12000, () => {
				next.destroy();
				fail("音频流获取超时");
			});
			active = next;
			next.on("response", (final) => {
				if (final.statusCode !== 200 && final.statusCode !== 206) {
					final.resume();
					fail(`上游返回 ${final.statusCode}`);
					return;
				}
				final.on("error", () => { /* aborted by client */ });
				writeAudioHead(res, final);
				final.pipe(res);
			});
			next.end();
			return;
		}
		if (upstream.statusCode !== 200 && upstream.statusCode !== 206) {
			upstream.resume();
			fail(`上游返回 ${upstream.statusCode}`);
			return;
		}
		upstream.on("error", () => { /* aborted by client */ });
		writeAudioHead(res, upstream);
		upstream.pipe(res);
	});
	req.end();
}

/** Stream a NetEase track through this host (bypasses browser CORS/anti-leech). */
async function proxyNeteaseStream(id, req, res) {
	const fail = (message) => {
		// The response may already be gone (browser aborted the stream on skip).
		try {
			res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify({ error: message }));
		} catch {
			/* response closed */
		}
	};
	let target;
	try {
		target = await resolveStreamUrl(id);
	} catch {
		target = void 0;
	}
	if (target === void 0) {
		fail("音频流获取失败");
		return;
	}
	pipeStream(target, req.headers.range, res, fail);
}

/** Parse an external URL for the NetEase song or playlist id (for the agent tool). */
function parseNeteaseUrl(url) {
	const match = /music\.163\.com\/(?:song|#\/song)\/?(?:\?id=)?(\d+)/.exec(url)
		?? /(?:song\/media\/outer\/url\?id=)(\d+)/.exec(url)
		?? /music\.163\.com\/(?:playlist|#\/playlist)\/?(?:\?id=)?(\d+)/.exec(url);
	return match ? match[1] : void 0;
}

/** Extract a playlist id from a raw id or share link. */
function parsePlaylistId(raw) {
	const value = String(raw ?? "").trim();
	if (/^\d+$/.test(value)) return value;
	const match = /music\.163\.com\/(?:playlist|#\/playlist)\/?(?:\?id=)?(\d+)/.exec(value);
	return match ? match[1] : void 0;
}

/**
 * The plugin entry: register the REST surface and the agent tool.
 * @param ctx - host context.
 */
export function apply(ctx) {
	const state = defaultState();

	// Load the configured NetEase playlist as the built-in queue at startup.
	refreshBuiltinTracks().then(() => {
		state.queue = composeQueue(state.custom, state.useBuiltin);
		if (state.index >= state.queue.length) state.index = 0;
		state.version += 1;
	});

	// State snapshot for the browser player.
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/state",
		handler: (_req, res) => json(res, publicState(state))
	}));

	// Player intents from the browser.
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/command",
		handler: async (req, res) => {
			try {
				const body = await readBody(req);
				const command = JSON.parse(body || "{}");
				const result = await applyCommand(state, command);
				json(res, { ...publicState(state), result });
			} catch (error) {
				json(res, { error: error instanceof Error ? error.message : String(error) }, 400);
			}
		}
	}));

	// NetEase Cloud Music search proxy (browser cannot call music.163.com directly).
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/netease/search",
		handler: async (req, res) => {
			try {
				const query = new URL(req.url, "http://localhost").searchParams.get("q") ?? "";
				if (query.trim() === "") {
					json(res, { songs: [] });
					return;
				}
				const songs = await neteaseSearch(query.trim(), 20);
				json(res, { songs });
			} catch (error) {
				json(res, { error: error instanceof Error ? error.message : String(error) }, 502);
			}
		}
	}));

	// NetEase Cloud Music playlist proxy.
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/netease/playlist",
		handler: async (req, res) => {
			try {
				const raw = new URL(req.url, "http://localhost").searchParams.get("id") ?? "";
				const id = parsePlaylistId(raw);
				if (id === void 0) {
					json(res, { error: "歌单 id 或链接无效" }, 400);
					return;
				}
				const playlist = await neteasePlaylist(id);
				json(res, { name: playlist.name, tracks: playlist.tracks });
			} catch (error) {
				json(res, { error: error instanceof Error ? error.message : String(error) }, 502);
			}
		}
	}));

	// NetEase Cloud Music audio stream proxy.
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-music/netease/stream",
		handler: (req, res) => {
			const id = new URL(req.url, "http://localhost").searchParams.get("id") ?? "";
			if (!/^\d+$/.test(id)) {
				json(res, { error: "无效的歌曲 id" }, 400);
				return;
			}
			proxyNeteaseStream(id, req, res);
		}
	}));

	// Agent-facing music control tool.
	ctx.tools.register(defineTool({
		name: "music",
		description: "控制 DeepSeek Harness 的音乐播放器：播放/暂停/切歌/调音量/切换循环模式/查看队列/导入网易云歌单/网易云搜歌。用户提到放歌、听歌、切歌、暂停、下一首、导入歌单等场景时使用。",
		parameters: {
			action: {
				type: "string",
				required: true,
				description: "play(播放；query 先匹配本地曲库，未命中自动搜网易云并播放) / pause / next / prev / list(查看队列) / search(网易云搜歌) / playlist(导入网易云歌单) / add(添加直链) / remove(按索引移除) / volume / mode / builtin(恢复/隐藏默认歌单) / reset"
			},
			query: { type: "string", description: "歌名或歌手关键词，配合 play/search 使用" },
			url: { type: "string", description: "音频直链(http/https)，配合 add 使用" },
			title: { type: "string", description: "自定义歌曲标题，配合 add 使用" },
			id: { type: "string", description: "网易云歌单 id 或分享链接，配合 playlist 使用" },
			clear: { type: "boolean", description: "playlist 是否隐藏默认歌单（默认 true，仅保留新歌单）" },
			shuffle: { type: "boolean", description: "playlist 是否随机播放歌单（默认跟随当前模式；当前已是随机模式则自动随机起播）" },
			enable: { type: "boolean", description: "builtin 是否恢复默认歌单" },
			index: { type: "number", description: "队列索引，配合 play/remove 使用" },
			volume: { type: "number", description: "音量 0-1，配合 volume 使用" },
			mode: { type: "string", description: "循环模式：list(列表循环)/single(单曲循环)/shuffle(随机)，配合 mode 使用" }
		},
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{ type: "text", text: value }]
		},
		async execute(args) {
			const action = args.action;
			switch (action) {
				case "play": {
					if (typeof args.query === "string" && args.query.trim() !== "") {
						const track = findTrack(state, args.query);
						if (track !== void 0) {
							state.index = state.queue.indexOf(track);
						} else {
							// Local miss: fall back to NetEase Cloud Music search.
							const songs = await neteaseSearch(args.query, 5);
							if (songs.length === 0) {
								return `曲库中没有匹配「${args.query}」的歌曲，网易云搜索也没有结果。当前队列：\n${renderQueue(state)}`;
							}
							const song = songs[0];
							const trackRow = {
								id: `netease-${song.id}`,
								title: song.name,
								artist: song.artist,
								cover: song.cover,
								url: neteaseStreamUrl(song.id)
							};
							state.custom.push(trackRow);
							state.queue = composeQueue(state.custom, state.useBuiltin);
							state.index = state.queue.length - 1;
							return `本地曲库无匹配，已从网易云搜索并加入：▶ 「${song.name} — ${song.artist}」（自动播放）`;
						}
					} else if (Number.isInteger(args.index)) {
						state.index = args.index;
					}
					state.playing = true;
					state.version += 1;
					const current = state.queue[state.index];
					return `▶ 正在播放「${current.title} — ${current.artist}」（${state.index + 1}/${state.queue.length}）`;
				}
				case "pause":
					state.playing = false;
					state.version += 1;
					return "⏸ 已暂停";
				case "next":
				case "prev": {
					if (state.queue.length === 0) return "播放列表为空";
					state.index = action === "next" ? nextIndex(state, +1) : (state.index - 1 + state.queue.length) % state.queue.length;
					state.playing = true;
					state.version += 1;
					const current = state.queue[state.index];
					return `${action === "next" ? "⏭" : "⏮"} 切到「${current.title} — ${current.artist}」`;
				}
				case "list":
					return `正在${state.playing ? "播放" : "暂停"}：${state.queue[state.index]?.title ?? "无"}\n模式：${state.mode}｜音量：${Math.round(state.volume * 100)}%\n\n${renderQueue(state)}`;
				case "search": {
					if (typeof args.query !== "string" || args.query.trim() === "") return "请提供搜索关键词 query";
					const songs = await neteaseSearch(args.query.trim(), 10);
					if (songs.length === 0) return `网易云没有搜到「${args.query}」`;
					return `网易云搜索结果（前 ${songs.length} 条）：\n${songs.map((song, i) =>
						`${i + 1}. ${song.name} — ${song.artist}${song.album ? `（专辑：${song.album}）` : ""}${song.durationMs ? `（${Math.round(song.durationMs / 1000 / 60)}:${String(Math.round(song.durationMs / 1000) % 60).padStart(2, "0")}）` : ""}`
					).join("\n")}\n\n告诉用户序号，或用 play 播放指定歌曲。`;
				}
				case "add": {
					if (typeof args.url !== "string" || args.url.trim() === "") return "请提供音频直链 url";
					const result = await applyCommand(state, { action: "add", url: args.url, title: args.title });
					return result.message;
				}
				case "remove": {
					const result = await applyCommand(state, { action: "remove", index: args.index });
					return result.message;
				}
				case "volume": {
					if (typeof args.volume !== "number") return "请提供 volume(0-1)";
					state.volume = clamp01(args.volume);
					state.version += 1;
					return `音量已设为 ${Math.round(state.volume * 100)}%`;
				}
				case "mode": {
					if (!MODES.includes(args.mode)) return `模式必须是 ${MODES.join("/")}`;
					state.mode = args.mode;
					state.version += 1;
					return `循环模式已切换为 ${state.mode}`;
				}
				case "playlist": {
					const id = parsePlaylistId(args.id ?? args.url);
					if (id === void 0) return "请提供网易云歌单 id 或分享链接（如 https://music.163.com/playlist?id=xxx）";
					const result = await applyCommand(state, { action: "importPlaylist", id, clear: args.clear !== false, shuffle: args.shuffle === true });
					return result.message;
				}
				case "builtin": {
					const result = await applyCommand(state, { action: "builtin", enable: args.enable === true });
					return result.message;
				}
				case "reset": {
					const result = await applyCommand(state, { action: "reset" });
					return result.message;
				}
				default:
					return `未知操作「${String(action)}」。可用：play/pause/next/prev/list/search/playlist/add/remove/volume/mode/builtin/reset`;
			}
		}
	}));
}
