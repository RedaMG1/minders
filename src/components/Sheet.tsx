"use client";

import { useEffect, type FormEvent, type ReactNode } from "react";
import { Icon } from "./Icon";

type SheetProps = {
  title: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
};

export function Sheet({ title, onClose, onSubmit, children }: SheetProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="sheet-layer"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="sheet" role="dialog" aria-modal="true" aria-label={title} onSubmit={onSubmit}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </form>
    </div>
  );
}
