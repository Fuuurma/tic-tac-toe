import { describe, expect, it } from "vitest";
import { GRID_STEP, createHeatField, type RippleSpec } from "./backgroundField";

/**
 * The heat field is the model behind the pointer/touch reveal: every symbol
 * carries a heat that stimuli raise and time bleeds off. These pins read the
 * model directly — no canvas — so a regression in the reveal's shape shows up
 * here before it shows up as a pixel.
 */

const WIDTH = 440;
const HEIGHT = 440;

const field = () => {
  const f = createHeatField();
  f.rebuild(WIDTH, HEIGHT, 7);
  return f;
};

/** The symbol whose resting position is nearest (x, y). */
const nearest = (f: ReturnType<typeof field>, x: number, y: number) => {
  let best = 0;
  let bestDistance = Infinity;
  f.symbols.forEach((symbol, i) => {
    const d = Math.hypot(symbol.x - x, symbol.y - y);
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  return best;
};

const ripple = (overrides: Partial<RippleSpec> = {}): RippleSpec => ({
  x: 220,
  y: 220,
  now: 0,
  duration: 1000,
  radius: 200,
  band: 40,
  strength: 1,
  ...overrides,
});

describe("heat field grid", () => {
  it("lays one symbol per cell and reflows the same field from the same seed", () => {
    const f = field();
    expect(f.symbols.length).toBe(Math.ceil(WIDTH / GRID_STEP) * Math.ceil(HEIGHT / GRID_STEP));

    const again = createHeatField();
    again.rebuild(WIDTH, HEIGHT, 7);
    expect(again.symbols.map((s) => s.shape)).toEqual(f.symbols.map((s) => s.shape));
  });
});

describe("heat field stamp", () => {
  it("lights a disc around the stimulus, strongest at its centre", () => {
    const f = field();
    f.stamp(220, 220, 220, 220, 120);

    const centre = nearest(f, 220, 220);
    const edge = nearest(f, 220 + 100, 220);
    const outside = nearest(f, 220 + 180, 220);

    expect(f.heat[centre]).toBeGreaterThan(0.9);
    expect(f.heat[edge]).toBeGreaterThan(0);
    expect(f.heat[edge]).toBeLessThan(f.heat[centre]);
    expect(f.heat[outside]).toBe(0);
  });

  it("lights the whole path of a fast pointer, not just where it ended", () => {
    const f = field();
    f.stamp(60, 220, 380, 220, 60);

    const middle = nearest(f, 220, 220);
    expect(f.heat[middle]).toBeGreaterThan(0.5);
    expect(f.heat[nearest(f, 60, 220)]).toBeGreaterThan(0.5);
    expect(f.heat[nearest(f, 220, 220 + 150)]).toBe(0);
  });

  it("pushes lit symbols away from the stimulus", () => {
    const f = field();
    f.stamp(220, 220, 220, 220, 120);

    const right = nearest(f, 220 + 70, 220);
    const left = nearest(f, 220 - 70, 220);
    expect(f.pushX[right]).toBeGreaterThan(0.5);
    expect(f.pushX[left]).toBeLessThan(-0.5);
  });

  it("never lowers a symbol a stronger stimulus already lit", () => {
    const f = field();
    f.stamp(220, 220, 220, 220, 120);
    const i = nearest(f, 220, 220);
    const before = f.heat[i];
    f.stamp(220 + 100, 220, 220 + 100, 220, 120);
    expect(f.heat[i]).toBe(before);
  });
});

describe("heat field fade", () => {
  it("bleeds heat off exponentially, so the wake dissolves instead of cutting out", () => {
    const f = field();
    f.stamp(220, 220, 220, 220, 120);
    const i = nearest(f, 220, 220);
    const start = f.heat[i];

    f.advance(100, 100, 200);
    expect(f.heat[i]).toBeCloseTo(start * Math.exp(-100 / 200), 4);

    f.advance(200, 100, 200);
    expect(f.heat[i]).toBeCloseTo(start * Math.exp(-200 / 200), 4);
  });

  it("drops a symbol from the hot list once it has faded out", () => {
    const f = field();
    f.stamp(220, 220, 220, 220, 120);
    expect(f.hot.length).toBeGreaterThan(0);

    for (let t = 50; t <= 4000; t += 50) f.advance(t, 50, 200);

    expect(f.hot.length).toBe(0);
    expect(f.bounds()).toBeNull();
    expect(Math.max(...f.heat)).toBe(0);
  });

  it("holds a symbol steady while the stimulus keeps refreshing it", () => {
    const f = field();
    const i = nearest(f, 220, 220);

    let last = 0;
    for (let t = 16; t <= 480; t += 16) {
      f.advance(t, 16, 200);
      f.stamp(220, 220, 220, 220, 120);
      last = f.heat[i];
    }
    expect(last).toBeGreaterThan(0.9);
  });

  it("settles only when nothing is fading and no ripple is travelling", () => {
    const f = field();
    expect(f.settled()).toBe(true);

    f.advance(16, 16, 200);
    f.stamp(220, 220, 220, 220, 120);
    expect(f.settled()).toBe(true); // parked pointer: held, not fading

    f.advance(32, 16, 200); // pointer stopped refreshing
    expect(f.settled()).toBe(false);

    for (let t = 48; t <= 4000; t += 16) f.advance(t, 16, 200);
    expect(f.settled()).toBe(true);
  });
});

describe("heat field floor", () => {
  it("never lights a symbol below the floor, so the hot list holds only what shows", () => {
    const f = createHeatField(0.5);
    f.rebuild(WIDTH, HEIGHT, 7);
    f.stamp(220, 220, 220, 220, 120);

    for (const i of f.hot) expect(f.heat[i]).toBeGreaterThanOrEqual(0.5);
    const edge = nearest(f, 220 + 100, 220);
    expect(f.heat[edge]).toBe(0);
    expect(f.hot.length).toBeGreaterThan(0);
  });

  it("drops a symbol the moment it cools past the floor", () => {
    const f = createHeatField(0.5);
    f.rebuild(WIDTH, HEIGHT, 7);
    f.stamp(220, 220, 220, 220, 120);
    const before = f.hot.length;

    f.advance(100, 100, 100); // e^-1 of the heat: most fall below 0.5
    expect(f.hot.length).toBeLessThan(before);
    for (const i of f.hot) expect(f.heat[i]).toBeGreaterThanOrEqual(0.5);
  });
});

describe("heat field ripple", () => {
  it("lights a ring that travels outward and pushes symbols along with it", () => {
    const f = field();
    f.addRipple(ripple());

    f.advance(250, 16, 200);
    const earlyRadius = f.ripples[0].r;
    expect(earlyRadius).toBeGreaterThan(0);
    const ringSymbol = nearest(f, 220 + earlyRadius, 220);
    expect(f.heat[ringSymbol]).toBeGreaterThan(0.2);
    expect(f.pushX[ringSymbol]).toBeGreaterThan(0.5);
    // The centre is quiet: the ring has left it.
    expect(f.heat[nearest(f, 220, 220)]).toBeLessThan(f.heat[ringSymbol]);

    f.advance(700, 16, 200);
    expect(f.ripples[0].r).toBeGreaterThan(earlyRadius);
  });

  it("opens fast and settles slowly (ease-out), so a tap answers instantly", () => {
    const f = field();
    f.addRipple(ripple());

    f.advance(100, 16, 200);
    const first = f.ripples[0].r;
    f.advance(900, 16, 200);
    const last = f.ripples[0].r;
    f.advance(999, 16, 200);
    const final = f.ripples[0].r;
    expect(final).toBeGreaterThan(last);

    // Most of the radius is covered in the opening tenth of the life.
    expect(first / 200).toBeGreaterThan(0.25);
    expect(final - last).toBeLessThan(first);
  });

  it("loses amplitude as it spreads and is removed when its time is up", () => {
    const f = field();
    f.addRipple(ripple());

    f.advance(100, 16, 200);
    const earlyAmp = f.ripples[0].amp;
    f.advance(800, 16, 200);
    expect(f.ripples[0].amp).toBeLessThan(earlyAmp);

    f.advance(1200, 16, 200);
    expect(f.ripples.length).toBe(0);
  });

  it("keeps at most four rings alive, dropping the oldest", () => {
    const f = field();
    for (let i = 0; i < 6; i++) f.addRipple(ripple({ x: 40 * i, now: i }));
    expect(f.ripples.length).toBe(4);
    expect(f.ripples[0].x).toBe(80);
  });

  it("is not settled while a ring is travelling", () => {
    const f = field();
    f.addRipple(ripple());
    f.advance(16, 16, 200);
    expect(f.settled()).toBe(false);
  });
});

describe("heat field bounds", () => {
  it("boxes exactly the lit symbols", () => {
    const f = field();
    f.stamp(220, 220, 220, 220, 60);
    const box = f.bounds()!;
    expect(box.w).toBeGreaterThan(0);
    expect(box.w).toBeLessThan(2 * 60 + 2 * GRID_STEP);
    expect(box.x + box.w / 2).toBeGreaterThan(200);
    expect(box.x + box.w / 2).toBeLessThan(240);
  });
});
