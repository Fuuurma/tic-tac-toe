import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { Sheet } from "@/components/ui/sheet";
import { en } from "./en";
import { es } from "./es";
import { setLocale } from "./language";

afterEach(() => {
  setLocale("en");
});

const tip3 = (dict: { "help.tip3.title": string; "help.tip3.body": string }) =>
  `${dict["help.tip3.title"]} ${dict["help.tip3.body"]}`;

const sheetMarkup = (extra: { closeLabel?: string } = {}) =>
  renderToStaticMarkup(
    createElement(Sheet, {
      open: true,
      onClose: () => {},
      title: "How to play",
      children: "Rules",
      ...extra,
    }),
  );

describe("help tip 3 win copy", () => {
  it("keeps fixed-green language out of the English win tip", () => {
    expect(tip3(en)).not.toMatch(/emerald|green/i);
  });

  it("keeps fixed-green language out of the Spanish win tip", () => {
    expect(tip3(es)).not.toMatch(/verde/i);
  });

  it("describes winning cells in the winner's own colour", () => {
    expect(en["help.tip3.body"]).toContain("winner's own color");
    expect(es["help.tip3.body"]).toContain("el color del ganador");
  });
});

describe("Sheet default close label", () => {
  it("shows Close in English when closeLabel is omitted", () => {
    setLocale("en");
    expect(sheetMarkup()).toContain('aria-label="Close"');
  });

  it("shows Cerrar in Spanish when closeLabel is omitted", () => {
    setLocale("es");
    expect(sheetMarkup()).toContain('aria-label="Cerrar"');
  });

  it("keeps an explicit closeLabel over the locale default", () => {
    setLocale("es");
    const markup = sheetMarkup({ closeLabel: "Close help" });
    expect(markup).toContain('aria-label="Close help"');
    expect(markup).not.toContain('aria-label="Cerrar"');
  });
});
