import { Outlet } from 'react-router';
import { DemoWelcomeCard } from '../DemoWelcomeCard';
import TabBar from './TabBar';
import styles from './TabBar.module.css';

/** The signed-in frame: page body above, tab bar below. */
export default function AppShell() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
      <TabBar />
      <DemoWelcomeCard />
    </div>
  );
}
