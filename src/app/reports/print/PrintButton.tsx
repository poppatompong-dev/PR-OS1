"use client";

import { Printer } from "lucide-react";

// The browser print dialog is how PR-OS produces PDF: it renders Thai text with
// the system font stack correctly and adds no PDF library to the bundle.
// "Save as PDF" in that dialog is the documented export path (docs/05).
export function PrintButton() {
  return (
    <button className="button" type="button" onClick={() => window.print()}>
      <Printer size={18} aria-hidden="true" />
      พิมพ์ / บันทึกเป็น PDF
    </button>
  );
}
