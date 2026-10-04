import { NavLink } from 'react-router';
import { CalendarDays, House, MessageSquareText, User } from 'lucide-react';
import styles from './TabBar.module.css';

const TABS = [
  { to: '/schedule', label: 'Schedule', Icon: CalendarDays },
  { to: '/summary', label: 'Summary', Icon: MessageSquareText },
  { to: '/houses', label: 'Houses', Icon: House },
  { to: '/profile', label: 'Profile', Icon: User },
];

export default function TabBar() {
  return (
    <nav className={styles.bar} aria-label="Main">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={styles.tab}>
          <span className={styles.pill}>
            <Icon size={24} strokeWidth={2} aria-hidden="true" />
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
