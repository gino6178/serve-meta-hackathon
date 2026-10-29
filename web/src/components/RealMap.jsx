import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./realmap.css";
import { agentFetch } from "../agent.js";
import { myPlace } from "../where.js";

// A real map (OpenStreetMap) around where the player is, with the courts for a sport nearby (agent places.js nearby).
// pick: tap a court, or anywhere on the map, to choose the place; onPick hears { name, lat, lon }. Without pick it
// only shows. marks: extra places to show ({ name, lat, lon }), such as the courts a plan chose.
// courts: show the courts nearby (off for a map of clubs); onMark: a tap on one of marks
export default function RealMap({ sport = "badminton", pick = false, onPick = () => {}, marks = [], onMark = null, courts = true, height = 240 }) {
  const box = useRef(null), map = useRef(null), layer = useRef(null), chosen = useRef(null), [note, setNote] = useState("");
  const pickRef = useRef(onPick); pickRef.current = onPick;

  useEffect(() => {
    const m = L.map(box.current, { zoomControl: false, attributionControl: true }).setView([25.033, 121.565], 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // (the box may still be growing when the map is made: measure it again once it has its size)
    const ro = new ResizeObserver(() => m.invalidateSize()); ro.observe(box.current);
    myPlace().then((p) => { if (p && map.current) { map.current.setView([p.lat, p.lon], 15); L.circleMarker([p.lat, p.lon], { radius: 6, color: "#0064e0", fillOpacity: 0.9 }).addTo(map.current); } });
    if (pick) m.on("click", (e) => choose({ name: "", lat: e.latlng.lat, lon: e.latlng.lng }));
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (p) => {
    if (!map.current) return;
    chosen.current?.remove();
    chosen.current = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "rm-pin", html: "<span></span>", iconSize: [26, 26], iconAnchor: [13, 26] }) }).addTo(map.current);
    pickRef.current(p);
  };

  // the courts around the map's centre, again when it is moved
  useEffect(() => {
    const m = map.current; if (!m || !courts) return;
    let t = null, live = true;
    const load = async () => {
      const c = m.getCenter();
      setNote("Finding courts…");
      try {
        const r = await agentFetch(`/api/places/near?lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}&sport=${encodeURIComponent(sport)}`);
        const j = await r.json();
        if (!live) return;
        if (!r.ok) throw new Error(j.error);
        layer.current.clearLayers();
        for (const p of j.places || []) {
          const mk = L.circleMarker([p.lat, p.lon], { radius: 8, color: "#0a7f44", weight: 2, fillColor: "#5fd39a", fillOpacity: 0.8 }).addTo(layer.current).bindTooltip(p.name || sport);
          if (pick) mk.on("click", (e) => { L.DomEvent.stopPropagation(e); choose({ name: p.name || `${sport} court`, lat: p.lat, lon: p.lon }); });
        }
        setNote((j.places || []).length ? "" : pick ? "No courts mapped here: tap anywhere to pin the place" : "No courts mapped here");
      } catch { if (live) setNote(pick ? "Tap anywhere to pin the place" : ""); }
    };
    const soon = () => { clearTimeout(t); t = setTimeout(load, 500); };
    m.on("moveend", soon); soon();
    return () => { live = false; clearTimeout(t); m.off("moveend", soon); };
  }, [sport, pick, courts]); // eslint-disable-line react-hooks/exhaustive-deps

  // places to show besides the courts
  useEffect(() => {
    const m = map.current; if (!m || !marks.length) return;
    const g = L.layerGroup(marks.filter((p) => p.lat != null).map((p) => {
      const mk = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: `rm-pin${p.mine ? " mine" : ""}`, html: "<span></span>", iconSize: [26, 26], iconAnchor: [13, 26] }) }).bindTooltip(p.name || "", { permanent: !!onMark, direction: "top", offset: [0, -24] });
      if (onMark) mk.on("click", (e) => { L.DomEvent.stopPropagation(e); onMark(p); });
      return mk;
    })).addTo(m);
    return () => g.remove();
  }, [marks]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rm">
      <div ref={box} className="rm-map" style={{ height }} />
      {note && <p className="rm-note">{note}</p>}
    </div>
  );
}
