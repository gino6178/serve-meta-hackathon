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
export const first = n => String(n || '').split(' ')[0];
