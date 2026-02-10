import { Toaster } from 'react-hot-toast';
import '#css/styles.css';
import Footer from '#components/layout/Footer';
import Header from '#components/layout/Header';
import ReduxProvider from '#js/store/redux-provider';
import styles from './layout.module.css';

export default function RootLayout({ children }) {
  return (
    <ReduxProvider>
      <div className={styles.wrapper}>
        <Header />
        <main className={styles.main}>{children}</main>
        <Footer />
        <Toaster
          position='top-center'
          containerStyle={{
            top: '40%',
            transform: 'translateY(-50%)',
          }}
        />
      </div>
    </ReduxProvider>
  );
}
