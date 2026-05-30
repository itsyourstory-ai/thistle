import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Shape = "tile" | "pill" | "swatch";

interface SelectableTileProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  selected: boolean;
  shape?: Shape;
  /** Hide the checkmark badge (rare — e.g. when content overlaps the corner). */
  hideCheck?: boolean;
}

/**
 * Standardized selectable box used across wizard steps (book type, genre,
 * mood, lesson, art style, language, character gender, hair, skin tone…).
 *
 * - Unified shadow + hover behavior across all shapes.
 * - Adds a green checkmark badge in the top-right corner when selected.
 * - Pure presentation — caller controls state.
 */
export function SelectableTile({
  selected,
  shape = "tile",
  hideCheck = false,
  className,
  children,
  ...rest
}: SelectableTileProps) {
  const base = "relative cursor-pointer transition-all border-2 shadow-sm";

  const shapeClass =
    shape === "pill"
      ? "rounded-full px-3.5 py-1.5 text-sm font-medium inline-flex items-center"
      : shape === "swatch"
        ? "rounded-full w-9 h-9"
        : "rounded-2xl";

  const selectedClass = selected
    ? "border-[hsl(var(--wizard-primary))] bg-[hsl(var(--wizard-primary)/0.08)] shadow-md"
    : "border-transparent bg-white hover:shadow-md hover:-translate-y-0.5";

  // Swatches keep their own background color via inline style; don't override.
  const swatchSelectedOverride =
    shape === "swatch"
      ? selected
        ? "border-[hsl(var(--wizard-primary))] shadow-md"
        : "border-transparent hover:shadow-md hover:scale-105"
      : "";

  return (
    <button
      type="button"
      {...rest}
      className={cn(
        base,
        shapeClass,
        shape === "swatch" ? swatchSelectedOverride : selectedClass,
        className,
      )}
    >
      {children}
      {selected && !hideCheck && <CheckBadge />}
    </button>
  );
}

function CheckBadge() {
  return (
    <span
      aria-hidden
      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm ring-2 ring-white"
      style={{ backgroundColor: "hsl(var(--wizard-primary))" }}
    >
      <Check className="w-3 h-3 text-white" strokeWidth={3} />
    </span>
  );
}

export default SelectableTile;
