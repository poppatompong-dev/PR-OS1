"use client";

import { Children, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Splits a long form into steps on phones and tablets, and shows the whole
 * form at once on a wide screen.
 *
 * Every step stays mounted — hidden only with CSS — so the single submit at
 * the end still carries every field, and the server action never has to know
 * a wizard exists. Moving forward runs the browser's own validation on the
 * step you are leaving, so a required field can never end up invalid and
 * off-screen (which browsers refuse to submit, with no visible reason why).
 */
export function FormWizard({ labels, children }: { labels: string[]; children: ReactNode }) {
  const panes = Children.toArray(children);
  const [step, setStep] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const last = panes.length - 1;

  function currentPaneIsValid(): boolean {
    const pane = rootRef.current?.querySelectorAll<HTMLElement>(".wizard-pane")[step];
    if (!pane) return true;
    const fields = pane.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea",
    );
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  function go(next: number) {
    if (next > step && !currentPaneIsValid()) return;
    setStep(next);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rootRef.current?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
  }

  return (
    <div className="wizard" ref={rootRef}>
      <ol className="wizard-rail" aria-label="ขั้นตอนการกรอกข้อมูล">
        {labels.map((label, index) => (
          <li
            key={label}
            className="wizard-step"
            data-state={index === step ? "current" : index < step ? "done" : "todo"}
          >
            <button type="button" onClick={() => go(index)} aria-current={index === step ? "step" : undefined}>
              <span className="wizard-step-num">{index + 1}</span>
              <span className="wizard-step-label">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      {panes.map((pane, index) => (
        <div key={index} className="wizard-pane" data-active={index === step ? "true" : "false"}>
          {pane}
        </div>
      ))}

      <div className="wizard-nav">
        <button
          type="button"
          className="button secondary"
          onClick={() => go(step - 1)}
          disabled={step === 0}
        >
          <ChevronLeft size={18} aria-hidden="true" />
          ย้อนกลับ
        </button>
        <span className="wizard-count">
          {step + 1} / {panes.length}
        </span>
        <button
          type="button"
          className="button"
          onClick={() => go(step + 1)}
          disabled={step === last}
        >
          ถัดไป
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
