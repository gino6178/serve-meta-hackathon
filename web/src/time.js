// Dates on the page are the person's own days, never UTC's (before 08:00 in Taiwan, UTC is still yesterday).
export const DAY = 864e5;
const pad = n => String(n).padStart(2, '0');
// a Date or a time in ms (now, by default), as its local date "YYYY-MM-DD"
export const ymd = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// the local date n days from today
export const ymdIn = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
};
// "2026-11-02" -> that day at local midnight
export const dateOf = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
// the Monday of a date's week, at local midnight
export const monday = d => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
// how long ago a time was: "just now", "5 min ago", "3 h ago", "2 d ago" (short: "5 min", without the "ago")
export const ago = (t, {short = false} = {}) => {
  if (!t) return '';
  const s = (Date.now() - t) / 1000,
    x = short ? '' : ' ago';
  return s < 60
    ? 'just now'
    : s < 3600
      ? `${Math.round(s / 60)} min${x}`
      : s < 86400
        ? `${Math.round(s / 3600)} h${x}`
        : `${Math.round(s / 86400)} d${x}`;
};
