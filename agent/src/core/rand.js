// Seeded randomness, the same every run: FNV-1a over a string (fnv), a final mix that spreads similar keys (mix), and
// mulberry32, a small generator from a 32-bit seed (rng). Each caller scales them as it always has, so its numbers
// stay the same.
export const fnv = s => {
  let h = 2166136261;
  for (const c of String(s)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
export const mix = h => {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};
export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
