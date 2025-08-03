export interface Note {
  id: string;
  title: string;
  content: string;
  frontmatter: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  backlinks: string[];
}

export interface NoteCreateRequest {
  title?: string;
  content?: string;
  frontmatter?: Record<string, any>;
}

export interface NoteUpdateRequest {
  title?: string;
  content?: string;
  frontmatter?: Record<string, any>;
}