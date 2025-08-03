import React from "react";
import { FileText, Link2, Search, Network }  from "lucide-react"
import { useCurrentNote, useNotes } from "../hooks/use-notes";

interface SidebarProps {
  onViewChange: (view: 'editor' | 'graph') => void;
  currentView: 'editor' | 'graph';
}

export const Sidebar: React.FC<SidebarProps> = ({ onViewChange, currentView }) => {

    const {filteredNotes, searchQuery, search, isLoading, error } = useNotes();
    const { loadNote, createNewNote, currentNote } = useCurrentNote();

    return (
        <div className="w-1/3 bg-black/60 backdrop-blur-md border-r border-gray-700 flex flex-col text-gray-200">
      <div className="p-4 border-b border-gray-800">
        <div className="flex gap-2 mb-4">
          <button
            onClick={createNewNote}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded transition"
          >
            <FileText size={16} />
            New Note
          </button>
          <button
            onClick={() => onViewChange(currentView === 'graph' ? 'editor' : 'graph')}
            className={`flex items-center gap-2 px-3 py-2 rounded transition ${
              currentView === 'graph' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            <Network size={16} />
            {currentView === 'graph' ? 'Editor' : 'Graph'}
          </button>
        </div>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => search(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-transparent border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <p className="p-4 text-gray-400">No notes found</p>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => {
                loadNote(note.id);
                if (currentView === 'graph') {
                  onViewChange('editor');
                }
              }}
              className={`p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800/70 ${
                currentNote?.id === note.id
                  ? "bg-blue-700/60 border-l-4 border-blue-400"
                  : ""
              }`}
            >
              <h3 className="font-semibold truncate">{note.title}</h3>
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                {note.content.substring(0, 100)}...
              </p>
              {note.backlinks.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <Link2 size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500">
                    {note.backlinks.length} backlinks
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
    )
}