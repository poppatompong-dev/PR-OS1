import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EventTable } from "@/components/EventTable";
import { getDepartments, getScheduleEvents } from "@/lib/events/queries";
import { CalendarX2, Filter, PlusCircle, Search } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "all", label: "ทุกสถานะ" },
  { value: "draft", label: "ร่าง" },
  { value: "published", label: "เผยแพร่" },
  { value: "completed", label: "เสร็จสิ้น" },
  { value: "canceled", label: "ยกเลิก" },
];

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; departmentId?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const filters = {
    status: sp.status ?? "all",
    departmentId: sp.departmentId ?? "all",
    search: sp.search ?? "",
  };

  const [events, departments] = await Promise.all([
    getScheduleEvents(filters),
    getDepartments(),
  ]);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">ตารางงานประชาสัมพันธ์</h1>
          <p className="page-subtitle">
            หน้าทำงานหลักสำหรับ staff และ supervisor • ข้อมูลจริงจากฐานข้อมูล ({events.length} งาน)
          </p>
        </div>
        <Link className="button" href="/events/new">
          <PlusCircle size={18} aria-hidden="true" />
          เพิ่มงาน
        </Link>
      </header>

      <form className="toolbar" method="get" aria-label="Schedule filters">
        <div className="search-box">
          <Search size={18} aria-hidden="true" />
          <input
            className="input"
            name="search"
            placeholder="ค้นหาชื่องาน"
            defaultValue={filters.search}
          />
        </div>
        <select className="select" name="status" defaultValue={filters.status}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select className="select" name="departmentId" defaultValue={filters.departmentId}>
          <option value="all">ทุกหน่วยงาน</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <button className="button" type="submit">
          <Filter size={18} aria-hidden="true" />
          กรอง
        </button>
      </form>

      {events.length > 0 ? (
        <EventTable events={events} />
      ) : (
        <div className="panel empty-state">
          <CalendarX2 size={28} aria-hidden="true" />
          <strong>ไม่พบงานตามเงื่อนไข</strong>
          <p>ลองปรับตัวกรอง หรือกด “เพิ่มงาน” เพื่อบันทึกงานใหม่</p>
        </div>
      )}
    </AppShell>
  );
}
