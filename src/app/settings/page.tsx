"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { people as initialPeople } from "@/data/mock-data";
import type { Person } from "@/types/domain";
import { Mail, Power, RotateCcw, Trash2, UserPlus, Users } from "lucide-react";

const cards = [
  { title: "บทบาทงาน", body: "พิธีกร ช่างภาพ ทำข่าว ประสานงาน และบทบาทอื่นที่เพิ่มภายหลัง" },
  { title: "สถานที่", body: "ห้องประชุม ลานกิจกรรม โรงเรียน ชุมชน หรือสถานที่นอกสำนักงาน" },
  { title: "หน่วยงาน", body: "สำนัก กอง ฝ่าย หรือเจ้าของเรื่องที่ส่งงานเข้ามา" },
  { title: "แจ้งเตือน", body: "LINE quota, Email fallback, template, reminder timing" },
  { title: "Display Token", body: "ออก token สำหรับจอมอนิเตอร์และเพิกถอนเมื่อไม่ใช้แล้ว" },
];

export default function SettingsPage() {
  const [staff, setStaff] = useState<Person[]>(initialPeople);
  const [displayName, setDisplayName] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");

  const activeCount = useMemo(() => staff.filter((person) => person.isActive).length, [staff]);

  function addStaff() {
    const cleanName = displayName.trim();
    const cleanPosition = position.trim();

    if (!cleanName || !cleanPosition) {
      return;
    }

    setStaff((current) => [
      ...current,
      {
        id: `per_local_${Date.now()}`,
        displayName: cleanName,
        position: cleanPosition,
        email: email.trim() || undefined,
        isActive: true,
      },
    ]);
    setDisplayName("");
    setPosition("");
    setEmail("");
  }

  function toggleStaff(personId: string) {
    setStaff((current) =>
      current.map((person) => (person.id === personId ? { ...person, isActive: !person.isActive } : person)),
    );
  }

  function removeStaff(personId: string) {
    setStaff((current) => current.filter((person) => person.id !== personId));
  }

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">ตั้งค่าระบบ</h1>
          <p className="page-subtitle">จัดการ master data ที่ทีมงานต้องปรับได้เองเมื่อมีเจ้าหน้าที่หรือบทบาทเปลี่ยน</p>
        </div>
      </header>

      <section className="staff-panel panel">
        <div className="panel-heading">
          <div>
            <h2>บุคลากรงานประชาสัมพันธ์</h2>
            <p>
              ใช้งานอยู่ {activeCount} คน / ทั้งหมด {staff.length} คน
            </p>
          </div>
          <span className="staff-count">
            <Users size={18} aria-hidden="true" />
            {activeCount}
          </span>
        </div>

        <div className="staff-manager">
          <div className="staff-list" aria-label="รายชื่อบุคลากร">
            {staff.map((person) => (
              <article className={`staff-row ${person.isActive ? "" : "is-inactive"}`} key={person.id}>
                <div className="staff-avatar" aria-hidden="true">
                  {person.displayName.slice(0, 1)}
                </div>
                <div className="staff-main">
                  <strong>{person.displayName}</strong>
                  <span>{person.position}</span>
                  {person.email ? (
                    <small>
                      <Mail size={14} aria-hidden="true" />
                      {person.email}
                    </small>
                  ) : null}
                </div>
                <div className="staff-actions">
                  <button className="icon-button" type="button" onClick={() => toggleStaff(person.id)} title={person.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
                    {person.isActive ? <Power size={18} aria-hidden="true" /> : <RotateCcw size={18} aria-hidden="true" />}
                  </button>
                  <button className="icon-button danger" type="button" onClick={() => removeStaff(person.id)} title="ลบ">
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          <form
            className="staff-form"
            onSubmit={(event) => {
              event.preventDefault();
              addStaff();
            }}
          >
            <h3>เพิ่มเจ้าหน้าที่</h3>
            <label className="form-field">
              ชื่อ-สกุล
              <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label className="form-field">
              ตำแหน่ง
              <input className="input" value={position} onChange={(event) => setPosition(event.target.value)} />
            </label>
            <label className="form-field">
              อีเมล
              <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <button className="button coral" type="submit">
              <UserPlus size={18} aria-hidden="true" />
              เพิ่มรายชื่อ
            </button>
          </form>
        </div>
      </section>

      <section className="settings-grid">
        {cards.map((card) => (
          <article className="panel" key={card.title}>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
            <button className="button secondary">จัดการ</button>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
