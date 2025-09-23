// ESM script to generate i18n JSON files from a source locale (default: English)
// Usage:
//   node scripts/gen-locales.mjs --targets=hr,fr,de
//   node scripts/gen-locales.mjs --all           (reads SUPPORTED_LNGS from ../client/src/constants/languages.js or ../src/constants/languages.js)
//   node scripts/gen-locales.mjs --from=en --out=../client/public/locales
//
// Notes:
// - Requires GOOGLE_APPLICATION_CREDENTIALS env var for @google-cloud/translate (or ADC)
// - Preserves i18n placeholders like {{name}}

import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { v2 as TranslateV2 } from "@google-cloud/translate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------- config (change if your paths differ) --------
const SRC_LNG  = getArg("--from", "en");
const OUT_DIR  = path.resolve(__dirname, getArg("--out", "../client/public/locales"));
const EN_FILE  = path.join(OUT_DIR, `${SRC_LNG}/translation.json`);
const USE_ALL  = hasFlag("--all");
const ARG_TARGETS = getArg("--targets", "")?.split(",").filter(Boolean);

// Optional: map your UI codes to Google codes
const CODE_MAP = {
  tl: "fil",
  zh: "zh-CN",
};

// Explicit, credentialed client (falls back to ADC if vars are unset)
const translate = new TranslateV2.Translate({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT,
});

// ---------------- util funcs ----------------
function getArg(name, fallback = "") {
  const idx = process.argv.findIndex(a => a.startsWith(name));
  if (idx === -1) return fallback;
  const [, val] = process.argv[idx].split("=");
  return (val ?? fallback).trim();
}
function hasFlag(name) {
  return process.argv.some(a => a === name);
}
function normCode(code) {
  return CODE_MAP[code] || code;
}
function extractPlaceholders(s) {
  return Array.from(new Set((s.match(/{{\s*[^}]+\s*}}/g) || [])));
}
function protectPlaceholders(s, phs) {
  let out = s;
  phs.forEach((ph, i) => { out = out.replaceAll(ph, `__PH_${i}__`); });
  return out;
}
function restorePlaceholders(s, phs) {
  let out = s;
  phs.forEach((ph, i) => { out = out.replaceAll(`__PH_${i}__`, ph); });
  return out;
}
async function tr(text, target) {
  const phs = extractPlaceholders(text);
  const protectedText = protectPlaceholders(text, phs);
  const [res] = await translate.translate(protectedText, target);
  return restorePlaceholders(res, phs);
}
async function translateObject(obj, target) {
  if (typeof obj === "string") return tr(obj, target);
  if (Array.isArray(obj)) return Promise.all(obj.map(x => translateObject(x, target)));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = await translateObject(v, target);
  }
  return out;
}
async function tryImport(urlish) {
  try { return await import(urlish); } catch { return null; }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --------------- main ----------------
(async () => {
  console.log("[gen-locales] OUT_DIR =", OUT_DIR, " EN_FILE =", EN_FILE, " SRC_LNG =", SRC_LNG);

  // Load source-of-truth JSON
  let sourceJson;
  try {
    sourceJson = JSON.parse(await fs.readFile(EN_FILE, "utf8"));
  } catch (e) {
    console.error("[gen-locales] Could not read source file:", EN_FILE);
    console.error("               Make sure it exists and pass --from=<lng> if not 'en'.");
    throw e;
  }

  // Resolve targets
  let targets = ARG_TARGETS;
  if (USE_ALL) {
    // Try client path first, then fallback to generic src path
    const candidates = [
      path.resolve(__dirname, "../client/src/constants/languages.js"),
      path.resolve(__dirname, "../src/constants/languages.js"),
    ];
    let mod = null;
    for (const p of candidates) {
      mod = await tryImport(pathToFileURL(p).href);
      if (mod?.SUPPORTED_LNGS) break;
    }
    if (!mod?.SUPPORTED_LNGS) {
      console.warn("[gen-locales] Could not load SUPPORTED_LNGS from expected paths.");
      console.warn("             Falling back to a comprehensive static set.");
      targets = ["af","ak","sq","am","ar",
                  "hy","as","ay","az","eu",
                  "be","bn","bs","br","bg",
                  "ca","yue","ceb","zh-CN",
                  "zh-TW","co","hr","cs","da",
                  "dv","nl","eo","et","fil",
                  "fi","fr","fy","gl","ka",
                  "de","el","gn","gu","ht",
                  "ha","haw","he","hi","hmn",
                  "hu","is","ig","ilo","id",
                  "ga","it","ja","jv","kn",
                  "kk","km","rw","kri","ko",
                  "ku","ckb","ky","lo","la",
                  "lv","ln","lg","lb","lt",
                  "mk","mai","mg","ms","ml",
                  "mt","mi","mr","mni-Mtei",
                  "lus","mn","my","ne","nso",
                  "no","oc","or","om","pam",
                  "ps","fa","pl","pt","pa",
                  "qu","ro","ru","sm","sa",
                  "gd","scn","szl","sr","st",
                  "shn","sn","sd","si","sk",
                  "sl","so","es","su","sw",
                  "sv","tg","ta","tt","te",
                  "tet","th","ti","ts","tn",
                  "tr","tk","ug","uk","ur",
                  "uz","vi","cy","wo","xh",
                  "yi","yo","yua","zu"];
    } else {
      targets = mod.SUPPORTED_LNGS.slice();
    }
  }
  if (!targets || targets.length === 0) {
    console.error("No targets. Pass --targets=hr,fr,de or --all");
    process.exit(1);
  }

  // Remove source language if present
  targets = targets.filter(lng => lng && lng !== SRC_LNG);

  // --- Fetch API-supported codes once ---
  let supportedSet = new Set();
  try {
    const [apiLangs] = await translate.getLanguages(); // [{ code, name }, ...]
    supportedSet = new Set(apiLangs.map(l => l.code));
    console.log(`[gen-locales] API supports ${supportedSet.size} languages`);
  } catch (e) {
    const msg = e?.response?.data ? JSON.stringify(e.response.data) : (e?.message || e);
    console.warn("[gen-locales] Could not fetch supported languages list:", msg);
  }

  const unsupported = [];
  const failed = [];

  // Generate sequentially (keeps API happy)
  for (const lng of targets) {
    const apiCode = normCode(lng);
    const base = apiCode.split("-")[0];
    const isSupported =
      supportedSet.size === 0 ? true : (supportedSet.has(apiCode) || supportedSet.has(base));

    console.log(`[gen-locales] ${SRC_LNG} -> ${lng} (api: ${apiCode}) ${isSupported ? '' : '[NOT SUPPORTED]'}`);

    const dir = path.join(OUT_DIR, lng);
    await fs.mkdir(dir, { recursive: true });

    try {
      const payload = isSupported
        ? await translateObject(sourceJson, apiCode)
        : sourceJson; // fallback to source text if unsupported

      await fs.writeFile(path.join(dir, "translation.json"), JSON.stringify(payload, null, 2), "utf8");
    } catch (e) {
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : (e?.message || e);
      console.warn(`[gen-locales] Translate failed for ${lng}: ${msg}. Falling back to source text.`);
      failed.push(lng);
      await fs.writeFile(path.join(dir, "translation.json"), JSON.stringify(sourceJson, null, 2), "utf8");
    }

    if (!isSupported) unsupported.push(lng);

    // Throttle between languages to avoid QPS/rate limits
    await sleep(200); // adjust to 200–500ms if needed
  }

  // Build a manifest of available languages from the output dir
  const dirs = await fs.readdir(OUT_DIR, { withFileTypes: true });
  const codes = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    try {
      await fs.access(path.join(OUT_DIR, d.name, "translation.json"));
      codes.push(d.name);
    } catch {}
  }
  codes.sort();

  // Include diagnostics so you know what happened
  await fs.writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify({ codes, unsupported, failed }, null, 2),
    "utf8"
  );
  console.log("[gen-locales] Wrote manifest.json with", codes.length, "languages");
  if (unsupported.length) console.log("[gen-locales] Unsupported (API):", unsupported.join(", "));
  if (failed.length) console.log("[gen-locales] Failed to translate:", failed.join(", "));
})();
