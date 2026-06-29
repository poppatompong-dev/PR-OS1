import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EventTable } from "@/components/EventTable";
import { events } from "@/data/mock-data";
import { Download, PlusCircle, Search } from "lucide-react";

export default function SchedulePage() {
  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">ตารางงานประชาสัมพันธ์</h1>
          <p className="page-subtitle">ตารางนี้คือ mock ของหน้าทำงานหลักสำหรับ staff และ supervisor</p>
        </div>
        <Link className="button" href="/events/new">
          <PlusCircle size={18} aria-hidden="true" />
          เพิ่มงาน
        </Link>
      </header>

      <section className="toolbar" aria-label="Schedule filters">
        <div className="search-box">
          <Search size={18} aria-hidden="true" />
          <input className="input" placeholder="ค้นหาชื่องานหรือสถานที่" />
        </div>
        <select className="select" defaultValue="all">
          <option value="all">ทุกสถานะ</option>
          <option value="draft">ร่าง</option>
          <option value="published">เผยแพร่</option>
          <option value="canceled">ยกเลิก</option>
        </select>
        <select className="select" defaultValue="all">
          <option value="all">ทุกหน่วยงาน</option>
          <option value="dep_001">สำนักปลัดเทศบาล</option>
          <option value="dep_002">กองการศึกษา</option>
          <option value="dep_003">กองสาธารณสุขฯ</option>
        </select>
        <select className="select" defaultValue="pending">
          <option value="all">ทุกการรับทราบ</option>
          <option value="pending">รอรับทราบ</option>
          <option value="acknowledged">รับทราบแล้ว</option>
        </select>
        <button className="button secondary">
          <Download size={18} aria-hidden="true" />
          ส่งออก Excel
        </button>
      </section>

      <EventTable events={events} />
    </AppShell>
  );
}
