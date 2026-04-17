import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

function LocationMarker({ markerPos, setMarkerPos }) {
  useMapEvents({
    click(e) {
      setMarkerPos([e.latlng.lat, e.latlng.lng]);
    },
  });
  return markerPos ? <Marker position={markerPos} /> : null;
}

function AutoPanToMarker({ markerPos }) {
  const map = useMap();
  useEffect(() => {
    if (markerPos && Array.isArray(markerPos) && markerPos.length === 2) {
      map.setView(markerPos, map.getZoom(), { animate: true });
    }
  }, [markerPos, map]);
  return null;
}

export default function MapPicker({ markerPos, setMarkerPos, height = 300 }) {
  return (
    <MapContainer
      center={markerPos || [39.8283, -98.5795]} // Center of US
      zoom={markerPos ? 13 : 5}
      style={{ height, width: "100%", marginBottom: 16 }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AutoPanToMarker markerPos={markerPos} />
      <LocationMarker markerPos={markerPos} setMarkerPos={setMarkerPos} />
    </MapContainer>
  );
}
