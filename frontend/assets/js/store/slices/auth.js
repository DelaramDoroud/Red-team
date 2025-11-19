import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
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
  async () => {
    try {
      const response = await fetch('/api/userinfo');
      return response.json();
    } catch (error) {
      return {};
    }
  }
);
export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      await fetch('/logout');
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
      .addCase(fetchUserInfo.pending, (state) => {
        const newState = { ...state };
        newState.loading = true;
        newState.error = null;
        return newState;
      })
      .addCase(fetchUserInfo.fulfilled, (state, action) => {
        const newState = { ...state };
        newState.user = action.payload.user || null;
        newState.researchEntities = action.payload.researchEntities || null;
        newState.roles = action.payload.roles || null;
        newState.personResearchEntity =
          action.payload.researchEntities?.find((re) => re.type === 'person') ??
          null;
        newState.permissions = action.payload.permissions || null;
        newState.loading = false;
        return newState;
      })
      .addCase(fetchUserInfo.rejected, (state, action) => {
        const newState = { ...state };
        newState.loading = false;
        newState.error = action.payload || 'Failed to fetch user info';
        return newState;
      })
      .addCase(logoutUser.pending, (state) => {
        const newState = { ...state };
        newState.loading = true;
        newState.error = null;
        return newState;
      })
      .addCase(logoutUser.fulfilled, () => initialState)
      .addCase(logoutUser.rejected, (state, action) => {
        const newState = { ...state };
        newState.loading = false;
        newState.error = action.payload || 'Logout failed';
        return newState;
      });
  },
});

export const getPath = () => window.location.pathname;

export const { setLoginRedirectPath, clearUser } = authSlice.actions;

export const authReducer = authSlice.reducer;
