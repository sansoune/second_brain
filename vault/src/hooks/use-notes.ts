import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import {
  notesStateAtom,
  currentNoteAtom,
  filteredNotesAtom,
  wikiSuggestionsAtom,
  searchQueryAtom,
  fetchNotesAtom,
  fetchNoteAtom,
  saveNoteAtom,
  deleteNoteAtom,
  searchNotesAtom,
  fetchWikiSuggestionsAtom,
  createNewNoteAtom,
  clearErrorAtom,
  autoSyncAtom,
  syncCachedNotesAtom,
  offlineModeAtom,
} from "../store/notes-atom";
import type { Note } from "../types/notes";

export function useNotes() {
  const notesState = useAtomValue(notesStateAtom);
  const filteredNotes = useAtomValue(filteredNotesAtom);
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const fetchNotes = useSetAtom(fetchNotesAtom);
  const searchNotes = useSetAtom(searchNotesAtom);
  const syncCached = useSetAtom(syncCachedNotesAtom);
  const autoSync = useSetAtom(autoSyncAtom);

  // Auto-sync on mount and set up interval
  useEffect(() => {
    fetchNotes();
    syncCached();

    const interval = setInterval(() => {
      autoSync();
    }, 30000); // Auto-sync every 30 seconds

    return () => clearInterval(interval);
  }, [fetchNotes, syncCached, autoSync]);

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.trim()) {
        await searchNotes(query);
      }
    },
    [setSearchQuery, searchNotes]
  );

  const refetch = useCallback(() => {
    return fetchNotes();
  }, [fetchNotes]);

  return {
    ...notesState,
    filteredNotes,
    searchQuery,
    search: handleSearch,
    refetch,
  };
}

export function useCurrentNote() {
  const [currentNote, _setCurrentNote] = useAtom(currentNoteAtom);
  const fetchNote = useSetAtom(fetchNoteAtom);
  const saveNote = useSetAtom(saveNoteAtom);
  const deleteNote = useSetAtom(deleteNoteAtom);
  const createNew = useSetAtom(createNewNoteAtom);
  const clearError = useSetAtom(clearErrorAtom);
  const isOffline = useAtomValue(offlineModeAtom);

  const loadNote = useCallback(
    async (noteId: string) => {
      try {
        await fetchNote(noteId);
      } catch (error) {
        console.error("Failed to load note:", error);
      }
    },
    [fetchNote]
  );

  const save = useCallback(
    async (noteData: Partial<Note>) => {
      try {
        const savedNote = await saveNote(noteData);
        return savedNote;
      } catch (error) {
        console.error("Failed to save note:", error);
        throw error;
      }
    },
    [saveNote]
  );

  const remove = useCallback(
    async (noteId: string) => {
      try {
        await deleteNote(noteId);
      } catch (error) {
        console.error("Failed to delete note:", error);
        throw error;
      }
    },
    [deleteNote]
  );

  const createNewNote = useCallback(() => {
    createNew();
    clearError();
  }, [createNew, clearError]);

  return {
    currentNote,
    loadNote,
    save,
    remove,
    createNewNote,
    isOffline,
  };
}

export function useWikiLinks() {
  const suggestions = useAtomValue(wikiSuggestionsAtom);
  const fetchSuggestions = useSetAtom(fetchWikiSuggestionsAtom);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const filterSuggestions = useCallback(
    (query: string) => {
      if (!query) return suggestions;
      return suggestions.filter((s) =>
        s.title.toLowerCase().includes(query.toLowerCase())
      );
    },
    [suggestions]
  );

  return {
    suggestions,
    filterSuggestions,
    refetchSuggestions: fetchSuggestions,
  };
}
