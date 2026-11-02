// Small text helpers the pages share: a first name, a name's initials, "3 games", a capital first letter.
export const first = n => String(n || '').split(' ')[0];
// (a member's agent, "Ana's agent", wears the member's initials)
export const initials = n =>
  String(n || '')
    .replace(/'s agent$/, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
export const plural = (n, one, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
export const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
