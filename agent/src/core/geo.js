// Distance on the Earth's surface between two { lat, lon } points (haversine): in km, or in whole metres.
export const rad = d => (d * Math.PI) / 180;
export const km = (a, b) => {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
export const meters = (a, b) => Math.round(km(a, b) * 1000);
