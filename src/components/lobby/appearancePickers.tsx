import { useId, useRef, useState } from "react";
import { COLOR_BG_CLASSES, type Color, type SymbolShape } from "@/game/constants";
import { cn } from "@/lib/utils";
import { SymbolShapeRenderer } from "../game/symbolShapeRenderer";
import { ColorPicker } from "./colorPicker";
import { SymbolShapePicker } from "./symbolShapePicker";
import {
  PickerDisclosureRoot,
  PickerPanel,
  PickerTrigger,
} from "./pickerDisclosure";
import { useDismissOnOutsidePress } from "@/hooks/useDismissOnOutsidePress";

type OpenPicker = "color" | "shape";

interface AppearancePickersProps {
  colorLabel: string;
  shapeLabel: string;
  color: Color;
  shape: SymbolShape;
  shapeDisabled?: boolean;
  onColorChange: (color: Color) => void;
  onShapeChange: (shape: SymbolShape) => void;
}

/**
 * Color + shape as a pair of select-style triggers: the two buttons sit
 * side by side, and the 8-option grid expands full-width below them. Only
 * one panel is open at a time; it stays open after a pick so the selection
 * is visible, and collapses on toggle, Escape, or an outside press.
 */
export function AppearancePickers({
  colorLabel,
  shapeLabel,
  color,
  shape,
  shapeDisabled = false,
  onColorChange,
  onShapeChange,
}: AppearancePickersProps) {
  const [open, setOpen] = useState<OpenPicker | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const colorTriggerRef = useRef<HTMLButtonElement>(null);
  const shapeTriggerRef = useRef<HTMLButtonElement>(null);
  const colorPanelId = useId();
  const shapePanelId = useId();

  useDismissOnOutsidePress(rootRef, open !== null, () => setOpen(null));

  // Escape closes the panel and returns focus to its trigger — without the
  // refocus, dismissing while a radio had focus drops focus onto the body.
  const dismiss = () => {
    const trigger =
      open === "color" ? colorTriggerRef.current : shapeTriggerRef.current;
    setOpen(null);
    trigger?.focus();
  };

  return (
    <PickerDisclosureRoot
      ref={rootRef}
      open={open !== null}
      onEscape={dismiss}
      className="grid grid-cols-2 gap-2"
    >
      <PickerTrigger
        ref={colorTriggerRef}
        open={open === "color"}
        controls={colorPanelId}
        ariaLabel={colorLabel}
        label="Color"
        onToggle={() => setOpen(open === "color" ? null : "color")}
        preview={
          <span
            aria-hidden="true"
            className={cn(
              "size-5 shrink-0 rounded-full border border-black/10 shadow-sm",
              COLOR_BG_CLASSES[color],
            )}
          />
        }
      />
      <PickerTrigger
        ref={shapeTriggerRef}
        open={open === "shape"}
        controls={shapePanelId}
        ariaLabel={shapeLabel}
        label="Symbol"
        disabled={shapeDisabled}
        onToggle={() => setOpen(open === "shape" ? null : "shape")}
        preview={
          <SymbolShapeRenderer
            shape={shape}
            strokeWidth={10}
            className="size-5 shrink-0 text-foreground"
          />
        }
      />
      {open === "color" && (
        <PickerPanel id={colorPanelId}>
          <ColorPicker label={colorLabel} value={color} onChange={onColorChange} />
        </PickerPanel>
      )}
      {open === "shape" && (
        <PickerPanel id={shapePanelId}>
          <SymbolShapePicker label={shapeLabel} value={shape} onChange={onShapeChange} />
        </PickerPanel>
      )}
      {shapeDisabled && (
        <p className="col-span-2 text-xs leading-tight text-muted-foreground">
          Online rooms assign your symbol when you connect.
        </p>
      )}
    </PickerDisclosureRoot>
  );
}
