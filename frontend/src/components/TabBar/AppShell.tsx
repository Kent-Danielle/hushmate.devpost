import { Outlet, useMatch } from 'react-router';
import { DemoWelcomeCard } from '../DemoWelcomeCard';
import TabBar from './TabBar';
import styles from './TabBar.module.css';

/** The signed-in frame: page body above, tab bar below. Pages scroll as a whole, except the Schedule screen (see `.fixed`). */
export default function AppShell() {
  // The Schedule tab is a fixed-height screen: the page never scrolls, only its day grid does.
  const fixed = useMatch('/schedule/*') !== null;
  return (
    <div className={fixed ? `${styles.shell} ${styles.fixed}` : styles.shell} data-fixed={fixed ? '' : undefined}>
      <main className={styles.main}>
        <Outlet />
      </main>
      <TabBar />
      <DemoWelcomeCard />
    </div>
  );
}
