"use client";

import { cn } from "@/lib/utils";

/**
 * Flex-based switch: the knob is laid out with justify-content, no absolute
 * positioning, so it can never overflow or misalign on iOS.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "h-7 w-12 rounded-full p-1 flex items-center transition-colors shrink-0 disabled:opacity-60",
        checked ? "bg-brand justify-end" : "bg-border justify-start"
      )}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );
}
