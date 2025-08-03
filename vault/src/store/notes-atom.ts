import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { notesApi } from "../api/notesApi";
import type {
  Note,
  NotesState,
  WikiLinkSuggestion,
  ApiError,
} from "../types/notes";

export const notesAtom = atom<Note[]>([]);
export const currentNoteAtom = atom<Note | null>(null);
export const isLoadingAtom = atom<boolean>(false);
export const errorAtom = atom<ApiError | null>(null);
export const lastSyncAtom = atom<Date | null>(null);
export const wikiSuggestionsAtom = atom<WikiLinkSuggestion[]>([]);

export const notesStateAtom = atom<NotesState>((get) => ({
  notes: get(notesAtom),
  currentNote: get(currentNoteAtom),
  isLoading: get(isLoadingAtom),
  error: get(errorAtom),
  lastSync: get(lastSyncAtom),
}));

export const searchQueryAtom = atom<string>("");
export const filteredNotesAtom = atom((get) => {
  const notes = get(notesAtom);
  const query = get(searchQueryAtom).toLowerCase();

  if (!query) return notes;

  return notes.filter(
    (note) =>
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      Object.values(note.frontmatter).some(
        (value) =>
          typeof value === "string" && value.toLowerCase().includes(query)
      )
  );
});

export const fetchNotesAtom = atom(null, async (_get, set) => {
  set(isLoadingAtom, true);
  set(errorAtom, null);

  try {
    const notes = await notesApi.getAllNotes();
    set(notesAtom, notes);
    set(lastSyncAtom, new Date());
  } catch (error) {
    console.error("Error fetching notes:", error);
    set(errorAtom, error as ApiError);
  } finally {
    set(isLoadingAtom, false);
  }
});

export const fetchNoteAtom = atom(null, async (get, set, noteId: string) => {
  set(isLoadingAtom, true);
  set(errorAtom, null);

  try {
    const note = await notesApi.getNote(noteId);
    set(currentNoteAtom, note);

    const notes = get(notesAtom);
    const updatedNotes = notes.some((n) => n.id === note.id)
      ? notes.map((n) => (n.id === note.id ? note : n))
      : [...notes, note];

    set(notesAtom, updatedNotes);
    return note;
  } catch (error) {
    console.error("Error fetching note:", error);
    set(errorAtom, error as ApiError);
    throw error;
  } finally {
    set(isLoadingAtom, false);
  }
});

export const saveNoteAtom = atom(
  null,
  async (get, set, noteData: Partial<Note>) => {
    set(isLoadingAtom, true);
    set(errorAtom, null);

    const currentNote = get(currentNoteAtom);
    const isUpdate = currentNote && currentNote.id;

    try {
      let savedNote: Note;

      if (isUpdate) {
        const optimisticNote: Note = {
          ...currentNote,
          ...noteData,
          updatedAt: new Date(),
        };
        set(currentNoteAtom, optimisticNote);

        const notes = get(notesAtom);
        set(
          notesAtom,
          notes.map((n) => (n.id === optimisticNote.id ? optimisticNote : n))
        );

        savedNote = await notesApi.updateNote(currentNote.id, optimisticNote);
      } else {
        savedNote = await notesApi.createNote(noteData);
      }

      set(currentNoteAtom, savedNote);

      const notes = get(notesAtom);
      const updatedNotes = notes.map((n) =>
        n.id === savedNote.id ? savedNote : n
      );
      if (!notes.find((n) => n.id === savedNote.id)) {
        updatedNotes.push(savedNote);
      }
      set(notesAtom, updatedNotes);

      set(lastSyncAtom, new Date());

      return savedNote;
    } catch (error) {
      if (isUpdate) {
        set(currentNoteAtom, currentNote);
        const notes = get(notesAtom);
        set(
          notesAtom,
          notes.map((n) => (n.id === currentNote.id ? currentNote : n))
        );
      }
      console.error("Error saving note:", error);
      set(errorAtom, error as ApiError);
      throw error;
    } finally {
      set(isLoadingAtom, false);
    }
  }
);

export const deleteNoteAtom = atom(null, async (get, set, noteId: string) => {
  set(isLoadingAtom, true);
  set(errorAtom, null);

  // Optimistic delete
  const notes = get(notesAtom);
  const noteToDelete = notes.find((n) => n.id === noteId);
  const optimisticNotes = notes.filter((n) => n.id !== noteId);
  set(notesAtom, optimisticNotes);

  const currentNote = get(currentNoteAtom);
  if (currentNote?.id === noteId) {
    set(currentNoteAtom, null);
  }

  try {
    await notesApi.deleteNote(noteId);
    set(lastSyncAtom, new Date());
  } catch (error) {
    // Revert optimistic delete
    if (noteToDelete) {
      set(notesAtom, [...optimisticNotes, noteToDelete]);
      if (currentNote?.id === noteId) {
        set(currentNoteAtom, currentNote);
      }
    }
    set(errorAtom, error as ApiError);
    throw error;
  } finally {
    set(isLoadingAtom, false);
  }
});

export const searchNotesAtom = atom(null, async (get, set, query: string) => {
  if (!query.trim()) {
    set(searchQueryAtom, "");
    return;
  }

  set(searchQueryAtom, query);
  set(isLoadingAtom, true);
  set(errorAtom, null);

  try {
    const results = await notesApi.searchNotes(query);
    // Update notes with search results, merging with existing notes
    const existingNotes = get(notesAtom);
    const mergedNotes = [...existingNotes];

    results.forEach((result) => {
      const existingIndex = mergedNotes.findIndex((n) => n.id === result.id);
      if (existingIndex >= 0) {
        mergedNotes[existingIndex] = result;
      } else {
        mergedNotes.push(result);
      }
    });

    set(notesAtom, mergedNotes);
    return results;
  } catch (error) {
    set(errorAtom, error as ApiError);
    throw error;
  } finally {
    set(isLoadingAtom, false);
  }
});

export const fetchWikiSuggestionsAtom = atom(null, async (_get, set) => {
  try {
    const suggestions = await notesApi.getNoteTitles();
    set(wikiSuggestionsAtom, suggestions);
    return suggestions;
  } catch (error) {
    console.error("Failed to fetch wiki suggestions:", error);
    // Don't set error for suggestions as it's not critical
    return [];
  }
});

// Utility atoms
export const createNewNoteAtom = atom(null, (_get, set) => {
  set(currentNoteAtom, null);
  set(errorAtom, null);
});

export const clearErrorAtom = atom(null, (_get, set) => {
  set(errorAtom, null);
});

// Auto-sync atom (runs every 30 seconds)
export const autoSyncAtom = atom(null, async (get, set) => {
  const lastSync = get(lastSyncAtom);
  const now = new Date();

  // Only sync if more than 30 seconds have passed
  if (lastSync && now.getTime() - lastSync.getTime() < 30000) {
    return;
  }

  try {
    await set(fetchNotesAtom);
    await set(fetchWikiSuggestionsAtom);
  } catch (error) {
    console.error("Auto-sync failed:", error);
    // Don't set error state for auto-sync failures
  }
});

// Persistence atoms (for offline support)
export const cachedNotesAtom = atomWithStorage("notes-cache", [] as Note[]);
export const offlineModeAtom = atom<boolean>(false);

// Sync cached notes with server
export const syncCachedNotesAtom = atom(null, async (get, set) => {
  const cachedNotes = get(cachedNotesAtom);
  const isOffline = get(offlineModeAtom);

  if (isOffline || cachedNotes.length === 0) return;

  try {
    const serverNotes = await notesApi.getAllNotes();

    // Merge cached notes with server notes
    // This is a simple merge - in production you'd want conflict resolution
    const mergedNotes = [...serverNotes];

    cachedNotes.forEach((cachedNote) => {
      const serverNote = serverNotes.find((n) => n.id === cachedNote.id);
      if (!serverNote) {
        // Note exists only in cache, upload it
        set(saveNoteAtom, cachedNote);
      } else if (
        new Date(cachedNote.updatedAt) > new Date(serverNote.updatedAt)
      ) {
        // Cached note is newer, update server
        set(saveNoteAtom, cachedNote);
      }
    });

    set(notesAtom, mergedNotes);
    set(cachedNotesAtom, []);
    set(lastSyncAtom, new Date());
  } catch (error) {
    set(offlineModeAtom, true);
    set(errorAtom, error as ApiError);
  }
});
