import {useEffect, useRef} from 'react';
import Icon from './Icon.jsx';
import {useReducedMotion} from '../hooks.js';

// One story at a time, full screen: the progress bars, a header (a face, a name, a line under it, close), what the
// story shows, and a tap or an arrow key to go back or on. Escape closes it. view(it, {still, next}) fills the slots
// for the current story:
//   label (for the dialog), face, name, sub, media (behind the header: a video), body (under it), className, style
// A story moves on by itself after `auto` ms (none when the viewer asked for less motion); auto: 0 leaves it to the
// story (a video calls next() when it ends).
export default function StoryViewer({
  items,
  at,
  onClose,
  onMove,
  view,
  auto = 6000,
}) {
  const still = useReducedMotion(),
    it = items[at],
    box = useRef(null);
  useEffect(() => {
    box.current?.focus();
    const k = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onMove(1);
      if (e.key === 'ArrowLeft') onMove(-1);
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (still || !auto) return;
    const id = setTimeout(() => onMove(1), auto);
    return () => clearTimeout(id);
  }, [at, still, auto]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!it) return null;
  const v = view(it, {still, next: () => onMove(1)});
  return (
    <div className="story-scrim" onClick={onClose}>
      <div
        ref={box}
        tabIndex={-1}
        className={v.className}
        role="dialog"
        aria-modal="true"
        aria-label={v.label}
        onClick={e => e.stopPropagation()}
        style={v.style}>
        <div className="story-bars" aria-hidden="true">
          {items.map((x, k) => (
            <i
              key={x.id}
              className={
                k < at ? 'done' : k === at ? (still ? 'done' : 'now') : ''
              }
            />
          ))}
        </div>
        {v.media}
        <header>
          {v.face}
          <span>
            <b>{v.name}</b>
            <span className="tiny">{v.sub}</span>
          </span>
          <button className="icon-btn sm" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>
        {v.body}
        <button
          className="story-nav prev"
          aria-label="Previous story"
          onClick={() => onMove(-1)}
        />
        <button
          className="story-nav next"
          aria-label="Next story"
          onClick={() => onMove(1)}
        />
      </div>
    </div>
  );
}
