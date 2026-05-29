const API_ROOT =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const BASE_URL = `${API_ROOT}/sap`;

export const AVAILABLE_ROLES = [
  "Admin",
  "Analyst",
  "Investigator",
  "Manager",
  "Task Processor",
];

async function parseJson(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || data.error || `Request failed (${response.status})`
    );
  }

  return data;
}

// ─────────────────────────────────────────────
// SECURITY STATS
// ─────────────────────────────────────────────

export const fetchSecurityStatsAPI = async () => {
  const response = await fetch(`${BASE_URL}/security/stats/`);
  const data = await parseJson(response);
  return data.stats;
};

// ─────────────────────────────────────────────
// FETCH ACTIVE USERS (sessions table)
// ─────────────────────────────────────────────

export const fetchActiveSessionsAPI = async () => {
  const response = await fetch(`${BASE_URL}/security/users/`);
  const data = await parseJson(response);
  return data.users;
};

// ─────────────────────────────────────────────
// FETCH FAILED LOGINS
// ─────────────────────────────────────────────

export const fetchFailedLoginsAPI = async () => {
  const response = await fetch(`${BASE_URL}/security/failed-logins/`);
  const data = await parseJson(response);
  return data.failedLogins;
};

// ─────────────────────────────────────────────
// FETCH USERS
// ─────────────────────────────────────────────

export const fetchUsersAPI = async () => {
  const response = await fetch(`${BASE_URL}/security/users/`);
  const data = await parseJson(response);
  return data.users;
};

// ─────────────────────────────────────────────
// CREATE USER
// ─────────────────────────────────────────────

export const createUserAPI = async (payload) => {
  const response = await fetch(`${BASE_URL}/security/users/create/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      role: payload.role,
      name: payload.name,
    }),
  });

  const data = await parseJson(response);
  return data.user;
};

// ─────────────────────────────────────────────
// TOGGLE USER LOCK
// ─────────────────────────────────────────────

export const toggleUserLockAPI = async (id) => {
  const response = await fetch(
    `${BASE_URL}/security/users/${id}/toggle-lock/`,
    {
      method: "PATCH",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to toggle user lock");
  }

  return {
    id: data.id ?? id,
    newStatus: data.newStatus,
  };
};

// ─────────────────────────────────────────────
// DELETE USER
// ─────────────────────────────────────────────

export const deleteUserAPI = async (id) => {
  const response = await fetch(
    `${BASE_URL}/security/users/${id}/delete/`,
    {
      method: "DELETE",
    }
  );

  await parseJson(response);
  return id;
};

// ─────────────────────────────────────────────
// TOGGLE FAILED LOGIN BLOCK
// ─────────────────────────────────────────────

export const toggleFailedLoginBlockAPI = async (id) => {
  const response = await fetch(
    `${BASE_URL}/security/failed-logins/${id}/toggle-block/`,
    {
      method: "PATCH",
    }
  );

  const data = await parseJson(response);
  return data.data;
};

// ─────────────────────────────────────────────
// UPDATE USER
// ─────────────────────────────────────────────

export const updateUserAPI = async (id, payload) => {
  const response = await fetch(
    `${BASE_URL}/security/users/${id}/update/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await parseJson(response);
  return data.user;
};
