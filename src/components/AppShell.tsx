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
  { href: "/", label: "วันนี้", icon: LayoutDashboard },
  { href: "/monitor", label: "จอมอนิเตอร์", icon: Monitor },
  { href: "/schedule", label: "ตารางงาน / ปฏิทิน", icon: CalendarDays },
  { href: "/events/new", label: "เพิ่มงานใหม่", icon: PlusCircle },
  { href: "/mobile/my-tasks", label: "งานของฉัน", icon: Smartphone },
  { href: "/reports", label: "รายงานผู้บริหาร", icon: BarChart3 },
  { href: "/settings", label: "ตั้งค่าระบบ", icon: Settings },
];

// Phones and an iPad held upright are the primary devices here, so the five
// routes staff open all day get a thumb-reachable bar at the bottom. The
// monitor wall and the admin console stay in the wide-screen rail only.
const barItems = [
  { href: "/", label: "วันนี้", icon: LayoutDashboard },
  { href: "/schedule", label: "ตารางงาน", icon: CalendarDays },
  { href: "/events/new", label: "เพิ่มงาน", icon: PlusCircle },
  { href: "/mobile/my-tasks", label: "งานของฉัน", icon: ClipboardList },
  { href: "/reports", label: "รายงาน", icon: BarChart3 },
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
        <nav className="nav-list" aria-label="เมนูหลัก">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <item.icon size={18} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <UserMenu />
      </aside>

      {/* compact header, narrow screens only */}
      <header className="top-bar">
        <Link href="/" className="top-brand">
          <span className="brand-mark">
            <ClipboardList size={18} aria-hidden="true" />
          </span>
          <span>
            <strong>PR-OS นครสวรรค์</strong>
            <small>{isLive ? "เชื่อมต่อฐานข้อมูลจริง" : "โหมดตัวอย่าง"}</small>
          </span>
        </Link>
        <Link href="/settings" className="top-action" aria-label="ตั้งค่าระบบ">
          <Settings size={20} aria-hidden="true" />
        </Link>
      </header>

      <main className="main-content">{children}</main>

      <nav className="bottom-nav" aria-label="เมนูหลัก (มือถือ)">
        {barItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <item.icon size={21} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
