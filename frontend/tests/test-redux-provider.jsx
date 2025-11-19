import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { authReducer } from '#js/store/slices/auth';

export default function TestReduxProvider({ children, preloadedState }) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState,
  });

  return <Provider store={store}>{children}</Provider>;
}
