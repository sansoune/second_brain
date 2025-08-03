import { ReactNode, MouseEventHandler } from "react";

type ButtonProps = {
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
};

export function Button({ className = "", onClick, children }: ButtonProps) {
  return (
    <button
      className={`bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-all ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}