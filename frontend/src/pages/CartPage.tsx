// pages/CartPage.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { useCart } from "../context/CartContext";
import { getToken } from "../utils/auth";

// ─── Leaflet types (minimal, injected via CDN) ───────────────
declare global {
  interface Window {
    L: any;
  }
}

// ─── API ─────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

async function apiFetch<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data?.message ?? data?.error ?? `Request failed (${res.status})`
    );
  }

  return data as T;
}

const deliveryApi = {
  create: (body: {
    services: { price: string; shop: string; quantity: number }[];
    userLocation: { type: "Point"; coordinates: [number, number] };
  }) =>
    apiFetch<{
      success: boolean;
      message: string;
      data: any;
    }>(`/api/delivery/create`, "POST", body),
};

// ─── Photon (Komoot) search result ───────────────────────────
interface PhotonFeature {
  geometry: { coordinates: [number, number] }; // [lng, lat]
  properties: {
    osm_id: number;
    name?: string;
    street?: string;
    housenumber?: string;
    suburb?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    type?: string;
    postcode?: string;
  };
}

// Build a two-line label like Google Maps: "Name" + "Area, City, State"
function formatPhotonResult(f: PhotonFeature): { primary: string; secondary: string } {
  const p = f.properties;
  const primary =
    p.name ||
    [p.housenumber, p.street].filter(Boolean).join(" ") ||
    p.suburb ||
    p.district ||
    p.city ||
    "Unknown place";

  const parts = [
    p.name ? p.street || p.suburb : null,
    p.district !== primary ? p.district : null,
    p.suburb !== primary ? p.suburb : null,
    p.city,
    p.state,
  ].filter(Boolean);

  // Deduplicate adjacent identical values
  const seen = new Set<string>();
  const secondary = parts
    .filter((v) => {
      if (!v || seen.has(v)) return false;
      seen.add(v);
      return true;
    })
    .slice(0, 4)
    .join(", ");

  return { primary, secondary };
}

// Place type → emoji icon
function placeIcon(type?: string): string {
  const t = (type ?? "").toLowerCase();
  if (t === "house" || t === "building") return "🏠";
  if (t === "street" || t === "road") return "🛣️";
  if (t === "suburb" || t === "neighbourhood" || t === "quarter") return "📍";
  if (t === "city" || t === "town" || t === "village") return "🏙️";
  if (t === "district" || t === "county") return "🗺️";
  if (t === "restaurant" || t === "cafe" || t === "food") return "🍽️";
  if (t === "hospital" || t === "pharmacy") return "🏥";
  if (t === "school" || t === "university") return "🎓";
  if (t === "hotel") return "🏨";
  if (t === "park") return "🌳";
  return "📍";
}

// ─── Load Leaflet CSS + JS once ───────────────────────────────
function useLeaflet(onReady: () => void) {
  useEffect(() => {
    if (window.L) { setTimeout(onReady, 0); return; }

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = onReady;
    document.head.appendChild(script);

    return () => {
      // leave CSS/JS in DOM for subsequent opens
    };
  }, []);
}

// ─── LocationPickerModal ──────────────────────────────────────
interface LocationPickerModalProps {
  onConfirm: (coords: [number, number], label: string) => void;
  onClose: () => void;
}

function LocationPickerModal({ onConfirm, onClose }: LocationPickerModalProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [coordsState, setCoordsState] = useState<[number, number] | null>(null);
  const [label, setLabel] = useState("Locating you…");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PhotonFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(true);
  // Store GPS coords for Photon location bias
  const gpsCoords = useRef<{ lat: number; lng: number } | null>(null);

  // ── Reverse geocode ──────────────────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const d = await r.json();

    if (d.address) {
      const a = d.address;

      // Primary: neighbourhood or suburb
      const area = a.neighbourhood || a.suburb || a.quarter || "";

      // Secondary: city or town or village
      const city = a.city || a.town || a.village || a.county || "";

      // State + postcode
      const state = a.state || "";
      const postcode = a.postcode || "";

      // Build label: "Shaniwari, Mominpura, Nagpur, Maharashtra 440002"
      const parts = [area, city !== area ? city : "", state, postcode]
        .filter(Boolean);

      // Deduplicate
      const seen = new Set<string>();
      const label = parts
        .filter((v) => {
          if (seen.has(v)) return false;
          seen.add(v);
          return true;
        })
        .join(", ");

      setLabel(label || d.display_name);
    } else {
      setLabel(d.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  } catch {
    setLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  }
}, []);

  // ── Move marker programmatically ─────────────────────────────
  const moveMarker = useCallback(
    (lat: number, lng: number) => {
      if (!leafletMap.current || !markerRef.current) return;
      markerRef.current.setLatLng([lat, lng]);
      leafletMap.current.setView([lat, lng], 15, { animate: true });
      setCoordsState([lng, lat]); // [lon, lat] for GeoJSON
      reverseGeocode(lat, lng);
    },
    [reverseGeocode]
  );

  // ── Init map once Leaflet is ready ───────────────────────────
  const initMap = useCallback(
    (lat: number, lng: number) => {
      if (!mapRef.current || leafletMap.current) return;

      const L = window.L;

      leafletMap.current = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(leafletMap.current);

      // Custom cyan pin icon
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:36px;height:36px;
          background:var(--cyan-500,#06b6d4);
          border:3px solid #fff;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 4px 14px rgba(6,182,212,.6);
        "></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      markerRef.current = L.marker([lat, lng], { draggable: true, icon }).addTo(
        leafletMap.current
      );

      markerRef.current.on("dragend", (e: any) => {
        const { lat: mLat, lng: mLng } = e.target.getLatLng();
        setCoordsState([mLng, mLat]);
        reverseGeocode(mLat, mLng);
      });

      leafletMap.current.on("click", (e: any) => {
        moveMarker(e.latlng.lat, e.latlng.lng);
      });

      setCoordsState([lng, lat]);
      reverseGeocode(lat, lng);
      setLocating(false);
    },
    [reverseGeocode, moveMarker]
  );

  // ── Load Leaflet then get GPS ────────────────────────────────
  useLeaflet(() => setMapReady(true));

  useEffect(() => {
    if (!mapReady) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsCoords.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        initMap(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? "Location access denied. Please allow location or pick manually."
            : "Could not fetch location. Pick a spot on the map."
        );
        // Fall back to Hyderabad centre
        gpsCoords.current = { lat: 17.385, lng: 78.4867 };
        initMap(17.385, 78.4867);
      },
      { timeout: 8000 }
    );
  }, [mapReady]);
  // Inside LocationPickerModal, add a cleanup useEffect:
useEffect(() => {
  return () => {
    if (leafletMap.current) {
      leafletMap.current.remove();
      leafletMap.current = null;
    }
  };
}, []);
  // ── Photon (Komoot) search — location-biased ──────────
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!val.trim()) { setSearchResults([]); return; }

    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const bias = gpsCoords.current ?? { lat: 17.385, lng: 78.4867 };
        const url =
          `https://photon.komoot.io/api/?q=${encodeURIComponent(val)}` +
          `&limit=8&lang=en&lat=${bias.lat}&lon=${bias.lng}`;
        const r = await fetch(url);
        const json = await r.json();
        setSearchResults((json.features ?? []) as PhotonFeature[]);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const pickResult = (feature: PhotonFeature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const { primary } = formatPhotonResult(feature);
    moveMarker(lat, lng);
    setSearchQuery(primary);
    setSearchResults([]);
  };

  // ── Confirm ──────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!coordsState) return;
    onConfirm(coordsState, label);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
          animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1001,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          pointerEvents: "none",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: "all",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-xl)",
            width: "100%",
            maxWidth: 540,
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
            overflow: "visible",
            animation: "slideUp 0.25s cubic-bezier(.22,1,.36,1)",
            display: "flex",
            flexDirection: "column",
            maxHeight: "90vh",
          }}
        >
          {/* ── Modal Header ── */}
          <div
            style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "var(--radius-md)",
                  background: "var(--cyan-500)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 14px rgba(6,182,212,.4)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--navy-900)" strokeWidth="2.5">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "var(--text-base)" }}>
                  Confirm Delivery Location
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                  Drag the pin or click anywhere to adjust
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid var(--border-default)",
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-tertiary)",
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* ── Search Bar ── */}
          <div style={{ padding: "14px 20px", position: "relative", flexShrink: 0, zIndex: 50 }}>
            <div style={{ position: "relative" }}>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-tertiary)" strokeWidth="2"
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              >
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Search for an address…"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px 10px 38px",
                  background: "var(--bg-page)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-sm)",
                  outline: "none",
                }}
              />
              {searching && (
                <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" stroke="var(--cyan-500)" strokeWidth="2.5" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                </div>
              )}
            </div>

            {/* Search Results Dropdown — Google Maps style two-line layout */}
            {searchResults.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 20,
                  right: 20,
                  top: "calc(100% - 2px)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  zIndex: 9999,
                  boxShadow: "0 12px 32px rgba(0,0,0,.4)",
                  overflow: "hidden",
                  maxHeight: 340,
                  overflowY: "auto",
                }}
              >
                {searchResults.map((feature, idx) => {
                  const { primary, secondary } = formatPhotonResult(feature);
                  const icon = placeIcon(feature.properties.type);
                  return (
                    <button
                      key={`${feature.properties.osm_id}-${idx}`}
                      onClick={() => pickResult(feature)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "12px 14px",
                        background: "transparent",
                        border: "none",
                        borderBottom: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.background = "var(--bg-page)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.background = "transparent")
                      }
                    >
                      {/* Pin icon bubble */}
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "var(--bg-page)",
                        border: "1px solid var(--border-default)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        flexShrink: 0,
                      }}>
                        {icon}
                      </div>
                      {/* Two-line text */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          fontSize: "var(--text-sm)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {primary}
                        </div>
                        {secondary && (
                          <div style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text-tertiary)",
                            marginTop: 2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}>
                            {secondary}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* GPS error banner */}
          {gpsError && (
            <div
              style={{
                margin: "0 20px 10px",
                padding: "10px 14px",
                background: "rgba(239,68,68,.1)",
                border: "1px solid rgba(239,68,68,.3)",
                borderRadius: "var(--radius-md)",
                color: "#f87171",
                fontSize: "var(--text-xs)",
                flexShrink: 0,
              }}
            >
              ⚠️ {gpsError}
            </div>
          )}

          {/* ── Map Container ── */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            {/* Locating overlay */}
            {locating && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 5,
                  background: "var(--bg-page)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" stroke="var(--cyan-500)" strokeWidth="2" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                </svg>
                <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
                  Fetching your location…
                </span>
              </div>
            )}
            <div
              ref={mapRef}
              style={{
                width: "100%",
                height: 300,
                display: "block",
              }}
            />
          </div>

          {/* ── Selected Location Label ── */}
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--border-subtle)",
              background: "var(--bg-page)",
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 4 }}>
              Selected location
            </div>
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-primary)",
                lineHeight: 1.5,
                fontWeight: 500,
                minHeight: 20,
              }}
            >
              {label}
            </div>
            {coordsState && (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                {Number(coordsState[1]).toFixed(6)}, {Number(coordsState[0]).toFixed(6)}
              </div>
            )}
          </div>

          {/* ── Confirm Button ── */}
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              gap: 10,
              flexShrink: 0,
            }}
          >
            <button
              onClick={onClose}
              style={{
                flex: 1,
                height: 46,
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-default)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "var(--text-sm)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!coordsState}
              className="btn btn-primary"
              style={{
                flex: 2,
                height: 46,
                borderRadius: "var(--radius-lg)",
                fontWeight: 700,
                fontSize: "var(--text-sm)",
                opacity: coordsState ? 1 : 0.5,
                cursor: coordsState ? "pointer" : "not-allowed",
              }}
            >
              Confirm & Place Order
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        .leaflet-pane, .leaflet-control-container { z-index: 1 !important; }
        .leaflet-top, .leaflet-bottom { z-index: 2 !important; }
        @keyframes slideUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  );
}

// ─── CartPage ─────────────────────────────────────────────────
export default function CartPage() {
  const { cart, updateCart, removeFromCart, fetchCart } = useCart();

  const [loading, setLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const total = cart.reduce(
    (acc, item) => acc + item.price.charge * item.quantity,
    0
  );

  // ─── Checkout (called after location confirmed) ──────────────
// In CartPage, replace handleCheckout:
const handleCheckout = async (
  coordinates: [number, number],
  _label: string
) => {
  // Close AFTER the async work, not before
  try {
    setLoading(true);
    setShowLocationPicker(false); // still close early, but loading=true prevents re-open

    const services = cart.map((item) => ({
      price: item.price._id,
      shop: item.shop._id,
      quantity: item.quantity,
    }));

    const res = await deliveryApi.create({
      services,
      userLocation: {
        type: "Point",
        coordinates,
      },
    });

    await fetchCart();
    alert(res.message || "Delivery created successfully");
  } catch (error) {
    console.error(error);
    alert(error instanceof Error ? error.message : "Failed to create delivery");
  } finally {
    setLoading(false);
  }
};

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
         
          padding: "32px 24px 64px",
          maxWidth: 680,
          margin: "0 auto",
        }}
      >
        {/* ── Header ── */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "var(--radius-md)",
                background: "var(--cyan-500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow-cyan)",
                flexShrink: 0,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--navy-900)"
                strokeWidth="2.5"
              >
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
            </div>

            <div>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-2xl)",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Your Cart
              </h1>

              {cart.length > 0 && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--text-sm)",
                    color: "var(--text-tertiary)",
                    marginTop: 2,
                  }}
                >
                  {cart.length} service{cart.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Empty State ── */}
        {cart.length === 0 ? (
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xl)",
              padding: "60px 32px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 48 }}>🛒</div>

            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-xl)",
                fontWeight: 700,
              }}
            >
              Cart is Empty
            </div>

            <p
              style={{
                margin: 0,
                fontSize: "var(--text-sm)",
                color: "var(--text-tertiary)",
                textAlign: "center",
              }}
            >
              Browse services and add them here to get started.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* ── Cart Items ── */}
            {cart.map((item) => (
              <div
                key={`${item.price._id}-${item.shop._id}`}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-xl)",
                  padding: "18px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                {/* Left */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "var(--radius-md)",
                      background: "var(--navy-800)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {item.price.picture ? (
                      <img
                        src={item.price.picture}
                        alt={item.price.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : item.price.icon ? (
                      <span style={{ fontSize: 22 }}>{item.price.icon}</span>
                    ) : (
                      item.price.name.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                      {item.price.name}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                      {item.shop?.name}
                    </div>
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 4 }}>
                      ₹{item.price.charge} × {item.quantity}
                    </div>
                  </div>
                </div>

                {/* Right */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() =>
                      updateCart(item.price._id, item.shop._id, item.quantity - 1)
                    }
                  >
                    −
                  </button>
                  <div>{item.quantity}</div>
                  <button
                    onClick={() =>
                      updateCart(item.price._id, item.shop._id, item.quantity + 1)
                    }
                  >
                    +
                  </button>
                  <button onClick={() => removeFromCart(item.price._id, item.shop._id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {/* ── Summary ── */}
            <div
              style={{
                marginTop: 12,
                background: "var(--navy-900)",
                borderRadius: "var(--radius-xl)",
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <span style={{ color: "#fff", fontWeight: 700 }}>Total</span>
                <span style={{ color: "var(--cyan-400)", fontWeight: 700, fontSize: 22 }}>
                  ₹{total.toFixed(2)}
                </span>
              </div>

              {/* Checkout Button → opens location picker */}
              <button
                onClick={() => setShowLocationPicker(true)}
                disabled={loading}
                className="btn btn-primary"
                style={{
                  width: "100%",
                  height: 50,
                  fontSize: "var(--text-base)",
                  fontWeight: 700,
                  borderRadius: "var(--radius-lg)",
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {loading ? (
                  "Creating Delivery…"
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                      <circle cx="12" cy="9" r="2.5"/>
                    </svg>
                    Proceed to Checkout
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Location Picker Modal ── */}
      {showLocationPicker && (
        <LocationPickerModal
          onConfirm={handleCheckout}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </>
  );
}