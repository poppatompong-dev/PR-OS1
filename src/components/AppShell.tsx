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
import { UserMenu } from "@/components/UserMenu";

const navItems = [
  { href: "/", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/monitor", label: "จอมอนิเตอร์", icon: Monitor },
  { href: "/schedule", label: "ตารางงาน", icon: CalendarDays },
  { href: "/events/new", label: "เพิ่มงาน", icon: PlusCircle },
  { href: "/mobile/my-tasks", label: "มือถือ", icon: Smartphone },
  { href: "/reports", label: "รายงาน", icon: BarChart3 },
  { href: "/settings", label: "ตั้งค่า", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <ClipboardList size={24} aria-hidden="true" />
          </span>
          <div>
            <strong>PR-OS</strong>
            <small>Public Relations Ops</small>
          </div>
        </div>
        <div className="sidebar-status">
          <span className="live-dot" />
          <div>
            <strong>Operational Pilot</strong>
            <small>Mock data / Phase 0</small>
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
