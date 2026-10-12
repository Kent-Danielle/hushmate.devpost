import { useEffect, useRef } from 'react';

const DRAG_THRESHOLD_PX = 4;

/**
 * Mouse click-and-drag to pan an element horizontally. Touch and pen are left to native scrolling.
 * Sets `data-overflow` on the element while it scrolls horizontally (so CSS can show a grab cursor)
 * and `data-dragging` while a drag is in progress. A drag swallows the click that ends it, so it
 * never activates a button under the pointer.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const updateOverflow = () => {
      el.toggleAttribute('data-overflow', el.scrollWidth > el.clientWidth + 1);
    };
    updateOverflow();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOverflow);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);

    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;
    let dragging = false;
    let swallowClick = false;
    let resetTimer: number | undefined;

    const finish = () => {
      if (pointerId === null) return;
      if (dragging && el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId);
      pointerId = null;
      el.removeAttribute('data-pressing');
      el.removeAttribute('data-dragging');
      if (dragging) {
        // The click that ends a drag fires right after pointerup; clear the flag once it has passed.
        swallowClick = true;
        resetTimer = window.setTimeout(() => {
          swallowClick = false;
        }, 0);
      }
      dragging = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !e.isPrimary) return;
      if (el.scrollWidth <= el.clientWidth) return;
      window.clearTimeout(resetTimer);
      swallowClick = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      dragging = false;
      el.setAttribute('data-pressing', ''); // user-select: none before the browser starts a text selection
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        el.setPointerCapture(e.pointerId);
        el.setAttribute('data-dragging', '');
        window.getSelection()?.removeAllRanges();
      }
      el.scrollLeft = startScroll - dx;
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerId === pointerId) finish();
    };

    const onClickCapture = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerEnd);
    el.addEventListener('pointercancel', onPointerEnd);
    el.addEventListener('click', onClickCapture, true);
    return () => {
      observer?.disconnect();
      window.clearTimeout(resetTimer);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return ref;
}
