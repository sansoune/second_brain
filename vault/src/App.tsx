
import "./App.css";
import TitleBar from "./components/TitleBar";
import { NotesProvider } from "./components/NotesProvider";
import { Sidebar } from "./components/SideBar";
import { MarkdownEditor } from "./Editor/MarkdownEditor";
import NotesGraph from "./components/NotesGraph";
import { useState } from "react";

function App() {
  const [currentView, setCurrentView] = useState<'editor' | 'graph'>('editor');
  
  return (
    <NotesProvider>
    <div className="flex flex-col h-screen bg-[#0e0e0e] text-white">
        {/* Title Bar at the very top, draggable */}
        <div className="h-10 bg-black/70 border-b border-gray-800 drag-region">
          <TitleBar />
        </div>

        {/* Main app layout */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar onViewChange={setCurrentView} currentView={currentView} />
          {currentView === 'editor' ? <MarkdownEditor /> : <NotesGraph />}
        </div>
      </div>
    </NotesProvider>
  );
}

export default App;