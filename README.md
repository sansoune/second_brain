# Second Brain – Markdown Note System

This is a personal note-taking system built for long-term thinking and local-first control. Notes are stored as `.md` files on disk, interconnected with `[[WikiLinks]]`, and indexed for full-text search. The system is designed to be self-hosted and eventually sync across your own devices.

The editor is WYSIWYG (what-you-see-is-what-you-write), not a split preview/toggle interface — aiming to feel like Obsidian but with your own local control.

---

## Current Features

- **Markdown notes stored on disk** with optional YAML frontmatter
- **WYSIWYG editing experience**
- **Wiki-style linking** via `[[Note Title]]` and backlink tracking
- **Full-text search** powered by SQLite FTS
- **Self-hostable backend** with Bun + Hono
- **Desktop app** using Tauri + React
- **Graph view** to visualize note connections
- Simple file system layout — no database lock-in

## setup

### requirements
- [Bun](https://bun.sh)
- [Tauri CLI](https://tauri.app/) and Rust toolchain

### Installation

1. Clone the repo:

```bash
git clone https://github.com/yourusername/second-brain.git
cd second-brain 
```

2. Install backend dependencies:
```bash
cd backend 
bun install
```

3. Install frontend:
```bash
cd vault
bun install
```
4. Start backend server:
```bash
cd backend
bun run start
```
5. Start frontend app (Tauri):
```bash
cd frontend
npm run tauri dev
```

## Linking Notes

Link between notes using double brackets like:

```
[[Some Note Title]]
```

These links are automatically extracted and used to build:
- A backlinks list  
- A graph of note relationships  

Even if the target note doesn't exist yet, the link is recorded.

---

## Search

The app uses SQLite full-text search to let you find relevant notes quickly. The content is indexed on load and updated automatically.

---

##  Not Yet Implemented

- ❌ File/image attachments (for now)  
- ❌ Mobile app (planned via React Native)  
- ❌ Real-time or offline-to-online sync  
- ❌ Multi-device sync  

---

## Upcoming Features

- Store local edits/files and **sync when online**
- File and image support (initially local, then synced)
- Note tagging and metadata view
- AI-powered features: summarization, organization, suggestions
- Encrypted remote backups
- Conflict resolution for sync

---


## Philosophy

- You own your data — stored as plain `.md` files
- You host your own "brain" — no vendor lock-in
- Designed to evolve — extendable with your own tools
- Local-first, then sync — no silent cloud dependency

---

## License

[MIT License](LICENSE.md)
