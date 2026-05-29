import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { loginAPI } from "./authAPI";

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

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: storedUser || null,
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      localStorage.removeItem("user");
    },
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
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;