import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardList, Settings } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { UserMenu } from "@/components/UserMenu";
import { NavLinks } from "@/components/NavLinks";

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
          <NavLinks variant="rail" />
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
        <NavLinks variant="bar" />
      </nav>
    </div>
  );
}
