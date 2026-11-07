"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => router.refresh(), 8000);
    return () => window.clearInterval(id);
  }, [active, router]);

  if (!active) return null;
  return <p className="text-sm text-ink-soft">La página se actualiza sola mientras haya trabajos en cola.</p>;
}
