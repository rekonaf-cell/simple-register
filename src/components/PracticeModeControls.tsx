"use client";

import { setPracticeMode, usePracticeMode } from "@/lib/practiceMode";

export function PracticeModeToggle() {
  const practiceMode = usePracticeMode();

  return (
    <button
      onClick={() => setPracticeMode(!practiceMode)}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
        practiceMode ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-500"
      }`}
    >
      {practiceMode ? "練習モード中" : "練習モード"}
    </button>
  );
}

export function PracticeModeBanner() {
  const practiceMode = usePracticeMode();

  if (!practiceMode) return null;

  return (
    <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-white">
      練習モード：この端末で作る注文は売上に反映されません
    </div>
  );
}
