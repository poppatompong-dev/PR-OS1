"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Monitor,
  PlusCircle,
  Settings,
  Smartphone,
} from "lucide-react";

// The icon components live here rather than being handed down from AppShell:
// a React component is a function, and functions cannot cross the server ->
// client boundary as props.
const railItems = [
  { href: "/", label: "วันนี้", icon: LayoutDashboard },
  { href: "/monitor", label: "จอมอนิเตอร์", icon: Monitor },
  { href: "/announcements", label: "ประกาศบนจอ", icon: Megaphone },
  { href: "/schedule", label: "ตารางงาน / ปฏิทิน", icon: CalendarDays },
  { href: "/events/new", label: "เพิ่มงานใหม่", icon: PlusCircle },
  { href: "/mobile/my-tasks", label: "งานของฉัน", icon: Smartphone },
  { href: "/reports", label: "รายงานผู้บริหาร", icon: BarChart3 },
  { href: "/settings", label: "ตั้งค่าระบบ", icon: Settings },
];

// Phones and an upright iPad are the primary devices, so the five routes
// staff open all day get a thumb-reachable bar. The monitor wall and the
// admin console stay in the wide-screen rail only.
const barItems = [
  { href: "/", label: "วันนี้", icon: LayoutDashboard },
  { href: "/schedule", label: "ตารางงาน", icon: CalendarDays },
  { href: "/events/new", label: "เพิ่มงาน", icon: PlusCircle },
  { href: "/mobile/my-tasks", label: "งานของฉัน", icon: ClipboardList },
  { href: "/reports", label: "รายงาน", icon: BarChart3 },
];

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Marks the route the person is on. This matters more on the bottom bar than
 * on the rail, because on a phone the bar is the only navigation in view.
 */
export function NavLinks({ variant }: { variant: "rail" | "bar" }) {
  const pathname = usePathname() ?? "/";
  const items = variant === "rail" ? railItems : barItems;
  const iconSize = variant === "rail" ? 18 : 21;

  return (
    <>
      {items.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={current ? "is-current" : undefined}
            aria-current={current ? "page" : undefined}
          >
            <item.icon size={iconSize} aria-hidden="true" />
            {variant === "bar" ? <span>{item.label}</span> : item.label}
          </Link>
        );
      })}
    </>
  );
}
