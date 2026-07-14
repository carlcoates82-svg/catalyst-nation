"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-slate px-4 py-2 text-xs text-off-white hover:bg-slate"
    >
      Print / Save as PDF
    </button>
  );
}
