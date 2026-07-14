import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { loginAPI, logoutAPI } from "./authAPI";

const storedUser = JSON.parse(localStorage.getItem("user"));

export const login = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {

    try {
      const res = await loginAPI(
        email,
        password
      );

      if (!res.success) {
        return rejectWithValue(
          res.error || "Login failed"
        );
      }

      return res.user;

    } catch (err) {
      return rejectWithValue(
        err.message || "Login failed"
      );
    }
  }
);

export const logout = createAsyncThunk(
  "auth/logout",

  async (_, { rejectWithValue }) => {
    try {
      const res = await logoutAPI();
      if (!res.success) {
        return rejectWithValue(
          res.error || "Logout failed"
        );
      }

      return true;

    } catch (err) {
      return rejectWithValue(
        err.message || "Logout failed"
      );
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: storedUser || null,
    loading: false,
    error: null,
  },
  
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        localStorage.setItem("user", JSON.stringify(action.payload));
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.loading = false;
        state.error = null;
        localStorage.removeItem("user");
      })
      .addCase(logout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(logout.pending, (state) => {
        state.loading = true;
        state.error = null;
      });
  },
});

export default authSlice.reducer;