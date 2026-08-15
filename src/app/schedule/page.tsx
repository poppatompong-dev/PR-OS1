import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EventTable } from "@/components/EventTable";
import { CalendarMonthView } from "@/components/CalendarMonthView";
import { CalendarWeekView } from "@/components/CalendarWeekView";
import { getDepartments, getScheduleEvents } from "@/lib/events/queries";
import { Calendar as CalendarIcon, CalendarDays, CalendarX2, Filter, PlusCircle, Search, Table as TableIcon } from "lucide-react";

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
  searchParams: Promise<{
    status?: string;
    departmentId?: string;
    search?: string;
    view?: "table" | "month" | "week";
  }>;
}) {
  const sp = await searchParams;
  const view = sp.view ?? "table";
  const filters = {
    status: sp.status ?? "all",
    departmentId: sp.departmentId ?? "all",
    search: sp.search ?? "",
  };

  const [events, departments] = await Promise.all([
    getScheduleEvents(filters),
    getDepartments(),
  ]);

  const makeViewUrl = (newView: string) => {
    const params = new URLSearchParams();
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.departmentId !== "all") params.set("departmentId", filters.departmentId);
    if (filters.search) params.set("search", filters.search);
    params.set("view", newView);
    return `/schedule?${params.toString()}`;
  };

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">ตารางงานประชาสัมพันธ์</h1>
          <p className="page-subtitle">
            ศูนย์กลางติดตามและจัดสรรงานประชาสัมพันธ์ เทศบาลนครนครสวรรค์ ({events.length} งาน)
          </p>
        </div>
        <Link className="button" href="/events/new">
          <PlusCircle size={18} aria-hidden="true" />
          เพิ่มงานใหม่
        </Link>
      </header>

      {/* Toolbar & View Switcher */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        <form className="toolbar" method="get" aria-label="Schedule filters" style={{ marginBottom: 0 }}>
          <input type="hidden" name="view" value={view} />
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

        {/* View Switcher Buttons */}
        <div style={{ display: "flex", background: "var(--surface-soft)", padding: "4px", borderRadius: "var(--radius)", border: "1px solid var(--line)", gap: "4px" }}>
          <Link
            href={makeViewUrl("table")}
            className={`button ${view === "table" ? "coral" : "secondary"}`}
            style={{ minHeight: "36px", padding: "6px 12px", fontSize: "14px" }}
          >
            <TableIcon size={16} aria-hidden="true" />
            ตาราง
          </Link>
          <Link
            href={makeViewUrl("month")}
            className={`button ${view === "month" ? "coral" : "secondary"}`}
            style={{ minHeight: "36px", padding: "6px 12px", fontSize: "14px" }}
          >
            <CalendarIcon size={16} aria-hidden="true" />
            รายเดือน
          </Link>
          <Link
            href={makeViewUrl("week")}
            className={`button ${view === "week" ? "coral" : "secondary"}`}
            style={{ minHeight: "36px", padding: "6px 12px", fontSize: "14px" }}
          >
            <CalendarDays size={16} aria-hidden="true" />
            รายสัปดาห์
          </Link>
        </div>
      </div>

      {events.length > 0 ? (
        view === "month" ? (
          <CalendarMonthView events={events} />
        ) : view === "week" ? (
          <CalendarWeekView events={events} />
        ) : (
          <EventTable events={events} />
        )
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
