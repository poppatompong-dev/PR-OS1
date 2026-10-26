"use client";

// Place box (owner, 26 Oct 2026): type anything, or tap a suggestion — the
// master list plus places typed on earlier jobs. A plain list under the box
// instead of <datalist>, which the LINE in-app browser shows unreliably.

import { useId, useMemo, useState } from "react";

export function PlaceInput({
  name,
  defaultValue = "",
  suggestions,
  value,
  onChange,
  inputClassName = "input",
  placeholder = "พิมพ์ชื่อสถานที่ หรือเลือกจากรายการ",
}: {
  /** Web form: posted under this name. */
  name?: string;
  defaultValue?: string;
  suggestions: string[];
  /** LINE form: controlled. */
  value?: string;
  onChange?: (v: string) => void;
  inputClassName?: string;
  placeholder?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const text = value ?? inner;
  const listId = useId();
  const set = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };

  const matches = useMemo(() => {
    const q = text.trim().toLocaleLowerCase("th-TH");
    const list = q ? suggestions.filter((s) => s.toLocaleLowerCase("th-TH").includes(q)) : suggestions;
    return list.filter((s) => s !== text.trim()).slice(0, 6);
  }, [text, suggestions]);

  return (
    <div className="place-input">
      <input
        className={inputClassName}
        name={name}
        value={text}
        maxLength={120}
        autoComplete="off"
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        onChange={(e) => {
          set(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Let a tap on a suggestion land before the list closes.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 ? (
        <ul id={listId} className="place-suggest" role="listbox">
          {matches.map((s) => (
            <li key={s} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  set(s);
                  setOpen(false);
                }}
              >
                📍 {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
