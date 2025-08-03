
import { ReactNode, MouseEventHandler } from "react";

interface CardProps {
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  children: ReactNode;
}

export function Card({ className = "", onClick, children }: CardProps) {
  return (
    <div
      className={`rounded-lg shadow-md transition-all ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
}

export function CardContent({ children }: CardContentProps) {
  return <div className="p-4">{children}</div>;
}