"use client";

import type { ReactNode } from "react";

/** A submit button that asks first; cancelling stops the form from posting. */
export function ConfirmSubmit({
  message,
  className = "button secondary",
  children,
}: {
  message: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      className={className}
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
