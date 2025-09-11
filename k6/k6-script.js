import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

/**
 * ========= Env Vars =========
 * BASE_URL         e.g. http://localhost:5002   (required)
 * AUTH_MODE        COOKIE | BEARER | RAW_COOKIE (default COOKIE)
 * RAW_COOKIE       "name=value" if AUTH_MODE=RAW_COOKIE
 * USERNAME         email/username (required unless RAW_COOKIE)
 * PASSWORD         password       (required unless RAW_COOKIE)
 * LOGIN_PATH       default: /auth/login
 * FEED_PATH        default: /status/feed?limit=20
 * VIEW_PATH_TMPL   default: /status/{id}/view
 * REACT_PATH_TMPL  default: /status/{id}/reactions
 * CHAT_ROOM_IDS    "1,2,3" (optional; disable message writes unless provided)
 * STATUS_IDS       "101,102" (optional; otherwise taken from feed)
 * RAMP_TO          default 50
 * DURATION         default "5m"
 * WRITE_RATIO      default 0.0 (disabled by default)
 * ORIGIN           default "http://localhost:5173"
 * DEBUG            "1" to print login debug
 * LOG_FIRST        how many first responses to log per endpoint (default 0)
 */

const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) { throw new Error("Please set BASE_URL"); }

const AUTH_MODE = (__ENV.AUTH_MODE || "COOKIE").toUpperCase(); // COOKIE | BEARER | RAW_COOKIE
const RAW_COOKIE = __ENV.RAW_COOKIE || "";
const USERNAME = __ENV.USERNAME || "";
const PASSWORD = __ENV.PASSWORD || "";
if (AUTH_MODE !== "RAW_COOKIE" && (!USERNAME || !PASSWORD)) {
  throw new Error("Set USERNAME and PASSWORD, or use AUTH_MODE=RAW_COOKIE with RAW_COOKIE.");
}

const LOGIN_PATH = __ENV.LOGIN_PATH || "/auth/login";
const FEED_PATH = __ENV.FEED_PATH || "/status/feed?limit=20";
const MESSAGE_PATH = __ENV.MESSAGE_PATH || "/messages";
const VIEW_PATH_TMPL = __ENV.VIEW_PATH_TMPL || "/status/{id}/view";
const REACT_PATH_TMPL = __ENV.REACT_PATH_TMPL || "/status/{id}/reactions";
const RAMP_TO = Number(__ENV.RAMP_TO || 50);
const DURATION = __ENV.DURATION || "5m";
const WRITE_RATIO = Math.min(Math.max(Number(__ENV.WRITE_RATIO || 0.0), 0), 1); // default OFF to avoid 4xx
const ORIGIN = __ENV.ORIGIN || "http://localhost:5173";
const DEBUG = (__ENV.DEBUG || "0") === "1";
const LOG_FIRST = Number(__ENV.LOG_FIRST || 0);

const CHAT_ROOM_IDS = (__ENV.CHAT_ROOM_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
const PRESET_STATUS_IDS = (__ENV.STATUS_IDS || "").split(",").map(s => s.trim()).filter(Boolean);

// Metrics
const feedDuration = new Trend("feed_duration");
const messageDuration = new Trend("message_duration");
const viewDuration = new Trend("status_view_duration");
const reactDuration = new Trend("status_react_duration");
const http5xxRate = new Rate("http_5xx");
const http4xxRate = new Rate("http_4xx");

export const options = {
  scenarios: {
    traffic: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: Math.max(RAMP_TO * 2, 20),
      maxVUs: Math.max(RAMP_TO * 4, 100),
      stages: [
        { target: Math.ceil(RAMP_TO / 2), duration: "1m" },
        { target: RAMP_TO, duration: DURATION },
        { target: 0, duration: "30s" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<300", "p(99)<800"],
    "feed_duration": ["p(95)<250"],
    "message_duration": ["p(95)<400"],
    "status_view_duration": ["p(95)<300"],
    "status_react_duration": ["p(95)<350"],
    "http_5xx": ["rate<0.01"],
    "http_4xx": ["rate<0.03"],
  },
  summaryTrendStats: ["avg", "p(90)", "p(95)", "p(99)", "max"],
};

// ---------- helpers ----------
function splitCookieKV(s) {
  const i = s.indexOf("=");
  if (i === -1) return [s, ""];
  return [s.slice(0, i), s.slice(i + 1)];
}
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function think(minMs = 200, maxMs = 800) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  sleep(ms / 1000);
}

function setAuth(state, extra = {}) {
  const headers = {
    "X-Requested-With": "XMLHttpRequest",
    Origin: ORIGIN,
    ...extra,
  };
  if (state.mode === "COOKIE" || state.mode === "RAW_COOKIE") {
    const jar = http.cookieJar();
    jar.set(state.baseUrl, state.cookieName, state.cookieVal, { path: "/" });
    const cookiePair = `${state.cookieName}=${state.cookieVal}`;
    headers.Cookie = headers.Cookie ? `${headers.Cookie}; ${cookiePair}` : cookiePair;
    return { headers };
  }
  if (state.mode === "BEARER") {
    headers.Authorization = `Bearer ${state.token}`;
    return { headers };
  }
  return { headers };
}

export function setup() {
  if (AUTH_MODE === "RAW_COOKIE") {
    if (!RAW_COOKIE) throw new Error("RAW_COOKIE is empty but AUTH_MODE=RAW_COOKIE");
    const [cookieName, cookieVal] = splitCookieKV(RAW_COOKIE);
    return { mode: "RAW_COOKIE", baseUrl: BASE_URL, cookieName, cookieVal, token: null, statusIds: PRESET_STATUS_IDS };
  }

  // Try email/password OR username/password
  const loginUrl = `${BASE_URL}${LOGIN_PATH}`;
  const attempts = [
    { email: USERNAME, password: PASSWORD },
    { username: USERNAME, password: PASSWORD },
  ];
  let res = null;
  for (const body of attempts) {
    res = http.post(loginUrl, JSON.stringify(body), {
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Origin: ORIGIN },
      tags: { endpoint: "login" },
    });
    if (DEBUG) {
      console.log("LOGIN try keys:", Object.keys(body).join(","));
      console.log("LOGIN status:", res.status);
      console.log("LOGIN headers:", JSON.stringify(res.headers));
      console.log("LOGIN body:", String(res.body || "").slice(0, 300));
    }
    if ([200, 201, 204].includes(res.status)) break;
    if (res.status >= 500) break;
  }
  if (!res || ![200, 201, 204].includes(res.status)) {
    throw new Error(`Login failed (status ${res && res.status}) at ${LOGIN_PATH}.`);
  }

  if (AUTH_MODE === "BEARER") {
    let token = null;
    try { token = res.json()?.token || res.json()?.jwt || res.json()?.accessToken || null; } catch {}
    if (!token) throw new Error("BEARER mode: no token in login JSON (expected token/jwt/accessToken).");
    return { mode: "BEARER", baseUrl: BASE_URL, cookieName: null, cookieVal: null, token, statusIds: PRESET_STATUS_IDS };
  }

  // COOKIE mode
  const setCookie = res.headers["Set-Cookie"];
  if (!setCookie) throw new Error("COOKIE mode: login did not return Set-Cookie.");
  const cookieKV = String(setCookie).split(";")[0];
  const [cookieName, cookieVal] = splitCookieKV(cookieKV);

  // Pull a fresh feed to get real status IDs (if any)
  const feedRes = http.get(`${BASE_URL}${FEED_PATH}`, {
    headers: { Origin: ORIGIN, Cookie: `${cookieName}=${cookieVal}` },
    tags: { endpoint: "feed_setup" },
  });
  let ids = [];
  try {
    const arr = feedRes.json();
    if (Array.isArray(arr)) ids = arr.map(x => x?.id).filter(Boolean);
  } catch {}
  const statusIds = PRESET_STATUS_IDS.length ? PRESET_STATUS_IDS : ids;

  return { mode: "COOKIE", baseUrl: BASE_URL, cookieName, cookieVal, token: null, statusIds };
}

let _logFeed = 0, _logView = 0, _logReact = 0, _logMsg = 0;

export default function (state) {
  // FEED
  const feedRes = http.get(`${BASE_URL}${FEED_PATH}`, setAuth(state));
  if (_logFeed++ < LOG_FIRST) {
    console.log("FEED status:", feedRes.status);
    console.log("FEED body:", String(feedRes.body || "").slice(0, 300));
  }
  feedDuration.add(feedRes.timings.duration);
  http5xxRate.add(feedRes.status >= 500);
  http4xxRate.add(feedRes.status >= 400 && feedRes.status < 500);
  check(feedRes, { "feed 200": (r) => r.status === 200 });

  think();

  // VIEW/REACT only if we have IDs
  const ids = state.statusIds || [];
  if (ids.length > 0) {
    const id = randomChoice(ids);
    const viewRes = http.patch(`${BASE_URL}${VIEW_PATH_TMPL.replace("{id}", id)}`, null, setAuth(state));
    if (_logView++ < LOG_FIRST) {
      console.log("VIEW status:", viewRes.status);
      console.log("VIEW body:", String(viewRes.body || "").slice(0, 300));
    }
    viewDuration.add(viewRes.timings.duration);
    http5xxRate.add(viewRes.status >= 500);
    http4xxRate.add(viewRes.status >= 400 && viewRes.status < 500);
    check(viewRes, { "view 200/204": (r) => [200, 204].includes(r.status) });

    think();

    if (Math.random() < 0.5) {
      const reactRes = http.post(
        `${BASE_URL}${REACT_PATH_TMPL.replace("{id}", id)}`,
        JSON.stringify({ emoji: "❤️" }),
        setAuth(state, { "Content-Type": "application/json" })
      );
      if (_logReact++ < LOG_FIRST) {
        console.log("REACT status:", reactRes.status);
        console.log("REACT body:", String(reactRes.body || "").slice(0, 300));
      }
      reactDuration.add(reactRes.timings.duration);
      http5xxRate.add(reactRes.status >= 500);
      http4xxRate.add(reactRes.status >= 400 && reactRes.status < 500);
      check(reactRes, { "react 200": (r) => r.status === 200 });
    }

    think();
  }

  // MESSAGE write (disabled unless you set CHAT_ROOM_IDS and WRITE_RATIO>0)
  if (CHAT_ROOM_IDS.length > 0 && Math.random() < WRITE_RATIO) {
    const roomId = randomChoice(CHAT_ROOM_IDS);
    const payload = { chatRoomId: /^\d+$/.test(roomId) ? Number(roomId) : roomId, content: `k6 hello ${Math.random().toString(36).slice(2, 8)}` };
    const msgRes = http.post(`${BASE_URL}${MESSAGE_PATH}`, JSON.stringify(payload), setAuth(state, { "Content-Type": "application/json" }));
    if (_logMsg++ < LOG_FIRST) {
      console.log("MSG status:", msgRes.status);
      console.log("MSG body:", String(msgRes.body || "").slice(0, 300));
    }
    messageDuration.add(msgRes.timings.duration);
    http5xxRate.add(msgRes.status >= 500);
    http4xxRate.add(msgRes.status >= 400 && msgRes.status < 500);
    check(msgRes, { "message 201/200": (r) => [200, 201].includes(r.status) });
  }

  think(300, 1200);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " " }),
    "k6-summary.json": JSON.stringify(data, null, 2),
  };
}

function pickNum(n, d = 0) { return typeof n === "number" && isFinite(n) ? n : d; }
function textSummary(data, { indent = "" } = {}) {
  const m = data?.metrics || {};
  const val = (name, key) => pickNum(m?.[name]?.values?.[key]);
  let out = "\n=== k6 Summary (custom) ===\n";
  out += `${indent}iterations                 ${pickNum(m?.iterations?.values?.count)}\n`;
  out += `${indent}http_reqs                  ${pickNum(m?.http_reqs?.values?.count)}\n`;
  out += `${indent}http_req_failed rate       ${val("http_req_failed", "rate").toFixed(4)}\n`;
  out += `${indent}http_req_duration p95 ms   ${val("http_req_duration", "p(95)").toFixed(1)}\n`;
  out += `${indent}feed_duration p95 ms       ${val("feed_duration", "p(95)").toFixed(1)}\n`;
  out += `${indent}message_duration p95 ms    ${val("message_duration", "p(95)").toFixed(1)}\n`;
  out += `${indent}status_view_duration p95   ${val("status_view_duration", "p(95)").toFixed(1)}\n`;
  out += `${indent}status_react_duration p95  ${val("status_react_duration", "p(95)").toFixed(1)}\n`;
  return out;
}
