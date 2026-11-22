import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import vm from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");
const swSource = readFileSync(join(repoRoot, "scripts", "service-worker.js"), "utf8");

const flush = () => new Promise<void>((done) => setTimeout(done, 0));

class FakeWorker extends EventTarget {
  state = "installing";
  postMessage = vi.fn();
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
}

class FakeContainer extends EventTarget {
  controller: object | null = null;
  register = vi.fn();
}

type Fakes = {
  worker: FakeWorker;
  registration: FakeRegistration;
  container: FakeContainer;
  reload: ReturnType<typeof vi.fn>;
};

const setup = async (
  options?: { onUpdateAvailable?: () => void },
  prepare?: (fakes: Fakes) => void,
) => {
  const fakes: Fakes = {
    worker: new FakeWorker(),
    registration: new FakeRegistration(),
    container: new FakeContainer(),
    reload: vi.fn(),
  };
  fakes.container.register.mockResolvedValue(fakes.registration);
  vi.stubGlobal("navigator", { serviceWorker: fakes.container });
  vi.stubGlobal("document", { readyState: "complete" });
  vi.stubGlobal("window", {
    location: { reload: fakes.reload },
    addEventListener: vi.fn(),
  });
  const mod = await import("@/lib/serviceWorker");
  mod.registerServiceWorker(options);
  prepare?.(fakes);
  await flush();
  return { mod, ...fakes };
};

beforeEach(() => {
  vi.stubEnv("PROD", true);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("registerServiceWorker update flow", () => {
  it("does not prompt or reload for a first install with no controller", async () => {
    const onUpdateAvailable = vi.fn();
    const { registration, worker, container, reload } = await setup({
      onUpdateAvailable,
    });
    registration.installing = worker;
    registration.dispatchEvent(new Event("updatefound"));
    worker.state = "installed";
    worker.dispatchEvent(new Event("statechange"));
    expect(onUpdateAvailable).not.toHaveBeenCalled();
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).not.toHaveBeenCalled();
  });

  it("invokes onUpdateAvailable when an update reaches the waiting state", async () => {
    const onUpdateAvailable = vi.fn();
    const { registration, worker, container } = await setup({
      onUpdateAvailable,
    });
    container.controller = {};
    registration.installing = worker;
    registration.dispatchEvent(new Event("updatefound"));
    worker.state = "installed";
    worker.dispatchEvent(new Event("statechange"));
    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
  });

  it("prompts for a worker already waiting when the page registers", async () => {
    const onUpdateAvailable = vi.fn();
    await setup({ onUpdateAvailable }, ({ registration, worker, container }) => {
      worker.state = "installed";
      registration.waiting = worker;
      container.controller = {};
    });
    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
  });

  it("does not reload on controllerchange before the update is accepted", async () => {
    const onUpdateAvailable = vi.fn();
    const { registration, worker, container, reload } = await setup({
      onUpdateAvailable,
    });
    container.controller = {};
    registration.installing = worker;
    registration.dispatchEvent(new Event("updatefound"));
    worker.state = "installed";
    registration.waiting = worker;
    worker.dispatchEvent(new Event("statechange"));
    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).not.toHaveBeenCalled();
  });

  it("posts SKIP_WAITING on requestUpdate and reloads at the next controllerchange", async () => {
    const { mod, registration, worker, container, reload } = await setup();
    container.controller = {};
    registration.installing = worker;
    registration.dispatchEvent(new Event("updatefound"));
    worker.state = "installed";
    registration.waiting = worker;
    worker.dispatchEvent(new Event("statechange"));
    mod.requestUpdate();
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("registers nothing outside production builds", async () => {
    vi.stubEnv("PROD", false);
    const { container } = await setup();
    expect(container.register).not.toHaveBeenCalled();
  });
});

type SwEvent = {
  waitUntil?: (promise: Promise<unknown>) => void;
  data?: unknown;
};
type SwListener = (event: SwEvent) => void;

const loadServiceWorker = () => {
  const listeners = new Map<string, SwListener>();
  const skipWaiting = vi.fn();
  const claim = vi.fn(async () => undefined);
  const addAll = vi.fn(async () => undefined);
  const open = vi.fn(async () => ({ addAll }));
  const keys = vi.fn(async () => [] as string[]);
  const del = vi.fn(async () => true);
  const self = {
    addEventListener: (type: string, listener: SwListener) => {
      listeners.set(type, listener);
    },
    skipWaiting,
    clients: { claim },
  };
  vm.runInNewContext(swSource, {
    self,
    caches: { open, keys, match: vi.fn(), delete: del },
    fetch: vi.fn(),
  });
  return { listeners, skipWaiting, claim, open, keys, del };
};

const fire = (
  listeners: Map<string, SwListener>,
  type: string,
  init: { data?: unknown } = {},
) => {
  let waited: Promise<unknown> = Promise.resolve();
  listeners.get(type)?.({
    waitUntil: (promise) => {
      waited = promise;
    },
    data: init.data,
  });
  return waited;
};

describe("scripts/service-worker.js update gate", () => {
  it("precaches on install without taking over", async () => {
    const { listeners, open, skipWaiting } = loadServiceWorker();
    await fire(listeners, "install");
    expect(open).toHaveBeenCalledTimes(1);
    expect(skipWaiting).not.toHaveBeenCalled();
  });

  it("activates only after a SKIP_WAITING client message", () => {
    const { listeners, skipWaiting } = loadServiceWorker();
    fire(listeners, "message", { data: { type: "UNRELATED" } });
    expect(skipWaiting).not.toHaveBeenCalled();
    fire(listeners, "message", { data: { type: "SKIP_WAITING" } });
    expect(skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("purges stale caches and claims clients on activate", async () => {
    const { listeners, keys, del, claim } = loadServiceWorker();
    keys.mockResolvedValue([
      "ttt-shell-old",
      "ttt-shell-dev",
      "ttt-runtime",
      "unrelated",
    ]);
    await fire(listeners, "activate");
    expect(del).toHaveBeenCalledWith("ttt-shell-old");
    expect(del).toHaveBeenCalledWith("ttt-runtime");
    expect(del).not.toHaveBeenCalledWith("ttt-shell-dev");
    expect(del).not.toHaveBeenCalledWith("unrelated");
    expect(claim).toHaveBeenCalledTimes(1);
  });
});
