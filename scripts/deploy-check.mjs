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

console.log("dist/ looks ready");
