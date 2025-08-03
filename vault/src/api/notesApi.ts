import { Note, WikiLinkSuggestion } from "../types/notes";

const API_BASE_URL = "http://localhost:3001/api";

class NotesApi {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    }
  }

  async getAllNotes(): Promise<Note[]> {
    return this.request<Note[]>("/notes");
  }

  async getNote(id: string): Promise<Note> {
    return this.request<Note>(`/notes/${id}`);
  }

  async createNote(note: Partial<Note>): Promise<Note> {
    const id = note.id || this.generateId(note.title || "untitled");
    return this.request<Note>(`/notes/${id}`, {
      method: "POST",
      body: JSON.stringify({
        title: note.title || id,
        content: note.content || "",
        frontmatter: note.frontmatter || {},
      }),
    });
  }

  async updateNote(id: string, note: Partial<Note>): Promise<Note> {
    return this.request<Note>(`/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: note.title,
        content: note.content,
        frontmatter: note.frontmatter || {},
      }),
    });
  }

  async deleteNote(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/notes/${id}`, {
        method: "DELETE"
    })
  }

  async searchNotes(query: string): Promise<Note[]> {
    return this.request<Note[]>(`/search?q=${encodeURIComponent(query)}`)
  }

  async getNoteTitles(): Promise<WikiLinkSuggestion[]> {
    return this.request<WikiLinkSuggestion[]>("/titles")
  }

  private generateId(title: string): string {
    return title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }
}

class ApiError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export const notesApi = new NotesApi();
export {ApiError};
