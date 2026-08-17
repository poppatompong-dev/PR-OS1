import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Monitor,
  PlusCircle,
  Settings,
  Smartphone,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { UserMenu } from "@/components/UserMenu";

const navItems = [
  { href: "/", label: "ภาพรวมระบบ", icon: LayoutDashboard },
  { href: "/monitor", label: "จอมอนิเตอร์", icon: Monitor },
  { href: "/schedule", label: "ตารางงาน / ปฏิทิน", icon: CalendarDays },
  { href: "/events/new", label: "เพิ่มงานใหม่", icon: PlusCircle },
  { href: "/mobile/my-tasks", label: "งานของฉัน (มือถือ)", icon: Smartphone },
  { href: "/reports", label: "รายงานผู้บริหาร", icon: BarChart3 },
  { href: "/settings", label: "ตั้งค่าระบบ", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const isLive = isSupabaseConfigured();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <ClipboardList size={24} aria-hidden="true" />
          </span>
          <div>
            <strong>PR-OS นครสวรรค์</strong>
            <small>ระบบงานประชาสัมพันธ์</small>
          </div>
        </div>
        <div className="sidebar-status">
          <span className={isLive ? "live-dot" : "live-dot amber"} />
          <div>
            <strong>เทศบาลนครนครสวรรค์</strong>
            <small>{isLive ? "เชื่อมต่อฐานข้อมูลจริง" : "โหมดตัวอย่าง (Mock Data)"}</small>
          </div>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <item.icon size={18} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <UserMenu />
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
