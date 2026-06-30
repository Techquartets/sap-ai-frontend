/**
 * Security.jsx — Security & Access Console.
 * Route: /security
 *
 * Pixel-perfect match to Figma screenshots:
 *  • Header: "Security & Access Console" + subtitle + "Create New User" button (top right)
 *  • 4 stats cards: Active Sessions, Failed Logins (1H), WAF Blocked, DLP Alerts — each with icon + color
 *  • "Active Sessions" table: USER | ROLE | IP ADDRESS | LOGIN TIME | STATUS | ACTIONS (lock + trash)
 *  • "Failed Login Attempts" table: USER | IP ADDRESS | ATTEMPTS ↑↓ | LAST ATTEMPT | BLOCKED
 *  • "Create New User" modal: Full Name, Email Address, Role (dropdown), Password (hidden, linked to email)
 *  • Full Redux — securitySlice + securityAPI
 */



import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAppSelector } from "../app/hooks";

import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";

import {
  fetchSecurityStats,
  fetchActiveSessions,
  fetchFailedLogins,
  fetchUsers,
  createUser,
  updateUser,
  toggleUserLock,
  deleteUser,
  toggleFailedLoginBlock,
  openModal,
  closeModal,
} from "../features/security/securitySlice";

import { AVAILABLE_ROLES } from "../features/security/securityAPI";

import {
  ShieldCheck,
  LockSimple,
  Warning,
  Bell,
  UserPlus,
  PencilSimple,
  LockSimpleOpen,
  Trash,
  X,
  CircleNotch,
} from "@phosphor-icons/react";

/* ───────────────────────────────────────────── */
/* ROLE BADGES */
/* ───────────────────────────────────────────── */

const ROLE_STYLE = {
  Admin:
    "bg-blue-500/20 text-blue-300 border border-blue-500/30",

  Analyst:
    "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",

  Investigator:
    "bg-blue-500/20 text-blue-300 border border-blue-500/30",

  Manager:
    "bg-purple-500/20 text-purple-300 border border-purple-500/30",

  "Task Processor":
    "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
};

function RoleBadge({ role }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
        ROLE_STYLE[role] ||
        "bg-gray-500/20 text-gray-300"
      }`}
    >
      {role}
    </span>
  );
}

/* ───────────────────────────────────────────── */
/* STATS */
/* ───────────────────────────────────────────── */

function StatsCards() {

  const { stats } = useSelector(
    (s) => s.security
  );

  const cards = [
    {
      label: "ACTIVE SESSIONS",
      value: stats.activeSessions,
      icon: (
        <ShieldCheck
          size={16}
          className="text-emerald-400"
        />
      ),
    },
    {
      label: "FAILED LOGINS (1H)",
      value: stats.failedLogins1h,
      icon: (
        <LockSimple
          size={16}
          className="text-red-400"
        />
      ),
    },
    {
      label: "WAF BLOCKED",
      value: stats.wafBlocked,
      icon: (
        <Warning
          size={16}
          className="text-yellow-400"
        />
      ),
    },
    {
      label: "DLP ALERTS",
      value: stats.dlpAlerts,
      icon: (
        <Bell
          size={16}
          className="text-red-400"
        />
      ),
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">

      {cards.map((c) => (
        <div
          key={c.label}
          className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)]"
        >

          <div className="flex items-center gap-2 mb-3">
            {c.icon}

            <p className="text-[10px] tracking-widest text-[var(--muted)]">
              {c.label}
            </p>
          </div>

          <p className="text-3xl font-bold text-[var(--text)]">
            {c.value}
          </p>

        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────────────────────── */
/* ACTIVE SESSIONS TABLE */
/* ───────────────────────────────────────────── */

function ActiveSessionsTable({ isAdmin }) {

  const dispatch = useDispatch();

  const {
    sessions,
    sessionsLoading,
  } = useSelector((s) => s.security);

  if (sessionsLoading) {
    return (
      <div className="p-10 flex justify-center">
        <CircleNotch
          size={22}
          className="animate-spin text-blue-400"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">

      <div className="px-5 py-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold">
          Active Sessions
        </h2>
      </div>

      <table className="w-full text-sm">

        <thead className="border-b border-[var(--border)]">
          <tr>
            {[
              "USER",
              "ROLE",
              "IP ADDRESS",
              "LOGIN TIME",
              "STATUS",
              ...(isAdmin ? ["ACTIONS"] : []),
            ].map((h) => (
              <th
                key={h}
                className="px-5 py-3 text-left text-[10px] tracking-widest text-[var(--muted)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-[var(--border)]">

          {sessions.map((sess) => (

            <tr
              key={sess.id}
              className="hover:bg-white/[0.02]"
            >

              <td className="px-5 py-4">
                {sess.email}
              </td>

              <td className="px-5 py-4">
                <RoleBadge role={sess.role} />
              </td>

              <td className="px-5 py-4 font-mono text-[12px]">
                {sess.ip}
              </td>

              <td className="px-5 py-4">
                {sess.loginTime}
              </td>

              <td className="px-5 py-4">

                <span
                  className={`px-2 py-1 rounded text-xs ${
                    sess.status === "Active"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {sess.status}
                </span>

              </td>

              {isAdmin && (
                <td className="px-5 py-4">

                  <div className="flex items-center gap-2">

                    <button
                      onClick={() =>
                        dispatch(
                          openModal({
                            type: "EDIT",
                            user: sess,
                          })
                        )
                      }
                      className="text-gray-400 hover:text-white"
                      title="Edit user"
                    >
                      <PencilSimple size={16} />
                    </button>

                    <button
                      onClick={() =>
                        dispatch(
                          toggleUserLock({
                            id: sess.id,
                          })
                        )
                      }
                      className="text-yellow-400 hover:text-yellow-300"
                      title={sess.status === "Active" ? "Lock user" : "Unlock user"}
                    >
                      {sess.status === "Active" ? (
                        <LockSimple size={16} />
                      ) : (
                        <LockSimpleOpen size={16} />
                      )}
                    </button>

                    <button
                      onClick={() =>
                        dispatch(
                          openModal({
                            type: "DELETE",
                            user: sess,
                          })
                        )
                      }
                      className="text-red-400 hover:text-red-300"
                      title="Delete user"
                    >
                      <Trash size={16} />
                    </button>

                  </div>

                </td>
              )}

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}

/* ───────────────────────────────────────────── */
/* FAILED LOGIN TABLE */
/* ───────────────────────────────────────────── */

function FailedLoginsTable({ isAdmin }) {

  const dispatch = useDispatch();

  const { failedLogins } = useSelector(
    (s) => s.security
  );

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">

      <div className="px-5 py-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold">
          Failed Login Attempts
        </h2>
      </div>

      <table className="w-full text-sm">

        <thead className="border-b border-[var(--border)]">

          <tr>
            {[
              "USER",
              "IP ADDRESS",
              "ATTEMPTS",
              "LAST ATTEMPT",
              "BLOCKED",
            ].map((h) => (
              <th
                key={h}
                className="px-5 py-3 text-left text-[10px] tracking-widest text-[var(--muted)]"
              >
                {h}
              </th>
            ))}
          </tr>

        </thead>

        <tbody className="divide-y divide-[var(--border)]">

          {failedLogins.map((f) => (

            <tr key={f.id}>

              <td className="px-5 py-4">
                {f.email}
              </td>

              <td className="px-5 py-4 font-mono text-[12px]">
                {f.ip}
              </td>

              <td className="px-5 py-4">
                {f.attempts}
              </td>

              <td className="px-5 py-4">
                {f.lastAttempt}
              </td>

              <td className="px-5 py-4">

                {isAdmin ? (
                  <button
                    onClick={() =>
                      dispatch(
                        toggleFailedLoginBlock(f.id)
                      )
                    }
                    className={`px-2 py-1 rounded text-xs ${
                      f.blocked
                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        : "bg-gray-500/20 text-gray-300 hover:bg-gray-500/30"
                    }`}
                  >
                    {f.blocked ? "Yes" : "No"}
                  </button>
                ) : (
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      f.blocked
                        ? "bg-red-500/20 text-red-400"
                        : "bg-gray-500/20 text-gray-300"
                    }`}
                  >
                    {f.blocked ? "Yes" : "No"}
                  </span>
                )}

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}

/* ───────────────────────────────────────────── */
/* CREATE USER MODAL */
/* ───────────────────────────────────────────── */

function CreateUserModal() {

  const dispatch = useDispatch();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Analyst",
  });

  const handleSubmit = () => {

    dispatch(createUser(form));

  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">

      <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-[var(--border)] p-6">

        <div className="flex justify-between items-center mb-6">

          <div>
            <h2 className="text-lg font-semibold">
              Create New User
            </h2>

            <p className="text-sm text-gray-400">
              Add a user to the system
            </p>
          </div>

          <button
            onClick={() =>
              dispatch(closeModal())
            }
          >
            <X size={18} />
          </button>

        </div>

        <div className="space-y-4">

          <input
            placeholder="Full Name"
            className="w-full p-3 rounded-lg bg-[#0d1117]"
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
          />

          <input
            placeholder="Email"
            className="w-full p-3 rounded-lg bg-[#0d1117]"
            onChange={(e) =>
              setForm({
                ...form,
                email: e.target.value,
              })
            }
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded-lg bg-[#0d1117]"
            onChange={(e) =>
              setForm({
                ...form,
                password: e.target.value,
              })
            }
          />

          <select
            className="w-full p-3 rounded-lg bg-[#0d1117]"
            onChange={(e) =>
              setForm({
                ...form,
                role: e.target.value,
              })
            }
          >

            {AVAILABLE_ROLES.map((r) => (
              <option key={r}>
                {r}
              </option>
            ))}

          </select>

          <button
            onClick={handleSubmit}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          >
            Create User
          </button>

        </div>

      </div>

    </div>
  );
}

/* ───────────────────────────────────────────── */
/* EDIT USER MODAL */
/* ───────────────────────────────────────────── */

function EditUserModal() {

  const dispatch = useDispatch();

  const { activeUser } = useSelector(
    (s) => s.security
  );

  const [form, setForm] = useState({
    name: activeUser?.name || "",
    email: activeUser?.email || "",
    role: activeUser?.role || "",
  });

  const handleSave = () => {

    dispatch(
      updateUser({
        id: activeUser.id,
        payload: form,
      })
    );

  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">

      <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-[var(--border)] p-6">

        <div className="flex justify-between items-center mb-6">

          <h2 className="text-lg font-semibold">
            Edit User
          </h2>

          <button
            onClick={() =>
              dispatch(closeModal())
            }
          >
            <X size={18} />
          </button>

        </div>

        <div className="space-y-4">

          <input
            value={form.name}
            className="w-full p-3 rounded-lg bg-[#0d1117]"
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
          />

          <input
            value={form.email}
            className="w-full p-3 rounded-lg bg-[#0d1117]"
            onChange={(e) =>
              setForm({
                ...form,
                email: e.target.value,
              })
            }
          />

          <select
            value={form.role}
            className="w-full p-3 rounded-lg bg-[#0d1117]"
            onChange={(e) =>
              setForm({
                ...form,
                role: e.target.value,
              })
            }
          >

            {AVAILABLE_ROLES.map((r) => (
              <option key={r}>
                {r}
              </option>
            ))}

          </select>

          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          >
            Save Changes
          </button>

        </div>

      </div>

    </div>
  );
}

/* ───────────────────────────────────────────── */
/* DELETE USER MODAL */
/* ───────────────────────────────────────────── */

function DeleteUserModal() {

  const dispatch = useDispatch();

  const { activeUser } = useSelector(
    (s) => s.security
  );

  if (!activeUser) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">

      <div className="w-full max-w-sm bg-[#111827] rounded-2xl border border-[var(--border)] p-6">

        <div className="text-center space-y-5">

          <Trash
            size={28}
            className="mx-auto text-red-400"
          />

          <div>

            <h2 className="text-lg font-semibold">
              Delete User
            </h2>

            <p className="text-sm text-gray-400 mt-2">
              Are you sure you want to delete{" "}
              <span className="text-white">
                {activeUser.email}
              </span>
              ?
            </p>

          </div>

          <div className="flex gap-3">

            <button
              onClick={() =>
                dispatch(
                  deleteUser(activeUser.id)
                )
              }
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold"
            >
              Delete
            </button>

            <button
              onClick={() =>
                dispatch(closeModal())
              }
              className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-gray-300"
            >
              Cancel
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}

/* ───────────────────────────────────────────── */
/* MAIN PAGE */
/* ───────────────────────────────────────────── */

export default function Security() {

  const dispatch = useDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role === "Admin";

  const { modalType } = useSelector(
    (s) => s.security
  );

  useEffect(() => {

    dispatch(fetchSecurityStats());

    dispatch(fetchActiveSessions());

    dispatch(fetchFailedLogins());

    dispatch(fetchUsers());

  }, [dispatch]);

  return (
    <div className="flex h-screen bg-[var(--bg)]">

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">

        <Topbar />

        <div className="flex-1 overflow-y-auto p-6 flex justify-center">

          <div className="w-full max-w-[1200px] space-y-5">

            {/* HEADER */}
            <div className="flex items-start justify-between">

              <div>

                <h1 className="text-xl font-semibold text-[var(--text)]">
                  Security & Access Console
                </h1>

                <p className="text-sm text-[var(--muted)] mt-1">
                  Authentication, authorization, and security monitoring
                </p>

              </div>

              {isAdmin && (
                <button
                  onClick={() =>
                    dispatch(
                      openModal({
                        type: "CREATE",
                      })
                    )
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >

                  <UserPlus size={16} />

                  Create New User

                </button>
              )}

            </div>

            {/* STATS */}
            <StatsCards />

            {/* ACTIVE SESSIONS */}
            <ActiveSessionsTable isAdmin={isAdmin} />

            {/* FAILED LOGINS */}
            <FailedLoginsTable isAdmin={isAdmin} />

          </div>

        </div>

      </div>

      {/* MODALS */}
      {isAdmin && modalType === "CREATE" && (
        <CreateUserModal />
      )}

      {isAdmin && modalType === "EDIT" && (
        <EditUserModal />
      )}

      {isAdmin && modalType === "DELETE" && (
        <DeleteUserModal />
      )}

    </div>
  );
}