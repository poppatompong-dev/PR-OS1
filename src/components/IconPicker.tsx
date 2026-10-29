"use client";

// "ไอคอนงาน" in the add/edit forms: shows the icon guessed from the title and
// lets the person pick another. Empty value = keep following the title.

import { useEffect, useState } from "react";
import { JOB_ICONS, jobIcon } from "@/lib/events/job-icon";
import { JobIconTile } from "@/components/JobIconTile";

export function IconPicker({
  name = "icon",
  defaultValue = "",
  title,
  titleInputName = "title",
  onChange,
}: {
  name?: string;
  defaultValue?: string;
  /** Controlled title (LIFF form); otherwise read from the form's title input. */
  title?: string;
  titleInputName?: string;
  onChange?: (key: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (title !== undefined) return;
    const input = document.querySelector<HTMLInputElement>(`input[name="${titleInputName}"]`);
    if (!input) return;
    const read = () => setTyped(input.value);
    read();
    input.addEventListener("input", read);
    return () => input.removeEventListener("input", read);
  }, [title, titleInputName]);

  const t = title ?? typed;
  const guess = jobIcon(t);
  const current = jobIcon(t, value || null);
  const pick = (k: string) => {
    setValue(k);
    onChange?.(k);
    setOpen(false);
  };

  return (
    <div className="icon-picker">
      <input type="hidden" name={name} value={value} />
      <button type="button" className="icon-picker-now" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <JobIconTile title={t} icon={value || null} size="36px" />
        <span>
          <b>{current.label}</b>
          <small>{value ? "เลือกเอง · กดเพื่อเปลี่ยน" : "ระบบเลือกจากชื่องาน · กดเพื่อเปลี่ยน"}</small>
        </span>
      </button>
      {open ? (
        <div className="icon-picker-grid" role="listbox" aria-label="เลือกไอคอนงาน">
          <button type="button" className={!value ? "is-on" : ""} onClick={() => pick("")} role="option" aria-selected={!value}>
            <JobIconTile title={t} size="34px" />
            <small>อัตโนมัติ</small>
          </button>
          {JOB_ICONS.filter((i) => i.key !== guess.key || value).map((i) => (
            <button type="button" key={i.key} className={value === i.key ? "is-on" : ""} onClick={() => pick(i.key)} role="option" aria-selected={value === i.key}>
              <JobIconTile title="" icon={i.key} size="34px" />
              <small>{i.label.split(" / ")[0]}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
