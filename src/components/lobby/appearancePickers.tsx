import { useId, useRef, useState } from "react";
import {
  COLOR_BG_CLASSES,
  type Color,
  type SymbolShape,
} from "@/game/constants";
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
 * Color and symbol pickers, one DOM structure for both layouts.
 *
 * The icon-led tiles sit side by side. The chosen color fills its tile (no
 * check mark — the filled tile plus its ring is the signal), and the chosen
 * symbol is centered in its tile. Tapping one expands its full-width
 * choices below; only one panel is open at a time.
 * The groups use `display: contents` so triggers and panels share the grid.
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
      className="grid grid-cols-2 gap-3"
    >
      <div role="group" aria-label="Color" className="contents">
        <PickerTrigger
          ref={colorTriggerRef}
          open={open === "color"}
          controls={colorPanelId}
          ariaLabel={colorLabel}
          label="Color"
          presentation="tile"
          onToggle={() => setOpen(open === "color" ? null : "color")}
          preview={
            <span
              className={cn(
                "absolute inset-0 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-8px_14px_-10px_rgba(0,0,0,0.4)]",
                COLOR_BG_CLASSES[color],
              )}
            />
          }
        />
        <PickerPanel
          id={colorPanelId}
          open={open === "color"}
          className="row-start-2"
        >
          <ColorPicker label={colorLabel} value={color} onChange={onColorChange} />
        </PickerPanel>
      </div>

      <div role="group" aria-label="Symbol" className="contents">
        <PickerTrigger
          ref={shapeTriggerRef}
          open={open === "shape"}
          controls={shapePanelId}
          ariaLabel={shapeLabel}
          label="Symbol"
          presentation="tile"
          disabled={shapeDisabled}
          onToggle={() => setOpen(open === "shape" ? null : "shape")}
          preview={
            <SymbolShapeRenderer
              shape={shape}
              strokeWidth={10}
              className="size-11 text-[rgb(var(--player-color))]"
            />
          }
        />
        {!shapeDisabled && (
          <PickerPanel
            id={shapePanelId}
            open={open === "shape"}
            className="row-start-2"
          >
            <SymbolShapePicker label={shapeLabel} value={shape} onChange={onShapeChange} />
          </PickerPanel>
        )}
        {shapeDisabled && (
          <p className="col-span-2 text-xs leading-tight text-muted-foreground max-sm:text-sm">
            Online rooms assign your symbol when you connect.
          </p>
        )}
      </div>
    </PickerDisclosureRoot>
  );
}
