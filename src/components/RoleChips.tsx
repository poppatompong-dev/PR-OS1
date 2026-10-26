"use client";

// Duties as tap-to-toggle chips (owner, 26 Oct 2026): one person can hold
// several duties on one job. Real checkboxes underneath, so a web form posts
// every ticked id under `name` even before the page's JS has loaded.

import type { ChangeEvent } from "react";

export function RoleChips({
  roles,
  name,
  defaultSelected = [],
  selected,
  onChange,
  idPrefix,
}: {
  roles: { id: string; name: string }[];
  /** Web form field name (one value per ticked duty). */
  name?: string;
  defaultSelected?: string[];
  /** LINE form: controlled, in the order picked. */
  selected?: string[];
  onChange?: (ids: string[]) => void;
  idPrefix: string;
}) {
  return (
    <div className="role-chips" role="group" aria-label="หน้าที่ (เลือกได้หลายอย่าง)">
      {roles.map((r) => {
        const id = `${idPrefix}-${r.id}`;
        const controlled = selected !== undefined;
        return (
          <label key={r.id} htmlFor={id} className="role-chip">
            <input
              id={id}
              type="checkbox"
              name={name}
              value={r.id}
              {...(controlled
                ? {
                    checked: selected.includes(r.id),
                    onChange: (e: ChangeEvent<HTMLInputElement>) =>
                      onChange?.(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id)),
                  }
                : { defaultChecked: defaultSelected.includes(r.id) })}
            />
            <span>{r.name}</span>
          </label>
        );
      })}
    </div>
  );
}
