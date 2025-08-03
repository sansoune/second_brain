export interface Note {
    id: string;
    title: string;
    content: string;
    frontmatter: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    backlinks: string[];
}

export interface WikiLinkSuggestion {
  id: string;
  title: string;
}

export interface ApiError {
    message: string;
    status?: number;
    code?: number;
}

export interface NotesState {
    notes: Note[];
    currentNote: Note | null;
    isLoading: boolean;
    error: ApiError | null;
    lastSync: Date | null;
}