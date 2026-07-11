/**
 * Sidebar.jsx — Pixel-perfect matching screenshot.
 * Deep navy dark sidebar, active state = primary pill, icons from phosphor.
 */
import { Link, useLocation } from "react-router-dom";
import {
  SquaresFour,
  Books,
  GitBranch,
  FolderSimple,
  ShieldCheck,
  HardDrive,
} from "@phosphor-icons/react";

const menu = [
  { name: "Dashboard",            path: "/",         icon: SquaresFour },
  { name: "Rule Library",         path: "/rules",    icon: Books       },
  { name: "AI Rule Architect",    path: "/architect",icon: GitBranch   },
  { name: "Case Management",      path: "/cases",    icon: FolderSimple},
  { name: "Security",             path: "/security", icon: ShieldCheck },
  { name: "Configurations",       path: "/servers",  icon: HardDrive   },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="w-56 min-h-screen flex-shrink-0 bg-[var(--card)] border-r border-[var(--border)] flex flex-col">

      {/* ── Brand ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[var(--border)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/20 flex items-center justify-center flex-shrink-0">
          <ShieldCheck size={18} weight="duotone" className="text-[var(--primary)]" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[var(--text)] leading-tight">AI Powered</p>
          <p className="text-[11px] font-bold text-[var(--text)] leading-tight">Smart Screening</p>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 p-3 space-y-0.5">
        {menu.map((item) => {
          const active = location.pathname === item.path;
          const Icon   = item.icon;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                active
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/[0.05]"
              }`}
            >
              <Icon
                size={17}
                weight={active ? "fill" : "duotone"}
                className={active ? "text-white" : ""}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer version ──────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-[var(--border)]">
        <p className="text-[10px] text-[var(--muted)] font-mono">v1.0.0 · Enterprise</p>
      </div>
    </div>
  );
}