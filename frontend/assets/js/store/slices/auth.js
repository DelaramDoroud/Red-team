import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

const AUTH_API_BASE =
  process.env.NEXT_PUBLIC_AUTH_API_BASE_URL || 'http://localhost:3001';
const AUTH_API = `${AUTH_API_BASE}/api`;

const initialState = {
  user: null,
  isLoggedIn: false,
  roles: null,
  researchEntities: null,
  loading: false,
  error: null,
  loginRedirectPath: null,
  permissions: null,
  personResearchEntity: null,
};

export const fetchUserInfo = createAsyncThunk(
  'auth/fetchUserInfo',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${AUTH_API}/userinfo`, {
        credentials: 'include',
      });
      return response.json();
    } catch (error) {
      return rejectWithValue(error.message || 'Unable to fetch user info');
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await fetch(`${AUTH_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        const message = data?.message || 'Login failed';
        return rejectWithValue(message);
      }
      return data;
    } catch (error) {
      return rejectWithValue(error.message || 'Login failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${AUTH_API}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Logout failed');
    } catch (error) {
      return rejectWithValue(error.message);
    }
    return {};
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoginRedirectPath: (state, action) => {
      const newState = { ...state };
      newState.loginRedirectPath = action.payload;
      return newState;
    },
    clearUser: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserInfo.pending, (state) => ({
        ...state,
        loading: true,
        error: null,
      }))
      .addCase(fetchUserInfo.fulfilled, (state, action) => {
        const isLoggedIn = !!(
          action.payload?.isLoggedIn && action.payload.user
        );
        const user = action.payload?.user || null;
        return {
          ...state,
          user,
          isLoggedIn,
          researchEntities: action.payload?.researchEntities || null,
          roles: user?.role ? [user.role] : null,
          personResearchEntity:
            action.payload?.researchEntities?.find(
              (re) => re.type === 'person'
            ) ?? null,
          permissions: action.payload?.permissions || null,
          loading: false,
          error: null,
        };
      })
      .addCase(fetchUserInfo.rejected, (state, action) => ({
        ...state,
        user: null,
        isLoggedIn: false,
        loading: false,
        error: action.payload || 'Failed to fetch user info',
      }))
      .addCase(loginUser.pending, (state) => ({
        ...state,
        loading: true,
        error: null,
      }))
      .addCase(loginUser.fulfilled, (state, action) => {
        const user = action.payload?.user || null;
        return {
          ...state,
          user,
          isLoggedIn: !!user,
          loading: false,
          error: null,
          roles: user?.role ? [user.role] : null,
        };
      })
      .addCase(loginUser.rejected, (state, action) => ({
        ...state,
        loading: false,
        isLoggedIn: false,
        user: null,
        error: action.payload || 'Login failed',
      }))
      .addCase(logoutUser.pending, (state) => ({
        ...state,
        loading: true,
        error: null,
      }))
      .addCase(logoutUser.fulfilled, () => initialState)
      .addCase(logoutUser.rejected, (state, action) => ({
        ...state,
        loading: false,
        error: action.payload || 'Logout failed',
      }));
  },
});

export const getPath = () => window.location.pathname;

export const { setLoginRedirectPath, clearUser } = authSlice.actions;

export const authReducer = authSlice.reducer;
