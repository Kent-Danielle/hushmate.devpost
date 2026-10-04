import styles from './Placeholder.module.css';

/** Temporary body for tabs whose slice hasn't landed yet. Later slices replace the pages that use it. */
export default function Placeholder({ title }: { title: string }) {
  return (
    <section className={styles.wrap}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.empty}>
        <p className={styles.voice}>Coming soon</p>
        <p className={styles.caption}>This part of Hushmate is still being built.</p>
      </div>
    </section>
  );
}
