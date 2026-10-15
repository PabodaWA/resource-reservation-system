"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_CHANGE_EVENT = "resourcehub:local-storage-change";

export function useLocalStorageValue(key: string, fallback: string): string {
  const subscribe = useCallback(
    (onChange: () => void) => {
      function handleChange(event: Event) {
        const storageEvent = event as StorageEvent;
        const changedKey =
          storageEvent.key === undefined
            ? (event as CustomEvent<string>).detail
            : storageEvent.key;

        if (changedKey === key || changedKey === null) {
          onChange();
        }
      }

      window.addEventListener("storage", handleChange);
      window.addEventListener(STORAGE_CHANGE_EVENT, handleChange);
      return () => {
        window.removeEventListener("storage", handleChange);
        window.removeEventListener(STORAGE_CHANGE_EVENT, handleChange);
      };
    },
    [key]
  );
  const getSnapshot = useCallback(
    () => window.localStorage.getItem(key) ?? fallback,
    [fallback, key]
  );
  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setLocalStorageValue(key: string, value: string) {
  window.localStorage.setItem(key, value);
  window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT, { detail: key }));
}
