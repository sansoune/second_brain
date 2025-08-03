import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { Database } from "bun:sqlite";
import { v4 as uuidv4 } from "uuid";
import { readdir, readFile, writeFile, mkdir, unlink, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const app = new Hono();

const NOTES_DIR = process.env.NOTES_DIR || "./notes";
const METADATA_DB = "metadata.db";

if (!existsSync(NOTES_DIR)) {
  await mkdir(NOTES_DIR, { recursive: true });
}

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type"],
  })
);

const db = new Database(METADATA_DB);

db.exec(`
  CREATE TABLE IF NOT EXISTS note_metadata (
    id TEXT PRIMARY KEY,
    filename TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    folder_path TEXT DEFAULT '/',
    tags TEXT DEFAULT '[]',
    created_at DATETIME,
    updated_at DATETIME,
    word_count INTEGER DEFAULT 0,
    file_size INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_note_id TEXT,
    target_note_id TEXT,
    link_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_note_id) REFERENCES note_metadata (id),
    FOREIGN KEY (target_note_id) REFERENCES note_metadata (id)
  )
`);

// Full-text search table for metadata
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    id UNINDEXED,
    title,
    content,
    tags,
    filename UNINDEXED
  )
`);

// Prepared statements
const statements = {
  getAllNotes: db.prepare(
    `SELECT * FROM note_metadata WHERE is_deleted = 0 ORDER BY updated_at DESC LIMIT ?`
  ),
  getNotesByFolder: db.prepare(
    `SELECT * FROM note_metadata WHERE is_deleted = 0 AND folder_path LIKE ? ORDER BY updated_at DESC LIMIT ?`
  ),
  getNotesByTag: db.prepare(
    `SELECT * FROM note_metadata WHERE is_deleted = 0 AND tags LIKE ? ORDER BY updated_at DESC LIMIT ?`
  ),
  searchNotes: db.prepare(`
    SELECT nm.* FROM note_metadata nm
    JOIN notes_fts fts ON nm.id = fts.id
    WHERE notes_fts MATCH ? AND nm.is_deleted = 0
    ORDER BY nm.updated_at DESC LIMIT ?
  `),
  getNoteById: db.prepare(
    `SELECT * FROM note_metadata WHERE id = ? AND is_deleted = 0`
  ),
  getNoteByFilename: db.prepare(
    `SELECT * FROM note_metadata WHERE filename = ? AND is_deleted = 0`
  ),
  insertNote: db.prepare(`
    INSERT INTO note_metadata (id, filename, title, folder_path, tags, created_at, updated_at, word_count, file_size, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateNote: db.prepare(`
    UPDATE note_metadata SET title = ?, folder_path = ?, tags = ?, updated_at = ?, word_count = ?, file_size = ?
    WHERE id = ? AND is_deleted = 0
  `),
  softDeleteNote: db.prepare(
    `UPDATE note_metadata SET is_deleted = 1, updated_at = ? WHERE id = ?`
  ),
  insertFTS: db.prepare(
    `INSERT OR REPLACE INTO notes_fts (id, title, content, tags, filename) VALUES (?, ?, ?, ?, ?)`
  ),
  deleteFTS: db.prepare(`DELETE FROM notes_fts WHERE id = ?`),
  insertLink: db.prepare(
    `INSERT INTO links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)`
  ),
  deleteLinks: db.prepare(`DELETE FROM links WHERE source_note_id = ?`),
  getNoteLinks: db.prepare(`
    SELECT 
      l.*,
      source.title as source_title,
      target.title as target_title
    FROM links l
    LEFT JOIN note_metadata source ON l.source_note_id = source.id
    LEFT JOIN note_metadata target ON l.target_note_id = target.id
    WHERE (l.source_note_id = ? OR l.target_note_id = ?)
    AND source.is_deleted = 0 AND target.is_deleted = 0
  `),
  findNoteByTitle: db.prepare(
    `SELECT id FROM note_metadata WHERE title = ? AND is_deleted = 0`
  ),
  getAllFolders: db.prepare(
    `SELECT DISTINCT folder_path FROM note_metadata WHERE is_deleted = 0 ORDER BY folder_path`
  ),
  getAllTagsData: db.prepare(
    `SELECT tags FROM note_metadata WHERE is_deleted = 0 AND tags != "[]"`
  ),
};

const sanitizeFilname = (title: string): string => {
  return title
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .toLowerCase()
    .substring(0, 100);
};

const getNotePath = (filename: string, folderPath: string = "/"): string => {
  const cleanFolder = folderPath === "/" ? "" : folderPath;
  return path.join(NOTES_DIR, cleanFolder, `${filename}.md`);
};

const parseMarkdownFrontmatter = (content: string) => {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content };
  }

  const frontmatterText = match[1];
  const remainingContent = content.substring(match[0].length);

  const frontmatter: Record<string, any> = {};
  if (frontmatterText) {
    frontmatterText.split("\n").forEach((line) => {
      const [key, ...valueParts] = line.split(":");
      if (key && valueParts.length) {
        const value = valueParts.join(":").trim();
        if (key.trim() === "tags") {
          frontmatter.tags = value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
        } else {
          frontmatter[key.trim()] = value;
        }
      }
    });
  }

  return { frontmatter, content: remainingContent };
};

const createMarkdownWithFrontmatter = (
  title: string,
  content: string,
  tags: string[] = [],
  metadata: any = {}
) => {
  const frontmatter = {
    title,
    created: metadata.created_at || new Date().toISOString(),
    updated: new Date().toISOString(),
    id: metadata.id || uuidv4(),
    ...metadata,
  };

  const frontmatterText = Object.entries(frontmatter)
    .filter(([key, value]) => value !== "" && value !== null)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return `---\n${frontmatterText}\n---\n\n${content}`;
};

const updateWordCount = (content: string): number => {
  return content
    ? content.split(/\s+/).filter((word) => word.length > 0).length
    : 0;
};

const extractWikiLinks = (content: string): string[] => {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (typeof match[1] === "string") {
      links.push(match[1].trim());
    }
  }
  return links;
};

const updateNoteFTS = (note: any, content: string) => {
  const tags = JSON.stringify(JSON.parse(note.tags || "[]"));
  statements.insertFTS.run(note.id, note.title, content, tags, note.filename);
};

const processWikiLinks = (noteId: string, links: string[]) => {
  links.forEach((link) => {
    const targetNote = statements.findNoteByTitle.get(link) as any;
    if (targetNote) {
      statements.insertLink.run(noteId, targetNote.id, link);
    }
  });
};

const syncFilesystem = async () => {
  console.log("🔄 Syncing filesystem with database...");

  const walkDir = async (
    dir: string,
    folderPath: string = "/"
  ): Promise<void> => {
    const items = await readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const relativePath =
        folderPath === "/" ? item.name : `${folderPath}/${item.name}`;

      if (item.isDirectory()) {
        await walkDir(fullPath, relativePath);
      } else if (item.name.endsWith(".md")) {
        try {
          const content = await readFile(fullPath, "utf-8");
          const { frontmatter, content: noteContent } =
            parseMarkdownFrontmatter(content);
          const stats = await stat(fullPath);

          const filename = item.name.replace(".md", "");
          const id = frontmatter.id || uuidv4();
          const title = frontmatter.title || filename;
          const tags = frontmatter.tags || [];
          const wordCount = updateWordCount(noteContent);

          // Check if note exists in database
          const existingNote = statements.getNoteByFilename.get(
            filename
          ) as any;

          if (!existingNote) {
            // Add new note to database
            const noteData = {
              id,
              filename,
              title,
              folder_path: folderPath,
              tags: JSON.stringify(tags),
              created_at: frontmatter.created || stats.birthtime.toISOString(),
              updated_at: frontmatter.updated || stats.mtime.toISOString(),
              word_count: wordCount,
              file_size: stats.size,
              is_deleted: 0,
            };

            statements.insertNote.run(
              noteData.id,
              noteData.filename,
              noteData.title,
              noteData.folder_path,
              noteData.tags,
              noteData.created_at,
              noteData.updated_at,
              noteData.word_count,
              noteData.file_size,
              noteData.is_deleted
            );

            updateNoteFTS(noteData, noteContent);

            // Process wiki links
            const wikiLinks = extractWikiLinks(noteContent);
            if (wikiLinks.length > 0) {
              processWikiLinks(id, wikiLinks);
            }
          }
        } catch (error) {
          console.error(`Error syncing file ${fullPath}:`, error);
        }
      }
    }
  };

  await walkDir(NOTES_DIR);
  console.log("✅ Sync complete.");
};

app.get("/api/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: "connected",
    runtime: "bun",
    storage: "markdown files",
    notes_dir: NOTES_DIR,
  });
});

app.get("/api/notes", async (c) => {
  const folder = c.req.query("folder");
  const tag = c.req.query("tag");
  const search = c.req.query("search");
  const limit = parseInt(c.req.query("limit") || "100");

  let rows: any[];

  try {
    if (search) {
      rows = statements.searchNotes.all(search, limit);
    } else if (folder) {
      rows = statements.getNotesByFolder.all(`${folder}%`, limit);
    } else if (tag) {
      rows = statements.getNotesByTag.all(`%${tag}%`, limit);
    } else {
      rows = statements.getAllNotes.all(limit);
    }

    const notes = await Promise.all(
      rows.map(async (note) => {
        try {
          const notePath = getNotePath(note.filename, note.folder_path);
          let preview = "";

          if (existsSync(notePath)) {
            const content = await readFile(notePath, "utf-8");
            const { content: noteContent } = parseMarkdownFrontmatter(content);
            preview =
              noteContent.substring(0, 300) +
              (noteContent.length > 300 ? "..." : "");
          }

          return {
            ...note,
            tags: JSON.parse(note.tags || "[]"),
            preview,
          };
        } catch (error) {
          console.error(`Error processing note ${note.id}:`, error);
          return {
            ...note,
            tags: JSON.parse(note.tags || "[]"),
            preview: "Error reading file",
          };
        }
      })
    );

    return c.json(notes);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return c.json({ error: "Failed to fetch notes" }, 500);
  }
});

app.get("/api/notes/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const row = statements.getNoteById.get(id) as any;

    if (!row) {
      return c.json({ error: "Note not found" }, 404);
    }

    const filePath = getNotePath(row.filename, row.folder_path);

    if (!existsSync(filePath)) {
      return c.json({ error: "Note file not found on disk" }, 404);
    }

    const fileContent = await readFile(filePath, "utf-8");
    const { frontmatter, content } = parseMarkdownFrontmatter(fileContent);

    const note = {
      ...row,
      tags: JSON.parse(row.tags || "[]"),
      content,
      raw_content: fileContent,
    };

    return c.json(note);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

app.post("/api/notes", async (c) => {
  try {
    const body = await c.req.json();
    const { title, content = "", folder_path = "/", tags = [] } = body;

    if (!title) {
      return c.json({ error: "Title is required" }, 400);
    }

    const id = uuidv4();
    const filename = `${sanitizeFilname(title)}-${id.substring(0, 8)}`;
    const now = new Date().toISOString();

    // Create directory if it doesn't exist
    const folderFullPath = path.join(
      NOTES_DIR,
      folder_path === "/" ? "" : folder_path
    );
    if (!existsSync(folderFullPath)) {
      await mkdir(folderFullPath, { recursive: true });
    }

    // Create markdown content with frontmatter
    const markdownContent = createMarkdownWithFrontmatter(
      title,
      content,
      tags,
      {
        id,
        created_at: now,
        updated_at: now,
      }
    );

    const filePath = getNotePath(filename, folder_path);
    await writeFile(filePath, markdownContent, "utf-8");

    const stats = await stat(filePath);
    const wordCount = updateWordCount(content);

    const noteData = {
      id,
      filename,
      title,
      folder_path,
      tags: JSON.stringify(tags),
      created_at: now,
      updated_at: now,
      word_count: wordCount,
      file_size: stats.size,
      is_deleted: 0,
    };

    statements.insertNote.run(
      noteData.id,
      noteData.filename,
      noteData.title,
      noteData.folder_path,
      noteData.tags,
      noteData.created_at,
      noteData.updated_at,
      noteData.word_count,
      noteData.file_size,
      noteData.is_deleted
    );

    // Update FTS
    updateNoteFTS(noteData, content);

    // Process wiki links
    const wikiLinks = extractWikiLinks(content);
    if (wikiLinks.length > 0) {
      processWikiLinks(id, wikiLinks);
    }

    return c.json(
      {
        ...noteData,
        tags: JSON.parse(noteData.tags),
        content,
      },
      201
    );
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// Update note
app.put("/api/notes/:id", async (c) => {
  const noteId = c.req.param("id");

  try {
    const body = await c.req.json();
    const { title, content, folder_path, tags } = body;

    const existingNote = statements.getNoteById.get(noteId) as any;
    if (!existingNote) {
      return c.json({ error: "Note not found" }, 404);
    }

    const oldFilePath = getNotePath(
      existingNote.filename,
      existingNote.folder_path
    );
    const now = new Date().toISOString();

    // Create new markdown content
    const markdownContent = createMarkdownWithFrontmatter(
      title,
      content,
      tags,
      {
        id: noteId,
        created_at: existingNote.created_at,
        updated_at: now,
      }
    );

    // If folder changed, move the file
    const newFilePath = getNotePath(existingNote.filename, folder_path);
    if (oldFilePath !== newFilePath) {
      // Create new directory if needed
      const newFolderPath = path.join(
        NOTES_DIR,
        folder_path === "/" ? "" : folder_path
      );
      if (!existsSync(newFolderPath)) {
        await mkdir(newFolderPath, { recursive: true });
      }

      // Move file
      await writeFile(newFilePath, markdownContent, "utf-8");
      if (existsSync(oldFilePath)) {
        await unlink(oldFilePath);
      }
    } else {
      await writeFile(newFilePath, markdownContent, "utf-8");
    }

    const stats = await stat(newFilePath);
    const wordCount = updateWordCount(content);

    statements.updateNote.run(
      title,
      folder_path,
      JSON.stringify(tags),
      now,
      wordCount,
      stats.size,
      noteId
    );

    const updatedNote = {
      id: noteId,
      filename: existingNote.filename,
      title,
      folder_path,
      tags: JSON.stringify(tags),
      updated_at: now,
      word_count: wordCount,
      file_size: stats.size,
    };

    // Update FTS
    updateNoteFTS(updatedNote, content);

    // Clear old links and process new ones
    statements.deleteLinks.run(noteId);
    const wikiLinks = extractWikiLinks(content);
    if (wikiLinks.length > 0) {
      processWikiLinks(noteId, wikiLinks);
    }

    return c.json({
      ...updatedNote,
      tags: JSON.parse(updatedNote.tags),
      content,
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// Delete note
app.delete("/api/notes/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const existingNote = statements.getNoteById.get(id) as any;
    if (!existingNote) {
      return c.json({ error: "Note not found" }, 404);
    }

    const filePath = getNotePath(
      existingNote.filename,
      existingNote.folder_path
    );

    // Delete physical file
    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    // Soft delete in database
    const now = new Date().toISOString();
    statements.softDeleteNote.run(now, id);

    // Remove from FTS
    statements.deleteFTS.run(id);

    return c.json({ message: "Note deleted successfully" });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// Get note links
app.get("/api/notes/:id/links", (c) => {
  const noteId = c.req.param("id");

  try {
    const rows = statements.getNoteLinks.all(noteId, noteId) as any[];

    const outgoing = rows.filter((link) => link.source_note_id === noteId);
    const incoming = rows.filter((link) => link.target_note_id === noteId);

    return c.json({ outgoing, incoming });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// Get all folders
app.get("/api/folders", (c) => {
  try {
    const rows = statements.getAllFolders.all() as any[];
    const folders = rows.map((row) => row.folder_path);
    return c.json(folders);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// Get all tags
app.get("/api/tags", (c) => {
  try {
    const rows = statements.getAllTagsData.all() as any[];

    const allTags = new Set<string>();
    rows.forEach((row) => {
      const tags = JSON.parse(row.tags || "[]");
      tags.forEach((tag: string) => allTags.add(tag));
    });

    return c.json(Array.from(allTags).sort());
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// Resync filesystem (useful for manual sync)
app.post("/api/sync", async (c) => {
  try {
    await syncFilesystem();
    return c.json({ message: "Filesystem synced successfully" });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

const PORT = process.env.PORT || 3000;

console.log(`🧠 Second Brain Server starting with Bun + Hono + Markdown...`);
console.log(`📁 Notes directory: ${NOTES_DIR}`);
console.log(`📊 Metadata database: ${METADATA_DB}`);

await syncFilesystem();

console.log(`🌐 Server running on: http://localhost:${PORT}`);

Bun.serve({
  fetch: app.fetch,
  port: PORT,
});
