import { BrowserRouter } from 'react-router-dom';
import RootLayout from './app/layout';
import AppRoutes from './routes';

export default function App() {
  return (
    <BrowserRouter>
      <RootLayout>
        <AppRoutes />
      </RootLayout>
    </BrowserRouter>
  );
}
