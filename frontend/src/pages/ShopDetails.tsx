import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../utils/auth";

// Leaflet CSS must be imported in your main CSS or index.html:
// <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
import L from "leaflet";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

// ── Types ──────────────────────────────────────────────────────────────────────
type Location = { type: "Point"; coordinates: [number, number] };
type Owner = {
  ownerId: string; name: string; username: string;
  email: string; phone: string | null;
  address: string | null; location: Location | null;
};
type ShopDetails = {
  shopId: string; name: string; address: string;
  location: Location | null; prices: unknown[];
  rating: number; ratingCount: number;
  totalOrders: number; avgDeliveryTime: number;
  owner: Owner | null;
};
type EditForm = { name: string; address: string };

// ── Star rating ────────────────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ fontSize: 14, color: rating >= s ? "#f59e0b" : "rgba(255,255,255,0.12)" }}>★</span>
      ))}
    </span>
  );
}

// ── Types for search results ───────────────────────────────────────────────────
type SearchResult = { display_name: string; lat: string; lon: string };

// ── Map Picker ─────────────────────────────────────────────────────────────────
function MapPicker({
  initialLat, initialLng,
  onLocationSelect,
}: {
  initialLat: number; initialLng: number;
  onLocationSelect: (lat: number, lng: number, address: string) => void;
}) {
  const mapRef       = useRef<HTMLDivElement>(null);
  const leafletMap   = useRef<L.Map | null>(null);
  const marker       = useRef<L.Marker | null>(null);
  const searchTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [geocoding,    setGeocoding]    = useState(false);
  const [pickedAddress, setPickedAddress] = useState<string>("");
  const [pickedCoords,  setPickedCoords]  = useState<{ lat: number; lng: number } | null>(null);

  // Search state
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searching,     setSearching]     = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults,   setShowResults]   = useState(false);

  // ── Reverse geocode ──────────────────────────────────────────────────────
  const reverseGeocode = async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { "Accept-Language": "en" } }
      );
      const json = await res.json();
      const addr = json.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setPickedAddress(addr);
      setPickedCoords({ lat, lng });
    } catch {
      setPickedAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setPickedCoords({ lat, lng });
    } finally {
      setGeocoding(false);
    }
  };

  // ── Forward geocode / search ─────────────────────────────────────────────
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); setShowResults(false); return; }

    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
          { headers: { "Accept-Language": "en" } }
        );
        const json: SearchResult[] = await res.json();
        setSearchResults(json);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400); // debounce 400ms
  };

  const handleResultClick = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    // Move map + marker
    if (leafletMap.current && marker.current) {
      leafletMap.current.setView([lat, lng], 16);
      marker.current.setLatLng([lat, lng]);
    }

    setPickedAddress(result.display_name);
    setPickedCoords({ lat, lng });
    setSearchQuery(result.display_name);
    setShowResults(false);
  };

  // ── Init Leaflet ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const map = L.map(mapRef.current).setView([initialLat, initialLng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    const m = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
    marker.current = m;

    reverseGeocode(initialLat, initialLng);

    m.on("dragend", () => {
      const pos = m.getLatLng();
      reverseGeocode(pos.lat, pos.lng);
    });

    map.on("click", (e: L.LeafletMouseEvent) => {
      m.setLatLng(e.latlng);
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    leafletMap.current = map;
    return () => { map.remove(); leafletMap.current = null; };
  }, []);

  const handleConfirm = () => {
    if (!pickedCoords) return;
    onLocationSelect(pickedCoords.lat, pickedCoords.lng, pickedAddress);
  };

  return (
    <div style={s.mapPickerWrap}>

      {/* ── Search bar (sits above the map) ─────────────────────────────── */}
      <div style={s.searchWrap}>
        <div style={s.searchInputWrap}>
          <span style={s.searchIcon}>🔍</span>
          <input
            style={s.searchInput}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            placeholder="Search for a place, street, city…"
          />
          {searching && <span style={{ ...s.miniSpinner, marginRight: 10 }} />}
          {searchQuery && !searching && (
            <button style={s.searchClearBtn}
              onClick={() => { setSearchQuery(""); setSearchResults([]); setShowResults(false); }}>
              ✕
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {showResults && searchResults.length > 0 && (
          <div style={s.searchDropdown}>
            {searchResults.map((r, i) => (
              <div
  key={i}
  style={{
    ...s.searchResultItem,
    borderBottom: i < searchResults.length - 1 ? "1px solid var(--border-subtle)" : "none",
  }}
  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,180,216,0.08)")}
  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
  onClick={() => handleResultClick(r)}
>
                <span style={s.searchResultIcon}>📍</span>
                <span style={s.searchResultText}>{r.display_name}</span>
              </div>
            ))}
          </div>
        )}

        {showResults && searchResults.length === 0 && !searching && searchQuery.length > 2 && (
          <div style={s.searchNoResults}>No results found for "{searchQuery}"</div>
        )}
      </div>

      {/* Map container */}
      <div ref={mapRef} style={s.mapContainer} />

      {/* Footer */}
      <div style={s.mapFooter}>
        <div style={s.mapCoordRow}>
          <div style={s.mapCoordChip}>
            <span style={s.mapCoordLabel}>LAT</span>
            <span style={s.mapCoordVal}>
              {pickedCoords ? pickedCoords.lat.toFixed(6) : initialLat.toFixed(6)}
            </span>
          </div>
          <div style={s.mapCoordChip}>
            <span style={s.mapCoordLabel}>LNG</span>
            <span style={s.mapCoordVal}>
              {pickedCoords ? pickedCoords.lng.toFixed(6) : initialLng.toFixed(6)}
            </span>
          </div>
          {geocoding && (
            <div style={s.geocodingChip}>
              <span style={s.miniSpinner} /> Locating…
            </div>
          )}
        </div>

        {pickedAddress && (
          <div style={s.pickedAddressRow}>
            <span style={s.pickedAddressIcon}>📍</span>
            <span style={s.pickedAddressText}>{pickedAddress}</span>
          </div>
        )}

        <div style={s.mapHint}>Search above · click on map · or drag the marker</div>

        <button
          style={{ ...s.confirmLocationBtn, opacity: (!pickedCoords || geocoding) ? 0.5 : 1 }}
          onClick={handleConfirm}
          disabled={!pickedCoords || geocoding}
        >
          ✅ Use This Location
        </button>
      </div>
    </div>
  );
}

// ── Delete Modal ───────────────────────────────────────────────────────────────
function DeleteModal({ shopName, onCancel, onConfirm, deleting }: {
  shopName: string; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={backdropRef} style={s.modalBackdrop}
      onClick={(e) => e.target === backdropRef.current && onCancel()}>
      <div style={s.modal}>
        <div style={s.modalGlow} />
        <div style={s.modalIcon}>🗑️</div>
        <h2 style={s.modalTitle}>Delete Shop?</h2>
        <p style={s.modalBody}>
          You're about to permanently delete{" "}
          <strong style={{ color: "var(--text-primary)" }}>{shopName}</strong>.
          This cannot be undone.
        </p>
        <div style={s.modalActions}>
          <button style={s.cancelBtn} onClick={onCancel} disabled={deleting}>Cancel</button>
          <button style={s.confirmDeleteBtn} onClick={onConfirm} disabled={deleting}>
            {deleting
              ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={s.miniSpinner} /> Deleting…</span>
              : "Yes, delete it"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ShopDetails() {
  const navigate = useNavigate();

  const [shop, setShop]       = useState<ShopDetails | null>(null);
  const [shopId, setShopId]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Edit state
  const [editing, setEditing]         = useState(false);
  const [form, setForm]               = useState<EditForm>({ name: "", address: "" });
  const [pickedLat, setPickedLat]     = useState<number | null>(null);
  const [pickedLng, setPickedLng]     = useState<number | null>(null);
  const [showMap, setShowMap]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]               = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${BASE_URL}/api/shop/details`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Failed to fetch shop");
        const d: ShopDetails = json.data;
        setShop(d);
        setShopId(d.shopId);
        setForm({ name: d.name, address: d.address });
        setPickedLat(d.location?.coordinates[1] ?? null);
        setPickedLng(d.location?.coordinates[0] ?? null);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCancel = () => {
    if (!shop) return;
    setForm({ name: shop.name, address: shop.address });
    setPickedLat(shop.location?.coordinates[1] ?? null);
    setPickedLng(shop.location?.coordinates[0] ?? null);
    setShowMap(false);
    setEditing(false);
    setSaveError(null);
  };

  // Called when user confirms a location on the map
  const handleLocationSelect = (lat: number, lng: number, address: string) => {
    setPickedLat(lat);
    setPickedLng(lng);
    setForm((prev) => ({ ...prev, address }));
    setShowMap(false);
  };

  const handleSave = async () => {
    if (!shopId || !shop) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      address: form.address.trim(),
    };

    if (pickedLat !== null && pickedLng !== null) {
      // Note: MongoDB GeoJSON coordinates are [longitude, latitude]
      body.location = { type: "Point", coordinates: [pickedLng, pickedLat] };
    }

    try {
      const res  = await fetch(`${BASE_URL}/api/shop/update/${shopId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Update failed");

      setShop((prev) =>
        prev ? {
          ...prev,
          name: json.data.name,
          address: json.data.address,
          location: json.data.location ?? prev.location,
        } : prev
      );
      setEditing(false);
      setShowMap(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!shopId) return;
    setDeleting(true);
    try {
      const res  = await fetch(`${BASE_URL}/api/shop/delete/${shopId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Delete failed");
      navigate("/", { replace: true });
    } catch (e: any) {
      setDeleting(false);
      setShowDeleteModal(false);
      setError(e.message);
    }
  };

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={s.centered}>
      <div style={s.spinner} />
      <span style={{ color: "var(--text-tertiary)", fontSize: 13, marginTop: 12 }}>Loading shop details…</span>
    </div>
  );

  if (error || !shop) return (
    <div style={s.centered}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
      <p style={{ color: "var(--color-danger)", fontSize: 14 }}>{error ?? "Shop not found."}</p>
    </div>
  );

  const coords = shop.location?.coordinates;

  // Default map center: use stored coords or Vijayawada as fallback
  const mapCenterLat = pickedLat ?? (coords ? coords[1] : 16.5062);
  const mapCenterLng = pickedLng ?? (coords ? coords[0] : 80.6480);

  return (
    <>
      {showDeleteModal && (
        <DeleteModal shopName={shop.name} onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDelete} deleting={deleting} />
      )}

      <div style={s.root}>

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div style={s.header}>
          <div style={s.headerGlow} />
          <div style={s.headerGlow2} />
          <div style={s.headerTop}>
            <div>
              <div style={s.shopBadge}>🏪 Shop Details</div>
              <h1 style={s.heroName}>{shop.name}</h1>
              <p style={s.heroAddress}>📍 {shop.address}</p>
            </div>
            <div style={s.ratingChip}>
              <StarRating rating={shop.rating} />
              <span style={s.ratingNum}>{shop.rating.toFixed(1)}</span>
              <span style={s.ratingCount}>({shop.ratingCount})</span>
            </div>
          </div>
          <div style={s.kpiStrip}>
            {[
              { icon: "📋", val: shop.totalOrders ?? 0,      lbl: "Total Orders" },
              { icon: "⏱️", val: `${shop.avgDeliveryTime ?? 0}m`, lbl: "Avg Delivery" },
              { icon: "💰", val: shop.prices.length,          lbl: "Price Listings" },
              { icon: "⭐", val: shop.rating.toFixed(1),      lbl: "Rating" },
            ].map((k, i) => (
              <div key={i} style={{ ...s.kpiItem, borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                <span style={s.kpiIcon}>{k.icon}</span>
                <span style={s.kpiVal}>{k.val}</span>
                <span style={s.kpiLbl}>{k.lbl}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── SHOP INFORMATION CARD ───────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <div style={s.cardTitle}>Shop Information</div>
              <div style={s.cardSubtitle}>
                {editing ? "Edit details and pick location on map" : "Click Edit to modify shop details"}
              </div>
            </div>
            {!editing ? (
              <button style={s.editBtn} onClick={() => setEditing(true)}>✏️ Edit Details</button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <button style={s.cancelBtn2} onClick={handleCancel} disabled={saving}>Cancel</button>
                <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving
                    ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={s.miniSpinner} /> Saving…</span>
                    : "💾 Save Changes"}
                </button>
              </div>
            )}
          </div>

          {saveSuccess && <div style={s.successBanner}>✅ Shop updated successfully</div>}
          {saveError   && <div style={s.errorBanner}>⚠️ {saveError}</div>}

          {/* Name field */}
          <div style={s.fieldsGrid}>
            <div style={s.fieldWrap}>
              <div style={s.fieldLabel}><span style={s.fieldIcon}>🏪</span>Shop Name</div>
              {editing ? (
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Enter shop name" style={s.input} autoFocus />
              ) : (
                <div style={s.fieldValue}>{form.name}</div>
              )}
            </div>

            {/* Address — read-only hint when editing (auto-filled from map) */}
            <div style={s.fieldWrap}>
              <div style={s.fieldLabel}><span style={s.fieldIcon}>📍</span>Address</div>
              {editing ? (
                <div style={s.addressEditWrap}>
                  <input value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Select on map or type manually"
                    style={s.input} />
                  <div style={s.addressHint}>Auto-filled when you pick from map</div>
                </div>
              ) : (
                <div style={s.fieldValue}>{form.address || <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Not set</span>}</div>
              )}
            </div>
          </div>

          {/* ── LOCATION SECTION ──────────────────────────────────────────── */}
          <div style={s.sectionDivider}>
            <span style={s.dividerLabel}>📡 Location</span>
            <div style={s.dividerLine} />
          </div>

          {/* Current coordinates chips */}
          <div style={s.coordsRow}>
            <div style={s.coordChip}>
              <span style={s.coordChipLabel}>LAT</span>
              <span style={s.coordChipVal}>
                {pickedLat !== null ? pickedLat.toFixed(6) : "—"}
              </span>
            </div>
            <div style={s.coordChip}>
              <span style={s.coordChipLabel}>LNG</span>
              <span style={s.coordChipVal}>
                {pickedLng !== null ? pickedLng.toFixed(6) : "—"}
              </span>
            </div>

            {editing && !showMap && (
              <button style={s.openMapBtn} onClick={() => setShowMap(true)}>
                🗺️ {pickedLat ? "Change Location" : "Pick Location on Map"}
              </button>
            )}

            {!editing && coords && (
              <a href={`https://maps.google.com/?q=${coords[1]},${coords[0]}`}
                target="_blank" rel="noreferrer" style={s.mapLink}>
                🗺️ View on Google Maps ↗
              </a>
            )}
          </div>

          {/* ── MAP PICKER (shown only when editing and toggled) ───────────── */}
          {editing && showMap && (
            <div style={s.mapSection}>
              <div style={s.mapSectionHeader}>
                <span style={s.mapSectionTitle}>📍 Pick Location</span>
                <button style={s.closeMapBtn} onClick={() => setShowMap(false)}>✕ Close Map</button>
              </div>
              <MapPicker
                initialLat={mapCenterLat}
                initialLng={mapCenterLng}
                onLocationSelect={handleLocationSelect}
              />
            </div>
          )}
        </div>

        {/* ── PERFORMANCE METRICS ─────────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <div style={s.cardTitle}>Performance Metrics</div>
              <div style={s.cardSubtitle}>Read-only — updated automatically</div>
            </div>
            <div style={s.readOnlyBadge}>🔒 Read only</div>
          </div>
          <div style={s.metricsGrid}>
            {[
              { icon: "⭐", label: "Rating",            value: shop.rating.toFixed(1),          sub: `from ${shop.ratingCount} reviews`, color: "#f59e0b" },
              { icon: "📋", label: "Total Orders",      value: shop.totalOrders ?? 0,            sub: "all time",    color: "var(--cyan-500)" },
              { icon: "⏱️", label: "Avg Delivery Time", value: `${shop.avgDeliveryTime ?? 0} min`, sub: "per order",  color: "#8b5cf6" },
              { icon: "💰", label: "Price Listings",    value: shop.prices.length,               sub: "active",      color: "#10b981" },
            ].map((m) => (
              <div key={m.label} style={s.metricCard}>
                <div style={{ fontSize: 22 }}>{m.icon}</div>
                <div style={{ ...s.metricVal, color: m.color }}>{m.value}</div>
                <div style={s.metricLabel}>{m.label}</div>
                <div style={s.metricSub}>{m.sub}</div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: m.color, borderRadius: "0 0 10px 10px", opacity: 0.7 }} />
              </div>
            ))}
          </div>
        </div>

        {/* ── OWNER CARD ──────────────────────────────────────────────────── */}
        {shop.owner && (
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div>
                <div style={s.cardTitle}>Shop Owner</div>
                <div style={s.cardSubtitle}>Account linked to this shop</div>
              </div>
              <div style={s.readOnlyBadge}>🔒 Read only</div>
            </div>
            <div style={s.ownerRow}>
              <div style={s.avatar}>{shop.owner.name.charAt(0).toUpperCase()}</div>
              <div style={s.ownerInfo}>
                <div style={s.ownerName}>{shop.owner.name}</div>
                <div style={s.ownerUsername}>@{shop.owner.username}</div>
              </div>
            </div>
            <div style={s.ownerDetailsGrid}>
              {[
                { icon: "📧", label: "Email",       val: shop.owner.email },
                { icon: "📞", label: "Phone",       val: shop.owner.phone ?? "—" },
                { icon: "🏠", label: "Address",     val: shop.owner.address ?? "—" },
                {
                  icon: "📡", label: "Coordinates",
                  val: shop.owner.location?.coordinates
                    ? `${shop.owner.location.coordinates[1].toFixed(5)}, ${shop.owner.location.coordinates[0].toFixed(5)}`
                    : "—",
                },
              ].map((d) => (
                <div key={d.label} style={s.ownerDetail}>
                  <span style={s.ownerDetailIcon}>{d.icon}</span>
                  <div>
                    <div style={s.ownerDetailLabel}>{d.label}</div>
                    <div style={s.ownerDetailVal}>{d.val}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DANGER ZONE ─────────────────────────────────────────────────── */}
        <div style={s.dangerCard}>
          <div style={s.dangerGlow} />
          <div style={s.dangerInner}>
            <div>
              <div style={s.dangerTitle}>⚠️ Danger Zone</div>
              <div style={s.dangerBody}>
                Permanently delete <strong>{shop.name}</strong> and all its associated data. This action is irreversible.
              </div>
            </div>
            <button style={s.deleteBtn} onClick={() => setShowDeleteModal(true)}>🗑️ Delete Shop</button>
          </div>
        </div>

      </div>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root:    { width: "100%", fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column", gap: "var(--space-3)" },
  centered: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 340 },
  spinner: { width: 36, height: 36, border: "3px solid rgba(0,180,216,0.15)", borderTop: "3px solid var(--cyan-500)", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  miniSpinner: { display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.25)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" },

  // Header
  header:      { background: "var(--navy-900)", borderRadius: "var(--radius-lg)", padding: "28px 32px 24px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", gap: "var(--space-5)" },
  headerGlow:  { position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,180,216,0.18) 0%, transparent 70%)", pointerEvents: "none" },
  headerGlow2: { position: "absolute", bottom: -80, left: 80, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)", pointerEvents: "none" },
  headerTop:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" },
  shopBadge:   { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,180,216,0.12)", border: "1px solid rgba(0,180,216,0.25)", borderRadius: "var(--radius-full)", padding: "3px 12px", fontSize: "var(--text-xs)", fontWeight: "var(--weight-bold)" as any, color: "var(--cyan-400)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 },
  heroName:    { fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: "var(--weight-bold)" as any, color: "var(--text-inverse)", margin: "0 0 6px", lineHeight: 1.1 },
  heroAddress: { fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.38)", margin: 0 },
  ratingChip:  { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-md)", padding: "10px 16px" },
  ratingNum:   { fontSize: "var(--text-xl)", fontWeight: "var(--weight-bold)" as any, color: "#f59e0b", lineHeight: 1 },
  ratingCount: { fontSize: "var(--text-xs)", color: "rgba(255,255,255,0.3)" },
  kpiStrip:    { display: "flex", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "var(--radius-md)", position: "relative" },
  kpiItem:     { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 8px", gap: 3 },
  kpiIcon:     { fontSize: 16 },
  kpiVal:      { fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: "var(--weight-bold)" as any, color: "var(--text-inverse)", lineHeight: 1 },
  kpiLbl:      { fontSize: "var(--text-xs)", color: "rgba(255,255,255,0.32)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "var(--weight-semibold)" as any },

  // Card
  card:        { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "var(--space-6)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "var(--space-5)" },
  cardHeader:  { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" },
  cardTitle:   { fontSize: "var(--text-base)", fontWeight: "var(--weight-bold)" as any, color: "var(--text-primary)" },
  cardSubtitle: { fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 },

  // Buttons
  editBtn:     { display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(0,180,216,0.12)", border: "1px solid rgba(0,180,216,0.3)", borderRadius: "var(--radius-md)", color: "var(--cyan-400)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)" as any, fontFamily: "var(--font-sans)", padding: "8px 18px", cursor: "pointer", whiteSpace: "nowrap" },
  saveBtn:     { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--cyan-500)", border: "none", borderRadius: "var(--radius-md)", color: "#0a1628", fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)" as any, fontFamily: "var(--font-sans)", padding: "9px 22px", cursor: "pointer", whiteSpace: "nowrap" },
  cancelBtn2:  { background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" as any, fontFamily: "var(--font-sans)", padding: "9px 18px", cursor: "pointer" },
  readOnlyBadge: { display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-full)", padding: "4px 12px", fontSize: "var(--text-xs)", color: "var(--text-tertiary)", whiteSpace: "nowrap" },
  openMapBtn:  { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "var(--radius-md)", color: "#a78bfa", fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)" as any, fontFamily: "var(--font-sans)", padding: "7px 14px", cursor: "pointer", whiteSpace: "nowrap" },
  closeMapBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)" as any, fontFamily: "var(--font-sans)", padding: "6px 12px", cursor: "pointer" },
  confirmLocationBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--cyan-500)", border: "none", borderRadius: "var(--radius-md)", color: "#0a1628", fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)" as any, fontFamily: "var(--font-sans)", padding: "10px", cursor: "pointer", width: "100%", marginTop: "var(--space-3)" },

  // Banners
  successBanner: { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "var(--radius-md)", padding: "10px 16px", fontSize: "var(--text-sm)", color: "#10b981", fontWeight: "var(--weight-medium)" as any },
  errorBanner:   { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-md)", padding: "10px 16px", fontSize: "var(--text-sm)", color: "#f87171", fontWeight: "var(--weight-medium)" as any },

  // Fields
  fieldsGrid:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" },
  fieldWrap:    { display: "flex", flexDirection: "column", gap: 7 },
  fieldLabel:   { fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)" as any, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 5 },
  fieldIcon:    { fontSize: 13 },
  fieldValue:   { fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: "var(--weight-medium)" as any, background: "var(--bg-inset)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "10px 14px", minHeight: 42, display: "flex", alignItems: "center" },
  input:        { fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: "var(--weight-medium)" as any, fontFamily: "var(--font-sans)", background: "rgba(0,180,216,0.06)", border: "1.5px solid rgba(0,180,216,0.35)", borderRadius: "var(--radius-md)", padding: "10px 14px", outline: "none", width: "100%", boxSizing: "border-box" },
  addressEditWrap: { display: "flex", flexDirection: "column", gap: 5 },
  addressHint:  { fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontStyle: "italic" },

  // Coords row
  sectionDivider: { display: "flex", alignItems: "center", gap: "var(--space-3)" },
  dividerLabel:   { fontSize: "var(--text-xs)", fontWeight: "var(--weight-bold)" as any, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" },
  dividerLine:    { flex: 1, height: 1, background: "var(--border-subtle)" },
  coordsRow:      { display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" as any },
  coordChip:      { display: "flex", alignItems: "center", gap: 8, background: "var(--bg-inset)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "8px 14px" },
  coordChipLabel: { fontSize: "var(--text-xs)", fontWeight: "var(--weight-bold)" as any, color: "var(--cyan-400)", letterSpacing: "0.08em" },
  coordChipVal:   { fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" as any, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" },
  mapLink:        { display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--cyan-400)", textDecoration: "none", fontWeight: "var(--weight-semibold)" as any, border: "1px solid rgba(0,180,216,0.2)", borderRadius: "var(--radius-full)", padding: "5px 14px" },

  // Map section
  mapSection:       { display: "flex", flexDirection: "column", gap: "var(--space-3)", background: "var(--bg-inset)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  mapSectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)" },
  mapSectionTitle:  { fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)" as any, color: "var(--text-primary)" },

  // Map picker
  mapPickerWrap:  { display: "flex", flexDirection: "column" },
  mapContainer:   { height: 340, width: "100%", zIndex: 1 },
  mapFooter:      { padding: "14px 16px", display: "flex", flexDirection: "column", gap: "var(--space-2)" },
  mapCoordRow:    { display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" as any },
  mapCoordChip:   { display: "flex", alignItems: "center", gap: 6, background: "rgba(0,180,216,0.08)", border: "1px solid rgba(0,180,216,0.2)", borderRadius: "var(--radius-md)", padding: "5px 12px" },
  mapCoordLabel:  { fontSize: "var(--text-xs)", fontWeight: "var(--weight-bold)" as any, color: "var(--cyan-400)", letterSpacing: "0.08em" },
  mapCoordVal:    { fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" as any, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" },
  geocodingChip:  { display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" },
  pickedAddressRow: { display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(0,180,216,0.06)", border: "1px solid rgba(0,180,216,0.15)", borderRadius: "var(--radius-md)", padding: "8px 12px" },
  pickedAddressIcon: { fontSize: 14, flexShrink: 0, marginTop: 1 },
  pickedAddressText: { fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 },
  mapHint:        { fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontStyle: "italic" },

  // Metrics
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-3)" },
  metricCard:  { background: "var(--bg-inset)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: 4, position: "relative", overflow: "hidden" },
  metricVal:   { fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: "var(--weight-bold)" as any, lineHeight: 1, marginTop: "var(--space-2)" },
  metricLabel: { fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)" as any, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-tertiary)", marginTop: 2 },
  metricSub:   { fontSize: "var(--text-xs)", color: "var(--text-tertiary)", opacity: 0.6 },

  // Owner
  ownerRow:         { display: "flex", alignItems: "center", gap: "var(--space-4)" },
  avatar:           { width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, var(--cyan-500), #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: "var(--weight-bold)" as any, color: "#fff", flexShrink: 0, boxShadow: "0 0 0 3px rgba(0,180,216,0.2)" },
  ownerInfo:        { display: "flex", flexDirection: "column", gap: 3 },
  ownerName:        { fontSize: "var(--text-base)", fontWeight: "var(--weight-bold)" as any, color: "var(--text-primary)" },
  ownerUsername:    { fontSize: "var(--text-sm)", color: "var(--cyan-400)", fontWeight: "var(--weight-medium)" as any },
  ownerDetailsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" },
  ownerDetail:      { display: "flex", alignItems: "flex-start", gap: 10, background: "var(--bg-inset)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "12px 14px" },
  ownerDetailIcon:  { fontSize: 16, flexShrink: 0, marginTop: 1 },
  ownerDetailLabel: { fontSize: "var(--text-xs)", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "var(--weight-semibold)" as any, marginBottom: 3 },
  ownerDetailVal:   { fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: "var(--weight-medium)" as any, wordBreak: "break-all" },

  // Danger
  dangerCard:  { background: "rgba(239,68,68)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius-lg)", padding: "var(--space-5) var(--space-6)", position: "relative", overflow: "hidden" },
  dangerGlow:  { position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)", pointerEvents: "none" },
  dangerInner: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)", position: "relative" },
  dangerTitle: { fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)" as any, color: "white", marginBottom: 4, letterSpacing: "0.03em" },
  dangerBody:  { fontSize: "var(--text-xs)", color: "white", lineHeight: 1.5, maxWidth: 480 },
  deleteBtn:   { display: "inline-flex", alignItems: "center", gap: 8, background: "white", border: "1px solid white", borderRadius: "var(--radius-md)", color: "rgba(239,68,68)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)" as any, fontFamily: "var(--font-sans)", padding: "10px 22px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 },

  // Modal
  modalBackdrop:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--space-4)" },
  modal:            { background: "var(--bg-surface)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-xl)", padding: "var(--space-8)", width: "100%", maxWidth: 420, position: "relative", overflow: "hidden", textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" },
  modalGlow:        { position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)", pointerEvents: "none" },
  modalIcon:        { fontSize: 44, lineHeight: 1, position: "relative" },
  modalTitle:       { fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: "var(--weight-bold)" as any, color: "var(--text-primary)", margin: 0, position: "relative" },
  modalBody:        { fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6, position: "relative", margin: 0 },
  modalActions:     { display: "flex", gap: 12, marginTop: "var(--space-2)", width: "100%", position: "relative" },
  cancelBtn:        { flex: 1, background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)" as any, fontFamily: "var(--font-sans)", padding: "11px 0", cursor: "pointer" },
  confirmDeleteBtn: { flex: 1, background: "rgba(239,68,68,0.9)", border: "none", borderRadius: "var(--radius-md)", color: "#fff", fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)" as any, fontFamily: "var(--font-sans)", padding: "11px 0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },

  // ── Map Search bar ──────────────────────────────────────────────────────────
searchWrap: {
  position: "relative" as const,
  zIndex: 10,
  padding: "10px 12px 0",
},
searchInputWrap: {
  display: "flex",
  alignItems: "center",
  background: "var(--bg-surface)",
  border: "1.5px solid rgba(0,180,216,0.35)",
  borderRadius: "var(--radius-md)",
  padding: "0 10px",
  gap: 6,
  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
},
searchIcon: {
  fontSize: 14,
  flexShrink: 0,
  color: "var(--text-tertiary)",
},
searchInput: {
  flex: 1,
  background: "transparent",
  border: "none",
  outline: "none",
  fontSize: "var(--text-sm)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-sans)",
  padding: "10px 0",
  minWidth: 0,
},
searchClearBtn: {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "var(--text-tertiary)",
  fontSize: 13,
  padding: "2px 4px",
  lineHeight: 1,
  flexShrink: 0,
},
searchDropdown: {
  position: "absolute" as const,
  top: "calc(100% + 4px)",
  left: 12,
  right: 12,
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  zIndex: 9999,
  overflow: "hidden",
  maxHeight: 260,
  overflowY: "auto" as const,
},
searchResultItem: {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "10px 14px",
  cursor: "pointer",
  transition: "background 0.12s",
  background: "transparent",
},
searchResultItemHover: {
  background: "rgba(0,180,216,0.08)",
},
searchResultIcon: {
  fontSize: 13,
  flexShrink: 0,
  marginTop: 1,
  color: "var(--cyan-400)",
},
searchResultText: {
  fontSize: "var(--text-xs)",
  color: "var(--text-secondary)",
  lineHeight: 1.5,
},
searchNoResults: {
  position: "absolute" as const,
  top: "calc(100% + 4px)",
  left: 12,
  right: 12,
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  padding: "12px 14px",
  fontSize: "var(--text-xs)",
  color: "var(--text-tertiary)",
  fontStyle: "italic",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  zIndex: 9999,
},
};