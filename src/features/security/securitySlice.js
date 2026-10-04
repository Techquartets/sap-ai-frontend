/**
 * securitySlice.js
 * FIX 1: toggleUserLock.fulfilled reads action.payload.newStatus (from fixed API)
 *         and updates BOTH sessions[] and users[] so UI reflects immediately.
 * FIX 2: deleteUser.fulfilled removes from BOTH sessions[] and users[].
 * FIX 3: updateUser.fulfilled syncs BOTH arrays.
 * Everything else identical to original.
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// ─────────────────────────────────────────────
// API IMPORTS
// ─────────────────────────────────────────────

import {
  fetchSecurityStatsAPI,
  fetchActiveSessionsAPI,
  fetchFailedLoginsAPI,
  fetchUsersAPI,
  createUserAPI,
  toggleUserLockAPI,
  deleteUserAPI,
  toggleFailedLoginBlockAPI,
  updateUserAPI,
} from "./securityAPI";

// export roles to use in dropdowns/forms
export { AVAILABLE_ROLES } from "./securityAPI";


// ─────────────────────────────────────────────
// REUSABLE THUNK CREATOR
// avoids repeating try/catch everywhere
// ─────────────────────────────────────────────

const thunk = (type, api) =>
  createAsyncThunk(type, async (payload, { rejectWithValue }) => {
    try {
      return await api(payload);
    } catch (e) {
      return rejectWithValue(e.message);
    }
  });


// ─────────────────────────────────────────────
// ASYNC THUNKS
// ─────────────────────────────────────────────

// dashboard statistics
export const fetchSecurityStats = thunk(
  "security/fetchStats",
  fetchSecurityStatsAPI
);

// active session users
export const fetchActiveSessions = thunk(
  "security/fetchSessions",
  fetchActiveSessionsAPI
);

// failed login attempts
export const fetchFailedLogins = thunk(
  "security/fetchFailed",
  fetchFailedLoginsAPI
);

// all users
export const fetchUsers = thunk(
  "security/fetchUsers",
  fetchUsersAPI
);

// create new user
export const createUser = thunk(
  "security/createUser",
  createUserAPI
);

// lock/unlock user
export const toggleUserLock = thunk(
  "security/toggleLock",
  ({ id }) => toggleUserLockAPI(id)
);

// delete user
export const deleteUser = thunk(
  "security/deleteUser",
  deleteUserAPI
);

// block/unblock failed login record
export const toggleFailedLoginBlock = thunk(
  "security/toggleFailedLoginBlock",
  toggleFailedLoginBlockAPI
);

export const updateUser = createAsyncThunk(
  "security/updateUser",

  async ({ id, payload }, thunkAPI) => {

    try {

      return await updateUserAPI(
        id,
        payload
      );

    } catch (err) {

      return thunkAPI.rejectWithValue(
        err.message
      );
    }
  }
);


// ─────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────

const initialState = {

  // top dashboard cards
  stats: {
    activeSessions: 0,
    failedLogins1h: 0,
    wafBlocked: 0,
    dlpAlerts: 0,
  },

  // table data
  sessions: [],
  failedLogins: [],
  users: [],

  // loading states
  statsLoading: false,
  sessionsLoading: false,
  failedLoginsLoading: false,
  usersLoading: false,

  // error handling
  usersError: null,
  actionLoading: false,
  actionError: null,

  // modal state
  modalType: null,
  activeUser: null,

  // filters/search
  search: "",
  roleFilter: "All",
  statusFilter: "All",
};


// ─────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────

const securitySlice = createSlice({

  name: "security",

  initialState,

  reducers: {

    // open modal
    openModal: (state, action) => {

      state.modalType = action.payload.type;

      state.activeUser =
        action.payload.user || null;

      state.actionError = null;
    },

    // close modal
    closeModal: (state) => {

      state.modalType = null;

      state.activeUser = null;

      state.actionError = null;
    },

    // search filter
    setSearch: (state, action) => {

      state.search = action.payload;
    },

    // role filter
    setRoleFilter: (state, action) => {

      state.roleFilter = action.payload;
    },

    // status filter
    setStatusFilter: (state, action) => {

      state.statusFilter = action.payload;
    },
  },

  // ─────────────────────────────────────────────
  // API RESPONSE HANDLERS
  // ─────────────────────────────────────────────

  extraReducers: (builder) => {

    builder
  
      // ─────────────────────────────
      // FETCH SECURITY STATS
      // ─────────────────────────────
      .addCase(
        fetchSecurityStats.fulfilled,
        (state, action) => {
  
          state.stats = action.payload;
        }
      )
  
      // ─────────────────────────────
      // FETCH ACTIVE SESSIONS
      // ─────────────────────────────
      .addCase(
        fetchActiveSessions.fulfilled,
        (state, action) => {
  
          state.sessions = action.payload;
        }
      )
  
      // ─────────────────────────────
      // FETCH FAILED LOGINS
      // ─────────────────────────────
      .addCase(
        fetchFailedLogins.fulfilled,
        (state, action) => {
  
          state.failedLogins = action.payload;
        }
      )
  
      // ─────────────────────────────
      // FETCH USERS
      // ─────────────────────────────
      .addCase(
        fetchUsers.fulfilled,
        (state, action) => {
  
          state.users = action.payload;
        }
      )
  
      // ─────────────────────────────
      // CREATE USER
      // ─────────────────────────────
      .addCase(
        createUser.fulfilled,
        (state, action) => {
  
          // add to users table
          state.users.unshift(action.payload);
  
          // add to sessions table
          state.sessions.unshift(action.payload);
  
          // update stats
          state.stats.activeSessions++;
  
          // close modal
          state.modalType = null;
  
          state.actionLoading = false;
        }
      )
  
      // ─────────────────────────────
      // UPDATE USER
      // ─────────────────────────────
      .addCase(
        updateUser.pending,
        (state) => {
  
          state.actionLoading = true;
  
          state.actionError = null;
        }
      )
  
      .addCase(
        updateUser.fulfilled,
        (state, action) => {
  
          state.actionLoading = false;
  
          // update sessions table
          state.sessions = state.sessions.map((u) =>
            u.id === action.payload.id
              ? action.payload
              : u
          );
  
          // update users table
          state.users = state.users.map((u) =>
            u.id === action.payload.id
              ? action.payload
              : u
          );
  
          // close modal
          state.modalType = null;
  
          state.activeUser = null;
        }
      )
  
      .addCase(
        updateUser.rejected,
        (state, action) => {
  
          state.actionLoading = false;
  
          state.actionError = action.payload;
        }
      )
  
      // ─────────────────────────────
      // LOCK / UNLOCK USER
      // ─────────────────────────────
      .addCase(
        toggleUserLock.fulfilled,
        (state, action) => {
  
          const { id, newStatus } = action.payload;
  
          // update users + sessions
          [state.users, state.sessions].forEach((arr) => {
  
            const item = arr.find(
              (x) => x.id === id
            );
  
            if (item) {
              item.status = newStatus;
              item.is_locked = newStatus === "Locked";
            }
          });
  
          // recalculate active sessions
          state.stats.activeSessions =
            state.sessions.filter(
              (x) => x.status === "Active"
            ).length;
        }
      )
  
      // ─────────────────────────────
      // DELETE USER
      // ─────────────────────────────
      .addCase(
        deleteUser.fulfilled,
        (state, action) => {
  
          const id = action.payload;
  
          // remove from users
          state.users =
            state.users.filter(
              (u) => u.id !== id
            );
  
          // remove from sessions
          state.sessions =
            state.sessions.filter(
              (u) => u.id !== id
            );
  
          // update stats
          state.stats.activeSessions =
            state.sessions.filter(
              (x) => x.status === "Active"
            ).length;
  
          // close modal
          state.modalType = null;
  
          state.activeUser = null;
        }
      )
  
      // ─────────────────────────────
      // BLOCK / UNBLOCK FAILED LOGIN
      // ─────────────────────────────
      .addCase(
        toggleFailedLoginBlock.fulfilled,
        (state, action) => {
  
          const updated = action.payload;
  
          const index =
            state.failedLogins.findIndex(
              (f) => f.id === updated.id
            );
  
          if (index !== -1)
            state.failedLogins[index] = updated;

          if (updated.blocked) {
            const lockUser = (user) =>
              user.email === updated.email
                ? {
                    ...user,
                    status: "Locked",
                    is_locked: true,
                  }
                : user;

            state.sessions = state.sessions.map(lockUser);
            state.users = state.users.map(lockUser);

            state.stats.activeSessions = state.sessions.filter(
              (x) => x.status === "Active"
            ).length;
          }
        }
      );
  },
});


// ─────────────────────────────────────────────
// ACTION EXPORTS
// ─────────────────────────────────────────────

export const {
  openModal,
  closeModal,
  setSearch,
  setRoleFilter,
  setStatusFilter,
} = securitySlice.actions;


// ─────────────────────────────────────────────
// FILTERED USER SELECTOR
// used for search + filters
// ─────────────────────────────────────────────

export const selectFilteredUsers = (state) => {

  const {
    users,
    search,
    roleFilter,
    statusFilter,
  } = state.security;

  const query = search.toLowerCase();

  return users.filter((user) => {

    // search by email
    const searchMatch =
      !query ||
      user.email
        ?.toLowerCase()
        .includes(query);

    // role filter
    const roleMatch =
      roleFilter === "All" ||
      user.role === roleFilter;

    // status filter
    const statusMatch =
      statusFilter === "All" ||
      user.status === statusFilter;

    return (
      searchMatch &&
      roleMatch &&
      statusMatch
    );
  });
};


// ─────────────────────────────────────────────
// REDUCER EXPORT
// ─────────────────────────────────────────────

export default securitySlice.reducer;