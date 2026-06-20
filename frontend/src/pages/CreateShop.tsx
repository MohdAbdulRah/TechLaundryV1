import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../utils/auth";

import L from "leaflet";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

type SearchResult = { display_name: string; lat: string; lon: string };
type CreateForm   = { name: string; address: string };

interface CreateShopProps {
  /** Called after a shop is successfully created. When provided, internal
   *  navigation is skipped and the parent handles routing. */
  onCreated?: () => void;
}

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: 1 | 2 }) {
  const steps = [
    { n: 1, label: "Shop Info" },
    { n: 2, label: "Location" },
  ];
  return (
    <div style={s.stepRow}>
      {steps.map((step, i) => {
        const done   = current > step.n;
        const active = current === step.n;
        return (
          <div key={step.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                ...s.stepCircle,
                background: done
                  ? "var(--cyan-500)"
                  : active
                    ? "rgba(0,180,216,0.18)"
                    : "rgba(255,255,255,0.05)",
                border: done
                  ? "2px solid var(--cyan-500)"
                  : active
                    ? "2px solid rgba(0,180,216,0.7)"
                    : "2px solid rgba(255,255,255,0.1)",
                color: done ? "#0a1628" : active ? "var(--cyan-400)" : "rgba(255,255,255,0.25)",
              }}>
                {done ? "✓" : step.n}
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase" as const,
                color: active ? "var(--cyan-400)" : done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
              }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: 80,
                height: 2,
                background: done ? "var(--cyan-500)" : "rgba(255,255,255,0.08)",
                marginBottom: 22,
                transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Map Picker ─────────────────────────────────────────────────────────────────
function MapPicker({
  initialLat, initialLng, onLocationSelect,
}: {
  initialLat: number; initialLng: number;
  onLocationSelect: (lat: number, lng: number, address: string) => void;
}) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const leafletMap  = useRef<L.Map | null>(null);
  const marker      = useRef<L.Marker | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [geocoding,     setGeocoding]     = useState(false);
  const [pickedAddress, setPickedAddress] = useState<string>("");
  const [pickedCoords,  setPickedCoords]  = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searching,     setSearching]     = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults,   setShowResults]   = useState(false);

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
    }, 400);
  };

  const handleResultClick = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (leafletMap.current && marker.current) {
      leafletMap.current.setView([lat, lng], 16);
      marker.current.setLatLng([lat, lng]);
    }
    setPickedAddress(result.display_name);
    setPickedCoords({ lat, lng });
    setSearchQuery(result.display_name);
    setShowResults(false);
  };

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
    m.on("dragend", () => { const pos = m.getLatLng(); reverseGeocode(pos.lat, pos.lng); });
    map.on("click", (e: L.LeafletMouseEvent) => { m.setLatLng(e.latlng); reverseGeocode(e.latlng.lat, e.latlng.lng); });
    leafletMap.current = map;
    return () => { map.remove(); leafletMap.current = null; };
  }, []);

  return (
    <div style={s.mapPickerWrap}>
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
        {showResults && searchResults.length > 0 && (
          <div style={s.searchDropdown}>
            {searchResults.map((r, i) => (
              <div
                key={i}
                style={{ ...s.searchResultItem, borderBottom: i < searchResults.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
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
      <div ref={mapRef} style={s.mapContainer} />
      <div style={s.mapFooter}>
        <div style={s.mapCoordRow}>
          <div style={s.mapCoordChip}>
            <span style={s.mapCoordLabel}>LAT</span>
            <span style={s.mapCoordVal}>{pickedCoords ? pickedCoords.lat.toFixed(6) : initialLat.toFixed(6)}</span>
          </div>
          <div style={s.mapCoordChip}>
            <span style={s.mapCoordLabel}>LNG</span>
            <span style={s.mapCoordVal}>{pickedCoords ? pickedCoords.lng.toFixed(6) : initialLng.toFixed(6)}</span>
          </div>
          {geocoding && (
            <div style={s.geocodingChip}><span style={s.miniSpinner} /> Locating…</div>
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
          onClick={() => pickedCoords && onLocationSelect(pickedCoords.lat, pickedCoords.lng, pickedAddress)}
          disabled={!pickedCoords || geocoding}
        >
          ✅ Confirm This Location
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CreateShop({ onCreated }: CreateShopProps) {
  const navigate = useNavigate();

  const [step,  setStep]  = useState<1 | 2>(1);
  const [form,  setForm]  = useState<CreateForm>({ name: "", address: "" });
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const DEFAULT_LAT = 16.5062;
  const DEFAULT_LNG = 80.6480;

  const handleLocationSelect = (lat: number, lng: number, address: string) => {
    setPickedLat(lat);
    setPickedLng(lng);
    setForm((prev) => ({ ...prev, address }));
    setLocationConfirmed(true);
  };

  const handleNext = () => {
    const trimmed = form.name.trim();
    if (!trimmed) { setNameError("Shop name is required"); return; }
    if (trimmed.length < 2) { setNameError("Name must be at least 2 characters"); return; }
    setNameError(null);
    setStep(2);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError(null);

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      address: form.address.trim(),
    };
    if (pickedLat !== null && pickedLng !== null) {
      body.location = { type: "Point", coordinates: [pickedLng, pickedLat] };
    }

    try {
      const res  = await fetch(`${BASE_URL}/api/shop/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to create shop");

      // If a parent gave us a callback, let it handle routing.
      // Otherwise navigate ourselves (standalone usage).
      if (onCreated) {
        onCreated();
      } else {
        navigate("/shop-dashboard", { replace: true });
      }
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.root}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div style={s.header}>
        <div style={s.headerGlow} />
        <div style={s.headerGlow2} />
        <div style={s.headerTop}>
          <div>
            <div style={s.shopBadge}>🏪 New Shop</div>
            <h1 style={s.heroName}>Create Your Shop</h1>
            <p style={s.heroSubtitle}>Set up your shop in just two quick steps</p>
          </div>
          {/* Only show "Go Back" when used standalone (no onCreated prop) */}
          {!onCreated && (
            <button style={s.backBtn} onClick={() => navigate(-1)}>← Go Back</button>
          )}
        </div>
        <StepIndicator current={step} />
      </div>

      {/* ── STEP 1 — SHOP INFO ────────────────────────────────────────────── */}
      {step === 1 && (
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <div style={s.cardTitle}>Shop Information</div>
              <div style={s.cardSubtitle}>Give your shop a name and optional address</div>
            </div>
            <div style={s.stepBadge}>Step 1 of 2</div>
          </div>

          <div style={s.fieldWrap}>
            <div style={s.fieldLabel}>
              <span style={s.fieldIcon}>🏪</span>
              Shop Name <span style={s.required}>*</span>
            </div>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setNameError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              placeholder="e.g. Fresh Mart, City Grocers…"
              style={{ ...s.input, ...(nameError ? s.inputError : {}) }}
            />
            {nameError && <div style={s.fieldError}>⚠️ {nameError}</div>}
          </div>

          <div style={s.fieldWrap}>
            <div style={s.fieldLabel}>
              <span style={s.fieldIcon}>📍</span>
              Address <span style={s.optional}>(optional — or pick on map in next step)</span>
            </div>
            <input
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Street, area, city…"
              style={s.input}
            />
          </div>

          <div style={s.infoBanner}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span>You'll pin your shop's exact location on a map in the next step.</span>
          </div>

          <div style={s.actionRow}>
            <div />
            <button style={s.nextBtn} onClick={handleNext}>Next — Pick Location →</button>
          </div>
        </div>
      )}

      {/* ── STEP 2 — LOCATION ─────────────────────────────────────────────── */}
      {step === 2 && (
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <div style={s.cardTitle}>Pin Your Location</div>
              <div style={s.cardSubtitle}>Search, click on the map, or drag the marker</div>
            </div>
            <div style={s.stepBadge}>Step 2 of 2</div>
          </div>

          <div style={s.shopPreviewRow}>
            <div style={s.shopPreviewIcon}>🏪</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={s.shopPreviewName}>{form.name}</div>
              <div style={s.shopPreviewAddr}>
                {form.address || <span style={{ fontStyle: "italic", opacity: 0.5 }}>No address yet — pick from map</span>}
              </div>
            </div>
            {locationConfirmed && <div style={s.confirmedBadge}>✅ Location set</div>}
          </div>

          {(pickedLat !== null || pickedLng !== null) && (
            <div style={s.coordsRow}>
              <div style={s.coordChip}>
                <span style={s.coordChipLabel}>LAT</span>
                <span style={s.coordChipVal}>{pickedLat?.toFixed(6) ?? "—"}</span>
              </div>
              <div style={s.coordChip}>
                <span style={s.coordChipLabel}>LNG</span>
                <span style={s.coordChipVal}>{pickedLng?.toFixed(6) ?? "—"}</span>
              </div>
            </div>
          )}

          <div style={s.mapSection}>
            <MapPicker
              initialLat={pickedLat ?? DEFAULT_LAT}
              initialLng={pickedLng ?? DEFAULT_LNG}
              onLocationSelect={handleLocationSelect}
            />
          </div>

          {saveError && <div style={s.errorBanner}>⚠️ {saveError}</div>}

          <div style={s.actionRow}>
            <button style={s.backStepBtn} onClick={() => { setStep(1); setSaveError(null); }} disabled={saving}>
              ← Back
            </button>
            <button
              style={{ ...s.createBtn, opacity: saving ? 0.7 : 1 }}
              onClick={handleCreate}
              disabled={saving}
            >
              {saving
                ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={s.miniSpinner} /> Creating…</span>
                : "🚀 Create Shop"}
            </button>
          </div>

          {!locationConfirmed && (
            <div style={s.skipHint}>
              No location? That's fine — you can skip and add it later from shop settings.
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root:      { width: "100%", fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column", gap: "var(--space-3)" },

  header:      { background: "var(--navy-900)", borderRadius: "var(--radius-lg)", padding: "28px 32px 28px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", gap: "var(--space-5)" },
  headerGlow:  { position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,180,216,0.18) 0%, transparent 70%)", pointerEvents: "none" },
  headerGlow2: { position: "absolute", bottom: -80, left: 80, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)", pointerEvents: "none" },
  headerTop:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" },
  shopBadge:   { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,180,216,0.12)", border: "1px solid rgba(0,180,216,0.25)", borderRadius: "var(--radius-full)", padding: "3px 12px", fontSize: "var(--text-xs)", fontWeight: "var(--weight-bold)" as any, color: "var(--cyan-400)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 },
  heroName:    { fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: "var(--weight-bold)" as any, color: "var(--text-inverse)", margin: "0 0 6px", lineHeight: 1.1 },
  heroSubtitle: { fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.38)", margin: 0 },
  backBtn:     { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "var(--radius-md)", color: "rgba(255,255,255,0.5)", fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)" as any, fontFamily: "var(--font-sans)", padding: "8px 16px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 },

  stepRow:    { display: "flex", alignItems: "flex-start", position: "relative" },
  stepCircle: { width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: "var(--weight-bold)" as any, transition: "all 0.3s" },

  card:        { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "var(--space-6)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "var(--space-5)" },
  cardHeader:  { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" },
  cardTitle:   { fontSize: "var(--text-base)", fontWeight: "var(--weight-bold)" as any, color: "var(--text-primary)" },
  cardSubtitle: { fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 },
  stepBadge:   { display: "inline-flex", alignItems: "center", background: "rgba(0,180,216,0.08)", border: "1px solid rgba(0,180,216,0.2)", borderRadius: "var(--radius-full)", padding: "4px 12px", fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)" as any, color: "var(--cyan-400)", whiteSpace: "nowrap" },

  fieldWrap:   { display: "flex", flexDirection: "column", gap: 7 },
  fieldLabel:  { fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)" as any, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 5 },
  fieldIcon:   { fontSize: 13 },
  required:    { color: "#f87171", fontWeight: "var(--weight-bold)" as any },
  optional:    { fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontStyle: "italic", textTransform: "none", letterSpacing: 0, fontWeight: "normal" as any, marginLeft: 2 },
  input:       { fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: "var(--weight-medium)" as any, fontFamily: "var(--font-sans)", background: "rgba(0,180,216,0.06)", border: "1.5px solid rgba(0,180,216,0.25)", borderRadius: "var(--radius-md)", padding: "11px 14px", outline: "none", width: "100%", boxSizing: "border-box" },
  inputError:  { border: "1.5px solid rgba(239,68,68,0.5)", background: "rgba(239,68,68,0.04)" },
  fieldError:  { fontSize: "var(--text-xs)", color: "#f87171", fontWeight: "var(--weight-medium)" as any },

  infoBanner:  { display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(0,180,216,0.06)", border: "1px solid rgba(0,180,216,0.15)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.6 },
  errorBanner: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-md)", padding: "10px 16px", fontSize: "var(--text-sm)", color: "#f87171", fontWeight: "var(--weight-medium)" as any },
  skipHint:    { fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontStyle: "italic", textAlign: "center" as const },

  actionRow:   { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginTop: "var(--space-2)" },
  nextBtn:     { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--cyan-500)", border: "none", borderRadius: "var(--radius-md)", color: "#0a1628", fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)" as any, fontFamily: "var(--font-sans)", padding: "11px 26px", cursor: "pointer", whiteSpace: "nowrap" },
  createBtn:   { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--cyan-500)", border: "none", borderRadius: "var(--radius-md)", color: "#0a1628", fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)" as any, fontFamily: "var(--font-sans)", padding: "11px 28px", cursor: "pointer", whiteSpace: "nowrap" },
  backStepBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" as any, fontFamily: "var(--font-sans)", padding: "11px 20px", cursor: "pointer" },

  shopPreviewRow:  { display: "flex", alignItems: "center", gap: 14, background: "var(--bg-inset)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "12px 16px" },
  shopPreviewIcon: { fontSize: 22, flexShrink: 0 },
  shopPreviewName: { fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)" as any, color: "var(--text-primary)" },
  shopPreviewAddr: { fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 },
  confirmedBadge:  { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "var(--radius-full)", padding: "4px 12px", fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)" as any, color: "#10b981", whiteSpace: "nowrap", flexShrink: 0 },

  coordsRow:      { display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" as any },
  coordChip:      { display: "flex", alignItems: "center", gap: 8, background: "var(--bg-inset)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "8px 14px" },
  coordChipLabel: { fontSize: "var(--text-xs)", fontWeight: "var(--weight-bold)" as any, color: "var(--cyan-400)", letterSpacing: "0.08em" },
  coordChipVal:   { fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" as any, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" },

  mapSection:   { border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" },

  mapPickerWrap:    { display: "flex", flexDirection: "column" },
  searchWrap:       { position: "relative", zIndex: 10, padding: "10px 12px 0" },
  searchInputWrap:  { display: "flex", alignItems: "center", background: "var(--bg-surface)", border: "1.5px solid rgba(0,180,216,0.35)", borderRadius: "var(--radius-md)", padding: "0 10px", gap: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.18)" },
  searchIcon:       { fontSize: 14, flexShrink: 0 },
  searchInput:      { flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "var(--text-sm)", color: "var(--text-primary)", fontFamily: "var(--font-sans)", padding: "10px 0", minWidth: 0 },
  searchClearBtn:   { background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 13, padding: "2px 4px", lineHeight: 1, flexShrink: 0 },
  searchDropdown:   { position: "absolute", top: "calc(100% + 4px)", left: 12, right: 12, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", boxShadow: "0 8px 24px rgba(0,0,0,0.35)", zIndex: 9999, overflow: "hidden", maxHeight: 260, overflowY: "auto" },
  searchResultItem: { display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", cursor: "pointer", background: "transparent" },
  searchResultIcon: { fontSize: 13, flexShrink: 0, marginTop: 1 },
  searchResultText: { fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 },
  searchNoResults:  { position: "absolute", top: "calc(100% + 4px)", left: 12, right: 12, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "12px 14px", fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontStyle: "italic", boxShadow: "0 8px 24px rgba(0,0,0,0.35)", zIndex: 9999 },
  mapContainer:     { height: 340, width: "100%", zIndex: 1 },
  mapFooter:        { padding: "14px 16px", display: "flex", flexDirection: "column", gap: "var(--space-2)" },
  mapCoordRow:      { display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" as any },
  mapCoordChip:     { display: "flex", alignItems: "center", gap: 6, background: "rgba(0,180,216,0.08)", border: "1px solid rgba(0,180,216,0.2)", borderRadius: "var(--radius-md)", padding: "5px 12px" },
  mapCoordLabel:    { fontSize: "var(--text-xs)", fontWeight: "var(--weight-bold)" as any, color: "var(--cyan-400)", letterSpacing: "0.08em" },
  mapCoordVal:      { fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" as any, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" },
  geocodingChip:    { display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" },
  pickedAddressRow: { display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(0,180,216,0.06)", border: "1px solid rgba(0,180,216,0.15)", borderRadius: "var(--radius-md)", padding: "8px 12px" },
  pickedAddressIcon: { fontSize: 14, flexShrink: 0, marginTop: 1 },
  pickedAddressText: { fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 },
  mapHint:          { fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontStyle: "italic" },
  confirmLocationBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--cyan-500)", border: "none", borderRadius: "var(--radius-md)", color: "#0a1628", fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)" as any, fontFamily: "var(--font-sans)", padding: "10px", cursor: "pointer", width: "100%", marginTop: "var(--space-3)" },

  miniSpinner: { display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.25)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
};