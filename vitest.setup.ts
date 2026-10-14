// Node 26 exposes a localStorage global that is unavailable without a storage
// file. Vitest's jsdom proxy can then expose that empty global as
// window.localStorage, even though the JSDOM window has working storage.
// Restore the browser-backed property for DOM tests.
const dom = Reflect.get(globalThis, "jsdom") as
  | { window: { localStorage: Storage } }
  | undefined;

if (typeof window !== "undefined" && dom) {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: dom.window.localStorage,
  });
}
