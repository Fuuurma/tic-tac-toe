import { describe, expect, it } from "vitest";
import { isPeerMessage } from "./peer.wire";
import { REACTIONS, REACTION_ICONS, REACTION_LABELS } from "./social";

describe("social messages", () => {
  it("accepts supported reaction IDs and rejects free text", () => {
    expect(isPeerMessage({ type: "social_reaction", id: "nice_move" })).toBe(true);
    expect(isPeerMessage({ type: "social_reaction", id: "anything" })).toBe(false);
  });
});

describe("reaction copy", () => {
  // The label and icon tables used to be index-parallel arrays that lived
  // in the component: an id added to REACTIONS without a matching entry
  // rendered "undefined undefined" and no type error said so. They are
  // keyed by id now, so the compiler catches a missing entry; these two
  // tests are the runtime net for the same fact.
  it("labels every REACTIONS id in every locale", () => {
    const missing = REACTIONS.filter((id) =>
      Object.values(REACTION_LABELS).some((labels) => !labels[id]),
    );
    expect(missing).toEqual([]);
  });

  it("gives every REACTIONS id an icon", () => {
    const missing = REACTIONS.filter((id) => !REACTION_ICONS[id]);
    expect(missing).toEqual([]);
  });
});
