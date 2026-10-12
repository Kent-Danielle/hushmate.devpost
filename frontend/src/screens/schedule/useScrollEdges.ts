import { useEffect, type RefObject } from 'react';

/**
 * Sets `data-more-start` / `data-more-end` on a horizontally scrolling element while there is more content
 * to scroll to on that side, so CSS can fade the matching edge. Updates on scroll and resize.
 */
export function useScrollEdges<T extends HTMLElement>(ref: RefObject<T | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      el.toggleAttribute('data-more-start', el.scrollLeft > 1);
      el.toggleAttribute('data-more-end', el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [ref]);
}
