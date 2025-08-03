import { Provider } from "jotai";
import { ReactNode } from "react";

interface NotesProviderProps {
  children: ReactNode;
}

export const NotesProvider: React.FC<NotesProviderProps> = ({ children }) => {
  return <Provider>{children}</Provider>
};