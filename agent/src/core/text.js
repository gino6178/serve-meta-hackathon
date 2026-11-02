// Small text helpers shared across the agents.
// one line of a person's text, as a name or a title is kept: no control characters, spaces closed up, at most n long
export const line = (s, n) =>
  String(s || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);
// the numbers a text writes ("19:30", "2.5", "40"), as written
export const nums = t => String(t).match(/\d+(?:[.:]\d+)?/g) || [];
