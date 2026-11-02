// Small date and time helpers shared across the agents: weekday names, a local date as YYYY-MM-DD, minutes since
// midnight from "HH:MM" and back, and a person's first name.
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = n => String(n).padStart(2, '0');
// a Date or a time in ms, as its local date
export const ymd = t => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// "19:30" -> 1170 (a number is taken as minutes already)
export const toMin = t => {
  if (typeof t === 'number') return t;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
};
// 1170 -> "19:30"
export const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
// the part of the day a start falls in
export const PARTS = ['early', 'morning', 'afternoon', 'evening'];
export const partOf = start => {
  const h = +String(start).slice(0, 2);
  return h < 9
    ? 'early'
    : h < 12
      ? 'morning'
      : h < 17
        ? 'afternoon'
        : 'evening';
};
export const first = n => String(n || '').split(' ')[0];
export const DAY = 864e5;
export const LONG = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
};
// "2026-11-02" -> that day at local midnight
export const dateOf = s => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
};
// the Monday that starts the week of a Date or a time in ms, at local midnight
export const monday = t => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
