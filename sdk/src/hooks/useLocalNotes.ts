import { useCallback, useEffect, useState } from "react";
import type { PrivacyNote } from "./types";

const DEFAULT_STORAGE_KEY = "pilikino:notes";

function readNotes(storageKey: string): PrivacyNote[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrivacyNote[]) : [];
  } catch {
    return [];
  }
}

function writeNotes(storageKey: string, notes: PrivacyNote[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(notes));
}

export interface UseLocalNotesOptions {
  storageKey?: string;
}

export function useLocalNotes(options: UseLocalNotesOptions = {}) {
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const [notes, setNotes] = useState<PrivacyNote[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setNotes(readNotes(storageKey));
    setIsHydrated(true);
  }, [storageKey]);

  const replaceNotes = useCallback(
    (nextNotes: PrivacyNote[]) => {
      setNotes(nextNotes);
      writeNotes(storageKey, nextNotes);
    },
    [storageKey],
  );

  const addNote = useCallback(
    (note: PrivacyNote) => {
      setNotes((currentNotes: PrivacyNote[]) => {
        const nextNotes = [note, ...currentNotes];
        writeNotes(storageKey, nextNotes);
        return nextNotes;
      });
    },
    [storageKey],
  );

  const upsertNote = useCallback(
    (note: PrivacyNote) => {
      setNotes((currentNotes: PrivacyNote[]) => {
        const currentIndex = currentNotes.findIndex(
          (existing: PrivacyNote) => existing.id === note.id,
        );
        if (currentIndex === -1) {
          const nextNotes = [note, ...currentNotes];
          writeNotes(storageKey, nextNotes);
          return nextNotes;
        }

        const nextNotes = [...currentNotes];
        nextNotes[currentIndex] = note;
        writeNotes(storageKey, nextNotes);
        return nextNotes;
      });
    },
    [storageKey],
  );

  const removeNote = useCallback(
    (noteId: string) => {
      setNotes((currentNotes: PrivacyNote[]) => {
        const nextNotes = currentNotes.filter(
          (note: PrivacyNote) => note.id !== noteId,
        );
        writeNotes(storageKey, nextNotes);
        return nextNotes;
      });
    },
    [storageKey],
  );

  const clearNotes = useCallback(() => {
    replaceNotes([]);
  }, [replaceNotes]);

  const getNoteByCommitment = useCallback(
    (commitment: string) => {
      return (
        notes.find((note: PrivacyNote) => note.commitment === commitment) ?? null
      );
    },
    [notes],
  );

  return {
    notes,
    isHydrated,
    addNote,
    upsertNote,
    removeNote,
    clearNotes,
    getNoteByCommitment,
  };
}
