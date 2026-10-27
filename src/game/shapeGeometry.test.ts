import { describe, expect, it } from "vitest";
import { AVAILABLE_SHAPES, SymbolShape } from "./constants";
import { SHAPE_GEOMETRY, shapeBounds, toSvgPath } from "./shapeGeometry";

// The board draws these centerlines with a 7-unit stroke, so ink reaches
// 3.5 units beyond the numbers below (a little more for the X, which is
// drawn heavier). SAFE keeps that ink well inside the 100-unit box.
const SAFE_MIN = 12;
const SAFE_MAX = 88;

describe("shape geometry", () => {
  it("covers every shape, and only those", () => {
    expect(Object.keys(SHAPE_GEOMETRY).sort()).toEqual([...AVAILABLE_SHAPES].sort());
  });

  it("has no hexagon: the crescent took its slot", () => {
    expect(AVAILABLE_SHAPES).not.toContain("hexagon");
    expect(AVAILABLE_SHAPES).toContain(SymbolShape.CRESCENT);
    expect(AVAILABLE_SHAPES).toHaveLength(8);
  });

  it.each(AVAILABLE_SHAPES)("%s keeps its ink inside the box", (shape) => {
    const b = shapeBounds(SHAPE_GEOMETRY[shape]);
    expect(b.minX).toBeGreaterThanOrEqual(SAFE_MIN);
    expect(b.minY).toBeGreaterThanOrEqual(SAFE_MIN);
    expect(b.maxX).toBeLessThanOrEqual(SAFE_MAX);
    expect(b.maxY).toBeLessThanOrEqual(SAFE_MAX);
  });

  it.each(AVAILABLE_SHAPES)("%s is centred", (shape) => {
    const b = shapeBounds(SHAPE_GEOMETRY[shape]);
    // Horizontal centring is exact. Vertically a shape may sit a few units off
    // for optical balance (a triangle's mass is low, a heart's is high).
    expect(Math.abs((b.minX + b.maxX) / 2 - 50)).toBeLessThanOrEqual(1);
    expect(Math.abs((b.minY + b.maxY) / 2 - 50)).toBeLessThanOrEqual(6);
  });

  it.each(AVAILABLE_SHAPES)("%s is about as big as its neighbours", (shape) => {
    // The old set ran from a 60-unit X to a 99-unit heart.
    const b = shapeBounds(SHAPE_GEOMETRY[shape]);
    const longest = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    expect(longest).toBeGreaterThanOrEqual(54);
    expect(longest).toBeLessThanOrEqual(76);
  });

  it.each(AVAILABLE_SHAPES)("%s serialises to finite SVG path data", (shape) => {
    for (const path of SHAPE_GEOMETRY[shape].paths) {
      const d = toSvgPath(path);
      expect(d.startsWith("M")).toBe(true);
      expect(d).not.toMatch(/NaN|Infinity/);
    }
  });

  describe("field outlines (the background's cheaper copy)", () => {
    const withField = AVAILABLE_SHAPES.filter((s) => SHAPE_GEOMETRY[s].field);

    it("exist only for the shapes whose detail is invisible at that size", () => {
      // Circles and the crescent are single native arcs, already cheap.
      expect(withField.sort()).toEqual([SymbolShape.SQUARE, SymbolShape.HEART].sort());
    });

    it.each(withField)("%s stays within 2 units of the board's shape", (shape) => {
      const fine = shapeBounds(SHAPE_GEOMETRY[shape]);
      const field = shapeBounds({ paths: SHAPE_GEOMETRY[shape].field! });
      for (const edge of ["minX", "maxX", "minY", "maxY"] as const) {
        expect(Math.abs(field[edge] - fine[edge]), edge).toBeLessThanOrEqual(2);
      }
    });

    it.each(withField)("%s has fewer segments than the board's shape", (shape) => {
      const count = (paths: readonly (readonly unknown[])[]) => paths.reduce((n, p) => n + p.length, 0);
      expect(count(SHAPE_GEOMETRY[shape].field!)).toBeLessThan(count(SHAPE_GEOMETRY[shape].paths));
    });

    it("keeps every field outline to at most 3 curved segments (frame time was measured at that)", () => {
      for (const shape of AVAILABLE_SHAPES) {
        const paths = SHAPE_GEOMETRY[shape].field ?? SHAPE_GEOMETRY[shape].paths;
        const curved = paths.flat().filter((c) => c[0] === "C" || c[0] === "A").length;
        expect(curved, shape).toBeLessThanOrEqual(3);
      }
    });
  });

  it("writes circles and arcs as exact SVG arcs, a full turn as two halves", () => {
    const circle = toSvgPath(SHAPE_GEOMETRY[SymbolShape.O].paths[0]);
    expect(circle).toBe("M 84 50 A 34 34 0 0 1 16 50 A 34 34 0 0 1 84 50 Z");
    expect(toSvgPath(SHAPE_GEOMETRY[SymbolShape.CRESCENT].paths[0])).toMatch(/^M [\d.]+ [\d.]+ A 34 34 0 1 0 .* A 28 28 0 1 1 .* Z$/);
  });

  it("draws the X heavier than the outlines, because its strokes cross", () => {
    expect(SHAPE_GEOMETRY[SymbolShape.X].weight).toBeGreaterThan(1);
    for (const shape of AVAILABLE_SHAPES.filter((s) => s !== SymbolShape.X)) {
      expect(SHAPE_GEOMETRY[shape].weight).toBe(1);
    }
  });
});
