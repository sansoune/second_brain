import { Hono } from 'hono';
import { NotesManager } from '../services/notesManager.ts';
import type { NoteCreateRequest, NoteUpdateRequest } from '../types/Note.ts';

const notesManager = new NotesManager();

export const notesRoutes = new Hono();

// GET /api/notes - Get all notes
notesRoutes.get('/', async (c) => {
  try {
    const notes = await notesManager.getAllNotes();
    return c.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    return c.json({ error: 'Failed to fetch notes' }, 500);
  }
});

// GET /api/notes/:id - Get specific note
notesRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const note = await notesManager.getNote(id);
    
    if (!note) {
      return c.json({ error: 'Note not found' }, 404);
    }
    
    return c.json(note);
  } catch (error) {
    console.error('Error fetching note:', error);
    return c.json({ error: 'Failed to fetch note' }, 500);
  }
});

// POST /api/notes/:id - Create note
notesRoutes.post('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body: NoteCreateRequest = await c.req.json();
    
    const note = await notesManager.saveNote(
      id,
      body.title || id,
      body.content || "",
      body.frontmatter || {}
    );
    
    return c.json(note, 201);
  } catch (error) {
    console.error('Error creating note:', error);
    return c.json({ error: 'Failed to create note' }, 500);
  }
});

// PUT /api/notes/:id - Update note
notesRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body: NoteUpdateRequest = await c.req.json();
    
    const note = await notesManager.saveNote(
      id,
      body.title || id,
      body.content || "",
      body.frontmatter || {}
    );
    
    return c.json(note);
  } catch (error) {
    console.error('Error updating note:', error);
    return c.json({ error: 'Failed to update note' }, 500);
  }
});

// DELETE /api/notes/:id - Delete note
notesRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const success = await notesManager.deleteNote(id);
    
    return c.json({ success }, success ? 200 : 404);
  } catch (error) {
    console.error('Error deleting note:', error);
    return c.json({ error: 'Failed to delete note' }, 500);
  }
});

// GET /api/search - Search notes
notesRoutes.get('/search', async (c) => {
  try {
    const query = c.req.query('q');
    if (!query) {
      return c.json({ error: 'Query parameter required' }, 400);
    }
    
    const results = await notesManager.searchNotes(query);
    return c.json(results);
  } catch (error) {
    console.error('Error searching notes:', error);
    return c.json({ error: 'Failed to search notes' }, 500);
  }
});

// GET /api/titles - Get all note titles for autocomplete
notesRoutes.get('/titles', async (c) => {
  try {
    const titles = await notesManager.getNoteTitles();
    return c.json(titles);
  } catch (error) {
    console.error('Error fetching titles:', error);
    return c.json({ error: 'Failed to fetch titles' }, 500);
  }
});