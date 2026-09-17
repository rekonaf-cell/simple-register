"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "simple-register:practice-mode";
const listeners = new Set<() => void>();

function readStorage(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

function getServerSnapshot() {
  return false;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function setPracticeMode(value: boolean) {
  localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  listeners.forEach((listener) => listener());
}

export function usePracticeMode() {
  return useSyncExternalStore(subscribe, readStorage, getServerSnapshot);
}
