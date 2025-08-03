import matter from "gray-matter";
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, basename } from "path";
import type { Note } from "../types/Note.ts";
import { NOTES_DIR } from "../config/constants.ts";
import { extractWikiLinks } from "../utils/wikiLinks.ts";

export class NotesManager {
  constructor() {
    this.ensureNotesDirectory();
  }

  private async ensureNotesDirectory(): Promise<void> {
    await mkdir(NOTES_DIR, { recursive: true });
  }

  async getAllNotes(): Promise<Note[]> {
    try {
      const files = await readdir(NOTES_DIR);
      const noteFiles = files.filter(f => f.endsWith('.md'));
      
      const notes = await Promise.all(
        noteFiles.map(async (file) => {
          const content = await readFile(join(NOTES_DIR, file), 'utf-8');
          const { data: frontmatter, content: markdownContent } = matter(content);
          
          const id = basename(file, '.md');
          
          return {
            id,
            title: frontmatter.title || id,
            content: markdownContent,
            frontmatter,
            createdAt: frontmatter.createdAt ? new Date(frontmatter.createdAt) : new Date(),
            updatedAt: frontmatter.updatedAt ? new Date(frontmatter.updatedAt) : new Date(),
            backlinks: [] as string[]
          };
        })
      );

      // Calculate backlinks
      this.calculateBacklinks(notes);

      return notes;
    } catch {
      return [];
    }
  }

  async getNote(id: string): Promise<Note | null> {
    try {
      const filePath = join(NOTES_DIR, `${id}.md`);
      const content = await readFile(filePath, 'utf-8');
      const { data: frontmatter, content: markdownContent } = matter(content);
      
      const allNotes = await this.getAllNotes();
      const backlinks = allNotes
        .filter(note => extractWikiLinks(note.content).some(link => link === id || link === frontmatter.title))
        .map(note => note.id);

      return {
        id,
        title: frontmatter.title || id,
        content: markdownContent,
        frontmatter,
        createdAt: frontmatter.createdAt ? new Date(frontmatter.createdAt) : new Date(),
        updatedAt: frontmatter.updatedAt ? new Date(frontmatter.updatedAt) : new Date(),
        backlinks
      };
    } catch {
      return null;
    }
  }

  async saveNote(id: string, title: string, content: string, frontmatter: Record<string, any> = {}): Promise<Note> {
    const now = new Date();
    const isNew = !(await this.getNote(id));
    
    const noteData = Object.fromEntries(
      Object.entries({
        ...frontmatter,
        title,
        createdAt: isNew ? now.toISOString() : frontmatter.createdAt,
        updatedAt: now.toISOString()
      }).filter(([key, value]) => value !== undefined && value !== null)
    );

    const fileContent = matter.stringify(content, noteData);
    const filePath = join(NOTES_DIR, `${id}.md`);
    
    await writeFile(filePath, fileContent, 'utf-8');
    
    return (await this.getNote(id))!;
  }

  async deleteNote(id: string): Promise<boolean> {
    try {
      const { unlink } = await import('fs/promises');
      const filePath = join(NOTES_DIR, `${id}.md`);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async searchNotes(query: string): Promise<Note[]> {
    const allNotes = await this.getAllNotes();
    const lowercaseQuery = query.toLowerCase();
    
    return allNotes.filter(note => 
      note.title.toLowerCase().includes(lowercaseQuery) ||
      note.content.toLowerCase().includes(lowercaseQuery) ||
      Object.values(note.frontmatter).some(value => 
        typeof value === 'string' && value.toLowerCase().includes(lowercaseQuery)
      )
    );
  }

  async getNoteTitles(): Promise<Array<{id: string, title: string}>> {
    const notes = await this.getAllNotes();
    return notes.map(note => ({ id: note.id, title: note.title }));
  }

  private calculateBacklinks(notes: Note[]): void {
    notes.forEach(note => {
      const links = extractWikiLinks(note.content);
      links.forEach(link => {
        const targetNote = notes.find(n => n.id === link || n.title === link);
        if (targetNote) {
          targetNote.backlinks.push(note.id);
        }
      });
    });
  }
}