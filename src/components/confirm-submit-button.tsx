"use client";

import { useState } from "react";

/** Two-click in-app confirm instead of a native confirm() dialog — matches
 * the app's styling and is testable, unlike a native dialog. */
export function ConfirmSubmitButton({
  label,
  confirmLabel = "Confirm?",
  className,
}: {
  label: string;
  confirmLabel?: string;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={className}>
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="submit" className="text-bronze hover:underline">
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-ash hover:underline"
      >
        Cancel
      </button>
    </span>
  );
}
