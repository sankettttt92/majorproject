// src/components/IncidentMap.jsx
//
// A SINGLE Leaflet map instance stays mounted for the lifetime of the page.
// When the operator clicks a different incident, we do NOT unmount/remount
// this component (that full re-init of Leaflet + tile layer is the #1
// cause of the "laggy page" feeling) — we just update markers/polyline
// state and ask the existing map to flyTo the new point smoothly.

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { computeArrowEndpoint, computeWedgePolygon } from "../lib/geo";

// Leaflet's default marker icon paths break under Vite's bundling unless
// patched like this.
delete L.Icon.Default.prototype._get;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const lastKnownIcon = L.divIcon({
  className: "",
  html: `<span class="pulse-marker"><span class="pulse-marker__dot"></span></span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// Smoothly recenters the existing map when the selected incident (or its
// latest point) changes, without ever tearing the map down.
function FlyToPoint({ point, zoom }) {
  const map = useMap();
  const lastCentered = useRef(null);

  useEffect(() => {
    if (!point) return;
    const key = `${point[0].toFixed(5)},${point[1].toFixed(5)}`;
    if (lastCentered.current === key) return;
    lastCentered.current = key;
    map.flyTo(point, zoom ?? map.getZoom(), { duration: 0.8 });
  }, [point, zoom, map]);

  return null;
}

export default function IncidentMap({ history, prediction, showPrediction = true }) {
  const path = useMemo(
    () => history.map((p) => [p.latitude, p.longitude]),
    [history]
  );

  const lastPoint = useMemo(() => {
    if (prediction) return [prediction.last_latitude, prediction.last_longitude];
    if (path.length) return path[path.length - 1];
    return null;
  }, [prediction, path]);

  const arrowEnd = useMemo(() => {
    if (!lastPoint || prediction?.heading == null) return null;
    return computeArrowEndpoint(lastPoint[0], lastPoint[1], prediction.heading, 150);
  }, [lastPoint, prediction]);

  const wedge = useMemo(() => {
    if (!showPrediction || !lastPoint || !prediction?.estimated_distance_meters || prediction.heading == null) {
      return [];
    }
    return computeWedgePolygon(
      lastPoint[0],
      lastPoint[1],
      prediction.heading,
      prediction.estimated_distance_meters,
      55
    );
  }, [showPrediction, lastPoint, prediction]);

  const defaultCenter = lastPoint || [19.0728, 73.2385]; // Badlapur, MH fallback

  return (
    <MapContainer
      center={defaultCenter}
      zoom={15}
      scrollWheelZoom
      className="incident-map"
      preferCanvas
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FlyToPoint point={lastPoint} zoom={16} />

      {/* V6: prediction wedge, drawn under everything else */}
      {wedge.length > 0 && (
        <Polygon
          positions={wedge}
          pathOptions={{ color: "#F5A623", fillColor: "#F5A623", fillOpacity: 0.18, weight: 1 }}
        />
      )}

      {/* V3: polyline path connecting historical points */}
      {path.length > 1 && (
        <Polyline positions={path} pathOptions={{ color: "#35D07F", weight: 3, opacity: 0.8 }} />
      )}

      {/* V2: previous GPS points */}
      {history.slice(0, -1).map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.latitude, p.longitude]}
          radius={5}
          pathOptions={{ color: "#35D07F", fillColor: "#35D07F", fillOpacity: 0.9, weight: 1 }}
        />
      ))}

      {/* V4: direction arrow off the last known point */}
      {lastPoint && arrowEnd && (
        <Polyline
          positions={[lastPoint, arrowEnd]}
          pathOptions={{ color: "#FF4B3E", weight: 3 }}
        />
      )}

      {/* V1: last known location marker, always on top */}
      {lastPoint && <Marker position={lastPoint} icon={lastKnownIcon} />}
    </MapContainer>
  );
}