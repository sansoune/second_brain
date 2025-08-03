import React, { useEffect, useRef, useState } from "react";
import { useCurrentNote, useNotes, useWikiLinks } from "../hooks/use-notes";
import { Eye, Edit3, Save } from "lucide-react";
import { WikiLinkSuggestion } from "../types/notes";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const MarkdownEditor: React.FC = () => {
  const { notes } = useNotes();
  const { currentNote, save, remove, createNewNote, loadNote } = useCurrentNote();
  const { suggestions, filterSuggestions } = useWikiLinks();

  const [title, setTitle] = React.useState("");
  const [content, setContent] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<
    WikiLinkSuggestion[]
  >([]);
  const [cursorPosition, setCursorPosition] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentNote) {
      setTitle(currentNote.title);
      setContent(currentNote.content);
    } else {
      setTitle("");
      setContent("");
    }
    setIsPreview(false);
  }, [currentNote]);

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await save({
        id: currentNote ? currentNote.id : undefined,
        title,
        content,
        frontmatter: { tags: [] },
      });
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentNote || !confirm("Delete this note?")) return;

    try {
      await remove(currentNote.id);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  // Auto-save functionality
  useEffect(() => {
    if (!currentNote || !title.trim()) return;

    const timeoutId = setTimeout(() => {
      if (title !== currentNote.title || content !== currentNote.content) {
        handleSave();
      }
    }, 1000); // Auto-save after 1 second of inactivity

    return () => clearTimeout(timeoutId);
  }, [title, content, currentNote]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    setContent(value);
    setCursorPosition(cursorPos);

    // Check if we're inside a wiki link
    const beforeCursor = value.substring(0, cursorPos);
    const wikiLinkMatch = beforeCursor.match(/\[\[([^\]]*?)$/);

    if (wikiLinkMatch) {
      const query = wikiLinkMatch[1];
      const filtered = filterSuggestions(query);
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertWikiLink = (suggestion: WikiLinkSuggestion) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const beforeCursor = content.substring(0, cursorPosition);
    const afterCursor = content.substring(cursorPosition);

    // Find the start of the current wiki link
    const wikiLinkStart = beforeCursor.lastIndexOf("[[");
    const beforeWikiLink = content.substring(0, wikiLinkStart);

    const newContent = `${beforeWikiLink}[[${suggestion.title}]]${afterCursor}`;
    setContent(newContent);
    setShowSuggestions(false);

    // Set cursor position after the inserted link
    setTimeout(() => {
      const newCursorPos = wikiLinkStart + suggestion.title.length + 4; // +4 for [[ and ]]
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }

    // Quick wiki link insertion with Ctrl+K
    if (e.ctrlKey && e.key === "k") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);

      if (selectedText) {
        const beforeSelection = content.substring(0, start);
        const afterSelection = content.substring(end);
        const newContent = `${beforeSelection}[[${selectedText}]]${afterSelection}`;
        setContent(newContent);

        setTimeout(() => {
          textarea.setSelectionRange(
            start + selectedText.length + 4,
            start + selectedText.length + 4
          );
          textarea.focus();
        }, 0);
      } else {
        // Insert empty wiki link
        const beforeCursor = content.substring(0, start);
        const afterCursor = content.substring(start);
        const newContent = `${beforeCursor}[[]]${afterCursor}`;
        setContent(newContent);

        setTimeout(() => {
          textarea.setSelectionRange(start + 2, start + 2);
          textarea.focus();
        }, 0);
      }
    }

    // Save with Ctrl+S
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
  };

  const WikiLinkRenderer = ({ children }: { children: React.ReactNode }) => {
    const text = children?.toString() || "";
    const parts = [];
    let lastIndex = 0;
    const wikiLinkRegex = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;
    let match;

    while ((match = wikiLinkRegex.exec(text)) !== null) {
      // Add text before the wiki link
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const link = match[1];
      const displayText = match[3] || link;
      const noteExists = notes.some((n) => n.title === link || n.id === link);

      // Create clickable wiki link
      parts.push(
        <span
          key={`${match.index}-${link}`}
          className={noteExists ? "wiki-link-exists" : "wiki-link-missing"}
          onClick={() => {
            if (noteExists) {
              const targetNote = notes.find(
                (n) => n.title === link || n.id === link
              );
              if (targetNote) {
                // You'll need to implement loadNote in your hook or pass it as a prop
                // console.log("Load note:", targetNote.id);
                loadNote(targetNote.id);
              }
            } else {
              // Create new note
              setTitle(link);
              setContent("");
              createNewNote();
            }
          }}
        >
          {displayText}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return <>{parts}</>;
  };

  return (
      <div className="flex flex-col h-full w-full dark bg-[#121212] text-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-black/40">
          <input
            type="text"
            placeholder="Note title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-xl font-semibold border-none outline-none flex-1 mr-4 text-white placeholder-gray-400"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPreview(!isPreview)}
              className={`flex items-center gap-2 px-3 py-2 rounded ${
                isPreview
                  ? "bg-gray-200 text-gray-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {isPreview ? <Edit3 size={16} /> : <Eye size={16} />}
              {isPreview ? "Edit" : "Preview"}
            </button>

            <button
              onClick={handleSave}
              disabled={!title.trim() || isSaving}
              className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              <Save size={16} />
              Save
            </button>
            {currentNote && (
              <button onClick={handleDelete} className="delete-btn">
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 relative">
          {!isPreview ? (
            <div className="relative h-full">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Start writing... Use [[note title]] for wiki links or Ctrl+K to create links"
                className="w-full h-full p-4 border-none outline-none resize-none font-mono text-sm leading-relaxed"
              />

              {/* Wiki Link Suggestions */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div
                  ref={suggestionRef}
                  className="absolute bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto z-10"
                  style={{
                    top: "100px", // Adjust based on cursor position
                    left: "20px",
                    minWidth: "200px",
                  }}
                >
                  {suggestions.slice(0, 10).map((suggestion, _index) => (
                    <div
                      key={suggestion.id}
                      onClick={() => insertWikiLink(suggestion)}
                      className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                    >
                      {suggestion.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-4 prose max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p>
                      <WikiLinkRenderer>{children}</WikiLinkRenderer>
                    </p>
                  ),
                  li: ({ children }) => (
                    <li>
                      <WikiLinkRenderer>{children}</WikiLinkRenderer>
                    </li>
                  ),
                  td: ({ children }) => (
                    <td>
                      <WikiLinkRenderer>{children}</WikiLinkRenderer>
                    </td>
                  ),
                  th: ({ children }) => (
                    <th>
                      <WikiLinkRenderer>{children}</WikiLinkRenderer>
                    </th>
                  ),
                  h1: ({ children }) => (
                    <h1>
                      <WikiLinkRenderer>{children}</WikiLinkRenderer>
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2>
                      <WikiLinkRenderer>{children}</WikiLinkRenderer>
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3>
                      <WikiLinkRenderer>{children}</WikiLinkRenderer>
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4>
                      <WikiLinkRenderer>{children}</WikiLinkRenderer>
                    </h4>
                  ),
                  h5: ({ children }) => (
                    <h5>
                      <WikiLinkRenderer>{children}</WikiLinkRenderer>
                    </h5>
                  ),
                  h6: ({ children }) => (
                    <h6>
                      <WikiLinkRenderer>{children}</WikiLinkRenderer>
                    </h6>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Backlinks */}
        {currentNote && currentNote.backlinks.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <h4 className="font-medium text-gray-700 mb-2">Backlinks</h4>
            <div className="flex flex-wrap gap-2">
              {currentNote.backlinks.map((backlinkId) => {
                const backlinkNote = notes.find((n) => n.id === backlinkId);
                return backlinkNote ? (
                  <button
                    key={backlinkId}
                    onClick={async () => await loadNote(backlinkId)}
                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                  >
                    {backlinkNote.title}
                  </button>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
  );
};
