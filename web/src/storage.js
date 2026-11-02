// What this browser keeps for the app (localStorage), as JSON: private mode or a broken value reads as empty, and a
// write that fails is kept for this visit only. And the query in the page's hash (#club?tab=feed).
export const stored = (key, empty) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? empty;
  } catch {
    return empty;
  }
};
export const store = (key, v) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: this visit only */
  }
};
export const hashQuery = () =>
  new URLSearchParams(location.hash.split('?')[1] || '');
