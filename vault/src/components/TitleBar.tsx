import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const TitleBar = () => {
  const appWindow = getCurrentWindow();
  useEffect(() => {
    document.addEventListener("mousedown", (event) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains("title-bar")) {
        event.preventDefault();
      }
    });
  }, []);

  return (
    <div
      className="titlebar h-8 flex items-center px-3 gap-2 bg-black/50 backdrop-blur-md select-none"
      data-tauri-drag-region
    >
      {/* Traffic light buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => appWindow.close()}
          className="w-3 h-3 rounded-full bg-red-500 hover:brightness-125"
        />
        <button
          onClick={() => appWindow.minimize()}
          className="w-3 h-3 rounded-full bg-yellow-400 hover:brightness-125"
        />
        <button
          onClick={async () => {
            const isMax = await appWindow.isMaximized();
            isMax ? appWindow.unmaximize() : appWindow.maximize();
          }}
          className="w-3 h-3 rounded-full bg-green-500 hover:brightness-125"
        />
      </div>

      {/* Optional title */}
      <div className="text-white text-sm ml-4">My App</div>
    </div>
  );
};

export default TitleBar;
