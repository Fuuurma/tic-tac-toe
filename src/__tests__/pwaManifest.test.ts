import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pins the installable-PWA contract at repo level: the manifest Chrome and
 * iOS read, the icons they point at, the meta tags index.html carries, and
 * the service-worker source the build turns into dist/sw.js. A missing or
 * malformed piece fails here instead of silently costing the install prompt.
 */

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");
const publicDir = join(repoRoot, "public");

const manifestPath = join(publicDir, "manifest.webmanifest");
const manifest = existsSync(manifestPath)
  ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>)
  : null;

const indexHtml = readFileSync(join(repoRoot, "index.html"), "utf8");

interface ManifestIcon {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

const icons = (manifest?.icons ?? []) as ManifestIcon[];

/** PNG pixel size from the IHDR chunk — proves the file is a real PNG at
 *  the declared dimensions, not just a path that exists. */
const pngSize = (file: string): { width: number; height: number } => {
  const buf = readFileSync(file);
  expect(buf.subarray(1, 4).toString("latin1"), `${file} is not a PNG`).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

const iconFile = (icon: ManifestIcon) => join(publicDir, icon.src.replace(/^\//, ""));

describe("PWA manifest", () => {
  it("exists and parses", () => {
    expect(manifest, "public/manifest.webmanifest is missing").not.toBeNull();
  });

  it("declares the identity and standalone display the install criteria need", () => {
    expect(manifest?.name).toBeTruthy();
    expect(manifest?.short_name).toBeTruthy();
    expect(manifest?.description).toBeTruthy();
    expect(manifest?.start_url).toBe("/");
    expect(manifest?.scope).toBe("/");
    expect(manifest?.display).toBe("standalone");
    expect(manifest?.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(manifest?.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("ships 192 and 512 px icons plus a maskable one, all real PNGs on disk", () => {
    const byPurpose = (purpose: string) =>
      icons.filter((i) => (i.purpose ?? "any").split(/\s+/).includes(purpose));

    const any192 = byPurpose("any").find((i) => i.sizes === "192x192");
    const any512 = byPurpose("any").find((i) => i.sizes === "512x512");
    const maskable = byPurpose("maskable").find((i) => i.sizes === "512x512");

    expect(any192, "manifest needs a 192x192 'any' icon").toBeTruthy();
    expect(any512, "manifest needs a 512x512 'any' icon").toBeTruthy();
    expect(maskable, "manifest needs a 512x512 'maskable' icon").toBeTruthy();

    for (const icon of [any192!, any512!, maskable!]) {
      const file = iconFile(icon);
      expect(existsSync(file), `${icon.src} is listed but missing`).toBe(true);
      expect(pngSize(file)).toEqual({
        width: Number(icon.sizes!.split("x")[0]),
        height: Number(icon.sizes!.split("x")[1]),
      });
    }
  });
});

describe("index.html PWA hooks", () => {
  it("links the manifest and the apple touch icon", () => {
    expect(indexHtml).toContain('rel="manifest"');
    expect(indexHtml).toContain('rel="apple-touch-icon"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-capable"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-status-bar-style"');
    expect(indexHtml).toContain('name="mobile-web-app-capable"');
  });

  it("points the touch icon at a real 180px PNG", () => {
    const match = /rel="apple-touch-icon" href="([^"]+)"/.exec(indexHtml);
    expect(match, "index.html has no apple-touch-icon href").toBeTruthy();
    const file = join(repoRoot, "public", match![1]!.replace(/^\//, ""));
    expect(existsSync(file), `${match![1]} is missing`).toBe(true);
    expect(pngSize(file)).toEqual({ width: 180, height: 180 });
  });
});

describe("service worker source", () => {
  const swPath = join(repoRoot, "scripts", "service-worker.js");

  it("exists with the build-time precache injection point", () => {
    expect(existsSync(swPath), "scripts/service-worker.js is missing").toBe(true);
    const source = readFileSync(swPath, "utf8");
    expect(source).toContain("__PRECACHE_MANIFEST__");
    expect(source).toContain("fetch");
  });
});
