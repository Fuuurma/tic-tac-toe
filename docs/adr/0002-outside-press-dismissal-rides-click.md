# Outside-press dismissal rides click, not pointerdown

Picker panels inside bottom sheets close on `click` even though `pointerdown` fires earlier: closing a panel reflows the sheet and moves its own close button (~35px on a phone), so a pointerdown-based dismissal split the press and the release across two elements and silently swallowed the tap — with a picker open, the sheet's ✕ needed two taps. Batching the dismissal with whatever the press targeted in one `click` event keeps the reflow after the tap has resolved.

## Considered options

- `pointerdown` — rejected: the reflow lands mid-gesture and the release hits a different element.
- `click` — chosen: dismissal and target resolve in the same batch.

## Consequences

A drag produces no click, so a scroll never dismisses; Escape stays local to the component (the sheet-level Escape-to-close listener must not see an open dropdown's dismissal).
