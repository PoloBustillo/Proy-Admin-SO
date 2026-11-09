"use client";

import { useFormStatus } from "react-dom";

export function PlayButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-play" disabled={pending} aria-label={label}>
      {pending ? (
        <span className="btn-play-mark" aria-hidden="true" />
      ) : (
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M3 1.5v9l8-4.5-8-4.5z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
