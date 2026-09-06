import fs from "node:fs";
import path from "node:path";

const dist = "dist";
const indexPath = path.join(dist, "index.html");
if (!fs.existsSync(indexPath)) {
  console.error("Missing dist/index.html");
  process.exit(1);
}

const html = fs.readFileSync(indexPath, "utf8");
if (!html.includes("Disappear")) {
  console.error("dist/index.html does not include Disappear in the document");
  process.exit(1);
}

const headersPath = path.join(dist, "_headers");
if (!fs.existsSync(headersPath)) {
  console.error("Missing dist/_headers");
  process.exit(1);
}

const headers = fs.readFileSync(headersPath, "utf8");
if (/peerjs|0\.peerjs\.com/i.test(headers)) {
  console.error("dist/_headers still allows PeerJS");
  process.exit(1);
}

// F10: the matchmaking Worker URL is baked into the bundle at build time
// (import.meta.env.VITE_MATCHMAKING_URL, fallback http://127.0.0.1:8787).
// A production dist built without the env var silently phones localhost.
// When the caller declares a non-local URL, the bundle must contain it;
// a localhost-pointing bundle is refused whenever production is signalled
// (CF_PAGES or an explicit non-local VITE_MATCHMAKING_URL).
const LOCAL_FALLBACK = "http://127.0.0.1:8787";
const declaredUrl = (process.env.VITE_MATCHMAKING_URL ?? "").trim();
const jsAssets = [];
for (const entry of fs.readdirSync(dist, { recursive: true })) {
  if (typeof entry === "string" && entry.endsWith(".js")) {
    jsAssets.push(path.join(dist, entry));
  }
}
const bundle = jsAssets.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const pointsAtLocalhost = bundle.includes(LOCAL_FALLBACK);
if (declaredUrl && !declaredUrl.startsWith("http://127.0.0.1")) {
  if (!bundle.includes(declaredUrl)) {
    console.error(
      `dist/ bundle does not contain the declared VITE_MATCHMAKING_URL (${declaredUrl}) — rebuild with the env var set`,
    );
    process.exit(1);
  }
  if (pointsAtLocalhost) {
    console.error(
      "dist/ bundle still contains the localhost matchmaking fallback alongside the declared URL",
    );
    process.exit(1);
  }
} else if (process.env.CF_PAGES && pointsAtLocalhost) {
  console.error(
    "dist/ bundle points at the localhost matchmaking fallback on a Pages build — set VITE_MATCHMAKING_URL and rebuild",
  );
  process.exit(1);
} else if (pointsAtLocalhost) {
  console.warn(
    "warning: dist/ bundle points at the localhost matchmaking fallback (fine for local previews, not for production)",
  );
}

console.log("dist/ looks ready");
