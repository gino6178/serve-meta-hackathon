import {useEffect, useRef, useState, useSyncExternalStore} from 'react';

// Asking again: fn(live) now, every ms, and on each window event in `on`, until the component goes away or deps change;
// live() is false from then on, so an answer that comes back late is dropped.
export function usePoll(fn, ms, deps = [], {on = []} = {}) {
  const f = useRef(fn);
  f.current = fn;
  useEffect(() => {
    let alive = true;
    const live = () => alive,
      run = () => f.current(live);
    run();
    const t = setInterval(run, ms);
    on.forEach(e => addEventListener(e, run));
    return () => {
      alive = false;
      clearInterval(t);
      on.forEach(e => removeEventListener(e, run));
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

// Whether the viewer asked their system for less motion. The hook re-renders when they change it with the page open;
// the plain function is for code outside React (the task runner's pauses).
const lessMotion =
  typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)')
    : null;
export const prefersReducedMotion = () => lessMotion?.matches === true;
function onMotionChange(notify) {
  lessMotion?.addEventListener('change', notify);
  return () => lessMotion?.removeEventListener('change', notify);
}
export const useReducedMotion = () =>
  useSyncExternalStore(onMotionChange, prefersReducedMotion, () => false);

// An element's width in CSS pixels, so an SVG chart can draw its text at the size it shows. One ResizeObserver
// serves every chart on the page; a width of 0 (a hidden tab) keeps the last one.
const widthSetters = new Map();
let sizes = null;
function measure(el, setWidth) {
  sizes ??= new ResizeObserver(entries => {
    for (const {target, contentRect} of entries) {
      const px = Math.round(contentRect.width);
      if (px > 0) widthSetters.get(target)?.(px);
    }
  });
  widthSetters.set(el, setWidth);
  sizes.observe(el);
  return () => {
    widthSetters.delete(el);
    sizes.unobserve(el);
  };
}
export function useWidth(fallback = 600) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(
    () => (ref.current ? measure(ref.current, setWidth) : undefined),
    [],
  );
  return [ref, width];
}
