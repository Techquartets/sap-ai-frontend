/**
 * Topbar.jsx — Pixel-perfect. Matches screenshot exactly.
 * Icons: Palette (theme), Sun/Moon (mode), Bell (notifications), user dropdown.
 */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../features/auth/authSlice";
import { useNavigate } from "react-router-dom";
import {
  Palette,
  Sun,
  Moon,
  Bell,
  CaretDown,
  SignOut,
  Gear,
  Check,
  WarningCircle,
  CalendarX,
  UserCircle,
  CheckCircle,
  Coins,
  Gauge,
  Key,
} from "@phosphor-icons/react";
import useNotificationStream from "../../hooks/useNotificationStream";
import LlmSettingsModal from "../settings/LlmSettingsModal";
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearToast,
} from "../../features/notifications/notificationsSlice";

const COLORS = [
  { name: "Blue",   value: "blue",   hex: "#2563EB" },
  { name: "Purple", value: "purple", hex: "#7C3AED" },
  { name: "Green",  value: "green",  hex: "#16A34A" },
  { name: "Orange", value: "orange", hex: "#EA580C" },
  { name: "Red",    value: "red",    hex: "#DC2626" },
  { name: "Teal",   value: "teal",   hex: "#0D9488" },
];

const TYPE_META = {
  SCHEDULE_FAILED: {
    icon: CalendarX,
    color: "text-amber-400",
    bg: "bg-amber-500/15",
  },
  SCHEDULER_STOPPED: {
    icon: WarningCircle,
    color: "text-red-400",
    bg: "bg-red-500/15",
  },
  CASE_ASSIGNED: {
    icon: UserCircle,
    color: "text-purple-400",
    bg: "bg-purple-500/15",
  },
  LLM_BUDGET_WARNING: {
    icon: Gauge,
    color: "text-amber-400",
    bg: "bg-amber-500/15",
  },
  LLM_BUDGET_EXHAUSTED: {
    icon: Coins,
    color: "text-red-400",
    bg: "bg-red-500/15",
  },
  LLM_USER_ALLOCATION_EXHAUSTED: {
    icon: WarningCircle,
    color: "text-orange-400",
    bg: "bg-orange-500/15",
  },
  BYOL_INVALID_API_KEY: {
    icon: Key,
    color: "text-red-400",
    bg: "bg-red-500/15",
  },
  BYOL_CREDITS_EXHAUSTED: {
    icon: Coins,
    color: "text-red-400",
    bg: "bg-red-500/15",
  },
};

const SEVERITY_DOT = {
  CRITICAL: "bg-red-500",
  WARNING: "bg-amber-500",
  INFO: "bg-blue-500",
};

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NotificationIcon({ type }) {
  const meta = TYPE_META[type] || TYPE_META.SCHEDULE_FAILED;
  const Icon = meta.icon;
  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
      <Icon size={16} weight="duotone" className={meta.color} />
    </div>
  );
}

export default function Topbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);
  const { items, unreadCount, toast } = useSelector((s) => s.notifications);

  const [themeOpen, setThemeOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const [llmSettingsOpen, setLlmSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [activeColor, setActiveColor] = useState("purple");

  const isAdmin = user?.role === "Admin";

  useNotificationStream(!!user);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dispatch(clearToast()), 5000);
    return () => clearTimeout(t);
  }, [toast, dispatch]);

  const applyColor = (c) => {
    document.documentElement.classList.remove(
      "theme-blue","theme-purple","theme-green","theme-orange","theme-red","theme-teal"
    );
    document.documentElement.classList.add(`theme-${c}`);
    setActiveColor(c);
    setThemeOpen(false);
  };

  const toggleMode = () => {
    document.documentElement.classList.toggle("light");
    setDarkMode(!darkMode);
  };

  const closeAll = () => {
    setThemeOpen(false);
    setUserOpen(false);
    setNotifOpen(false);
    setSettingsDropdownOpen(false);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await dispatch(markNotificationRead(notification.id));
    }
    setNotifOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleRemoveNotification = async (e, notificationId) => {
    e.stopPropagation();
    await dispatch(deleteNotification(notificationId));
  };

  return (
    <div
      className="h-14 flex-shrink-0 flex items-center justify-between px-5 border-b border-[var(--border)] bg-[var(--card)] relative z-30"
      onClick={(e) => { if (e.target === e.currentTarget) closeAll(); }}
    >
      {/* LEFT — breadcrumb placeholder */}
      <div />

      {/* Toast for live notifications */}
      {toast && (
        <div className="absolute top-16 right-5 w-80 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-3.5 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <NotificationIcon type={toast.type} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--text)]">{toast.title}</p>
              <p className="text-[12px] text-[var(--muted)] mt-0.5 line-clamp-2">{toast.message}</p>
            </div>
            <button
              onClick={() => dispatch(clearToast())}
              className="text-[var(--muted)] hover:text-[var(--text)] p-0.5"
            >
              <Check size={14} />
            </button>
          </div>
        </div>
      )}

      {/* RIGHT */}
      <div className="flex items-center gap-1">

        {/* ── Color Palette ──────────────────────────────────────────────────── */}
        <div className="relative">
          <button
            onClick={() => { setThemeOpen(!themeOpen); setUserOpen(false); setNotifOpen(false); }}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 transition-colors"
            title="Color theme"
          >
            <Palette size={19} weight="duotone" />
          </button>

          {themeOpen && (
            <div className="absolute right-0 top-11 w-44 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-1.5 z-50">
              <p className="px-2 py-1.5 text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">
                Color Scheme
              </p>
              <div className="space-y-0.5">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => applyColor(c.value)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: c.hex }} />
                    <span className="text-[13px] text-[var(--text)] flex-1 text-left">{c.name}</span>
                    {activeColor === c.value && (
                      <Check size={13} className="text-[var(--primary)]" weight="bold" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Dark / Light ────────────────────────────────────────────────────── */}
        <button
          onClick={toggleMode}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 transition-colors"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode
            ? <Sun  size={19} weight="duotone" />
            : <Moon size={19} weight="duotone" />
          }
        </button>

        {/* ── Notifications ────────────────────────────────────────────────────── */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setThemeOpen(false); setUserOpen(false); }}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 transition-colors relative"
            title="Notifications"
          >
            <Bell size={19} weight="duotone" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-0.5 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-11 w-96 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <div>
                  <p className="text-[13px] font-semibold text-[var(--text)]">Notifications</p>
                  {unreadCount > 0 && (
                    <p className="text-[11px] text-[var(--muted)]">{unreadCount} unread</p>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => dispatch(markAllNotificationsRead())}
                    className="text-[11px] text-[var(--primary)] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-[380px] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Bell size={28} className="mx-auto text-[var(--muted)] mb-2" weight="duotone" />
                    <p className="text-[13px] text-[var(--muted)]">No notifications yet</p>
                  </div>
                ) : (
                  items.map((n) => (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleNotificationClick(n)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNotificationClick(n); }}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-[var(--border)]/50 last:border-0 cursor-pointer ${
                        !n.read ? "bg-[var(--primary)]/5" : ""
                      }`}
                    >
                      <NotificationIcon type={n.type} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-[13px] font-medium truncate ${!n.read ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>
                            {n.title}
                          </p>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[n.severity] || SEVERITY_DOT.INFO}`} />
                        </div>
                        <p className="text-[12px] text-[var(--muted)] mt-0.5 line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-[var(--muted)]">{formatTime(n.createdAt)}</span>
                          <button
                            type="button"
                            onClick={(e) => handleRemoveNotification(e, n.id)}
                            className="text-[10px] text-red-400/70 hover:text-red-400 hover:underline"
                          >
                            remove
                          </button>
                        </div>
                      </div>
                      {n.read && (
                        <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 mt-1" weight="fill" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Divider ──────────────────────────────────────────────────────────── */}
        <div className="w-px h-5 bg-[var(--border)] mx-1.5" />

        {/* ── User Dropdown ────────────────────────────────────────────────────── */}
        <div className="relative">
          <button
            onClick={() => { setUserOpen(!userOpen); setThemeOpen(false); setNotifOpen(false); setSettingsDropdownOpen(false); }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <span className="text-[13px] text-[var(--muted)] hidden sm:block">
              {user?.email ?? "admin@corp.com"}
            </span>
            <CaretDown size={11} className="text-[var(--muted)]" />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-11 w-58 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden min-w-[220px]">
              {/* User header */}
              <div className="p-3.5 flex items-center gap-3 border-b border-[var(--border)]">
                <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {user?.name?.[0]?.toUpperCase() ?? "A"}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--text)] truncate">{user?.name ?? "Admin"}</p>
                  <p className="text-[11px] text-[var(--muted)] truncate">{user?.email ?? "admin@corp.com"}</p>
                  <span className="inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[var(--primary)]/15 text-[var(--primary)]">
                    {user?.role ?? "Administrator"}
                  </span>
                </div>
              </div>
              {/* Actions */}
              <div className="p-1.5 space-y-0.5">
                <div>
                  <button
                    onClick={() => {
                      if (isAdmin) setSettingsDropdownOpen(!settingsDropdownOpen);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[var(--text)] transition-colors ${
                      isAdmin ? "hover:bg-white/5" : "cursor-default"
                    }`}
                  >
                    <Gear size={14} className="text-[var(--muted)]" />
                    <span className="flex-1 text-left">Settings</span>
                    {isAdmin && (
                      <CaretDown
                        size={12}
                        className={`text-[var(--muted)] transition-transform ${
                          settingsDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </button>

                  {isAdmin && settingsDropdownOpen && (
                    <div className="mt-0.5 ml-2 pl-3 border-l border-[var(--border)]">
                      <button
                        onClick={() => {
                          setLlmSettingsOpen(true);
                          setSettingsDropdownOpen(false);
                          setUserOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[var(--text)] hover:bg-white/5 transition-colors text-left"
                      >
                        <Gauge size={14} className="text-[var(--muted)]" weight="duotone" />
                        LLM Configurations
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => { await dispatch(logout()); navigate("/login"); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <SignOut size={14} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {llmSettingsOpen && isAdmin && (
        <LlmSettingsModal onClose={() => setLlmSettingsOpen(false)} />
      )}
    </div>
  );
}
