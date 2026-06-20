// pages/DeliveryDashboard.tsx

import React, { useEffect, useRef, useState ,useMemo} from "react";
import { deliveryApi } from "../utils/api";
import { getToken } from "../utils/auth";
import L from "leaflet";
import { io } from "socket.io-client";

import "leaflet-routing-machine";

import "leaflet/dist/leaflet.css";

import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet-routing-machine";
// ─── Types ────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL ?? '';
interface DeliveryBoyEntry {
  _id: string;
  deliveryBoy: {
    _id: string;
    firstName: string;
    lastName?: string;
    location?: {
    type: "Point";
    coordinates: [number, number];
  };
  };
  order: number;
  status: "Pending" | "Done";
}

interface Delivery {
  _id: string;
  user: {
    _id: string;
    firstName: string;
    lastName?: string;
    address?: string;
    phone?: string;
  };
  status: string;
  deliveryBoys: DeliveryBoyEntry[];
  services: {
    _id: string;
    status: string;
    quantity: number;
    price: {
      _id: string;
      name: string;
      charge: number;
      picture?: string;
      icon?: string;
    };
    shop: {
      _id: string;
      name: string;
      address?: string;
      location?: {
    type: "Point";
    coordinates: [number, number];
  };
    };
  }[];
  userLocation: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  createdAt: string;
}

// ─── Decode JWT (no library needed) ──────────────────────────

function decodeJwt(token: string): { id?: string; role?: string } | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

// ─── Status config ────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  started:               { label: "Started",              color: "#60a5fa", bg: "rgba(96,165,250,.12)",  dot: "#60a5fa" },
  collected_from_user:   { label: "Collected from User",   color: "#a78bfa", bg: "rgba(167,139,250,.12)", dot: "#a78bfa" },
  given_to_shop:         { label: "At the shop",          color: "#f59e0b", bg: "rgba(245,158,11,.12)",  dot: "#f59e0b" },
  service_done:          { label: "Service done",          color: "#34d399", bg: "rgba(52,211,153,.12)",  dot: "#34d399" },
  collected_from_shop:   { label: "Collected from shop",  color: "#06b6d4", bg: "rgba(6,182,212,.12)",   dot: "#06b6d4" },
  given_to_user:         { label: "Delivered ✓",          color: "#4ade80", bg: "rgba(74,222,128,.12)",  dot: "#4ade80" },
  
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "#94a3b8", bg: "rgba(148,163,184,.12)", dot: "#94a3b8" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999,
      background: meta.bg, color: meta.color,
      fontSize: 11, fontWeight: 700, letterSpacing: ".4px",
      textTransform: "uppercase",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot, flexShrink: 0 }} />
      {meta.label}
    </span>
  );
}



// ─── DeliveryMap ─────────────────────────────────────────────
function DeliveryMap({
  coordinates,
  deliveryBoyCoordinates,
  showRoute,
  status,
  shops,
  completedShopIds,
}: {
  coordinates: [number, number];
  deliveryBoyCoordinates?: [number, number];
  showRoute: boolean;
  status: string;
  shops?: { shopId: string; coordinates: [number, number]; name: string }[];
  completedShopIds?: Set<string>;
}){
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const dbMarkerRef = useRef<L.Marker | null>(null);
  const routingRef = useRef<any>(null);
  const shopMarkerRefs = useRef<Record<string, L.Marker>>({});

  const isShopRouteActive = status === "collected_from_user" || status === "service_done";

  // ── Init map once ────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const [lng, lat] = coordinates;

    mapInstance.current = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 14,
      zoomControl: true,
      dragging: true,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapInstance.current);

    // User pin — only for "started" status
    if (!isShopRouteActive) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:40px; height:40px;
          background:#06b6d4;
          border:3px solid #fff;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
        "></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });
      L.marker([lat, lng], { icon })
        .addTo(mapInstance.current)
        .bindPopup("Delivery Location");
    }

    return () => {
  mapInstance.current?.remove();
  mapInstance.current = null;
  dbMarkerRef.current = null;
  routingRef.current = null;
  shopMarkerRefs.current = {};
};
  }, []);

  // ── Reactive: runs on every liveBoyCoords tick ───────────────
  useEffect(() => {
    if (!mapInstance.current || !showRoute || !deliveryBoyCoordinates) return;

    const [dbLng, dbLat] = deliveryBoyCoordinates;
    const [userLng, userLat] = coordinates;

    // ── Build waypoints ─────────────────────────────────────────
    let waypoints: L.LatLng[];

    if (isShopRouteActive && shops && shops.length > 0) {
      // Sort shops by distance from delivery boy (nearest first)
      const sorted = [...shops].sort((a, b) =>
        getDistanceInMeters(dbLat, dbLng, a.coordinates[1], a.coordinates[0]) -
        getDistanceInMeters(dbLat, dbLng, b.coordinates[1], b.coordinates[0])
      );

      const activeShops = sorted.filter((s) => !completedShopIds?.has(s.shopId));

waypoints = activeShops.length > 0
  ? [
      L.latLng(dbLat, dbLng),
      ...activeShops.map((s) => L.latLng(s.coordinates[1], s.coordinates[0])),
    ]
  : [L.latLng(dbLat, dbLng), L.latLng(userLat, userLng)];

     
// Add pins for new shops, remove pins for completed shops
sorted.forEach((shop, idx) => {
  const isCompleted = completedShopIds?.has(shop.shopId);

  if (isCompleted) {
    // Remove marker if it exists
    if (shopMarkerRefs.current[shop.shopId]) {
      shopMarkerRefs.current[shop.shopId].remove();
      delete shopMarkerRefs.current[shop.shopId];
    }
  } else if (!shopMarkerRefs.current[shop.shopId]) {
    // Add marker only if not already on map
    const shopIcon = L.divIcon({
      className: "",
      html: `<div style="
        width:36px; height:36px;
        background:#f59e0b;
        border:3px solid #fff;
        border-radius:8px;
        display:flex; align-items:center; justify-content:center;
        font-size:14px; font-weight:800; color:#fff;
      ">${idx + 1}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    shopMarkerRefs.current[shop.shopId] = L.marker(
      [shop.coordinates[1], shop.coordinates[0]],
      { icon: shopIcon }
    )
      .addTo(mapInstance.current!)
      .bindTooltip(shop.name, {
        permanent: false,
        direction: "top",
        offset: [0, -20],
        className: "shop-tooltip",
      });
  }
});
    } else {
      waypoints = [L.latLng(dbLat, dbLng), L.latLng(userLat, userLng)];
    }

    // ── Delivery boy marker — create once, move on every tick ───
    const deliveryBoyIcon = L.divIcon({
      className: "",
      html: `<div style="
        width:36px; height:36px;
        background:#22c55e;
        border:3px solid #fff;
        border-radius:50%;
      "></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    if (!dbMarkerRef.current) {
      dbMarkerRef.current = L.marker([dbLat, dbLng], { icon: deliveryBoyIcon })
        .addTo(mapInstance.current!)
        .bindPopup("Delivery Boy");
    } else {
      dbMarkerRef.current.setLatLng([dbLat, dbLng]);
    }

    // ── Routing — create once, update waypoints on every tick ───
    if (!routingRef.current) {
      routingRef.current = (L as any).Routing.control({
        waypoints,
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        show: false,
        lineOptions: {
          styles: [{ color: "#22c55e", opacity: 0.9, weight: 5 }],
        },
        createMarker: () => null,
      }).addTo(mapInstance.current!);
    } else {
      routingRef.current.setWaypoints(waypoints);
    }

    // ── Fit all points in view ──────────────────────────────────
    mapInstance.current!.fitBounds(
      L.latLngBounds(waypoints.map((w) => [w.lat, w.lng] as [number, number])),
      { padding: [40, 40] }
    );

  }, [deliveryBoyCoordinates, showRoute, status, completedShopIds,, shops]);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: 240, borderRadius: "var(--radius-xl)", overflow: "hidden" }}
    />
  );
}
function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371000; // meters

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
// ─── Detail Drawer ────────────────────────────────────────────
function DetailDrawer({
  delivery,
  currentUserId,
  onClose,
}: {
  delivery: Delivery;
  currentUserId: string;
  onClose: () => void;
}) {
  const [shopOtpInputs, setShopOtpInputs] = useState<
  Record<string, boolean>
>({});

const [shopOtps, setShopOtps] = useState<
  Record<string, string>
>({});

const [showOtpInput, setShowOtpInput] = useState(false);

const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localDelivery, setLocalDelivery] = useState(delivery);
 
  const [liveBoyCoords, setLiveBoyCoords] = useState<[number, number] | undefined>(
  localDelivery?.deliveryBoys?.[0]?.deliveryBoy?.location?.coordinates
);
  const sortedBoys = [...localDelivery.deliveryBoys].sort(
    (a, b) => a.order - b.order
  );

  const currentDeliveryBoy = sortedBoys.find(
    (b) => b.deliveryBoy._id === currentUserId
  );
  // Is the current user the order:1 return delivery boy?
const isOrder1Boy =
  localDelivery.status === "service_done" &&
  !!delivery.deliveryBoys.find(
    (db) => db.deliveryBoy._id === currentUserId && db.order === 1 && db.status === "Pending"
  );
  // ── USE liveBoyCoords (updates in real time via watchPosition + socket) ──
const userCoords = localDelivery.userLocation.coordinates;

let distanceToUser = Infinity;

if (liveBoyCoords) {
  distanceToUser = getDistanceInMeters(
    liveBoyCoords[1], // lat
    liveBoyCoords[0], // lng
    userCoords[1],    // lat
    userCoords[0]     // lng
  );
}

const isWithin50Meters = distanceToUser <= 150;
const canGiveToUser =
  localDelivery.status === "collected_from_shops";
  const total = (localDelivery.services || []).reduce(
    (acc, s) => acc + s.price.charge * s.quantity,
    0
  );
const showCollect =
  localDelivery.status === "started" &&
  currentDeliveryBoy &&
  currentDeliveryBoy.status === "Pending" &&
  isWithin50Meters;

  const backdropRef = useRef<HTMLDivElement>(null);
// ── Distance from delivery boy to each shop ──────────────────
const shopDistances = useMemo(() => {
  const map: Record<string, number> = {};
  (localDelivery.services || []).forEach((svc) => {
    const shop = svc.shop;
    if (!map[shop._id] && shop.location?.coordinates && liveBoyCoords) {
      map[shop._id] = getDistanceInMeters(
        liveBoyCoords[1],              // boy lat
        liveBoyCoords[0],              // boy lng
        shop.location.coordinates[1], // shop lat
        shop.location.coordinates[0]  // shop lng
      );
    }
  });
  return map;
}, [liveBoyCoords, localDelivery.services]);
  // ─────────────────────────────────────────────
// Group Services By Shop
// ─────────────────────────────────────────────

const groupedServices = (localDelivery.services || []).reduce((acc, service) => {

  const shopId = service.shop._id;

  if (!acc[shopId]) {
    acc[shopId] = {
      shop: service.shop,
      services: [],
    };
  }

  acc[shopId].services.push(service);

  return acc;

}, {} as Record<string, {
  shop: {
    _id: string;
    name: string;
    address?: string;
  };
  services: typeof localDelivery.services;
}>);
// ─── Live Location Update ─────────────────────────────
// ── Live Location Update ─────────────────────────────
useEffect(() => {
  if (localDelivery.status !== "started" &&
    localDelivery.status !== "collected_from_user" &&
    localDelivery.status !== "service_done"&&
  localDelivery.status !== "collected_from_shops") return; 

  let watchId: number;
  let retryTimeout: ReturnType<typeof setTimeout>;

  const startWatch = () => {
    watchId = navigator.geolocation.watchPosition(

      async (position) => {
        const coordinates: [number, number] = [
          position.coords.longitude,
          position.coords.latitude,
        ];

        // ← Update local state immediately so distance recalculates
        setLiveBoyCoords(coordinates);

        try {
          await deliveryApi.updateLiveLocation({
            deliveryId: localDelivery._id,
            coordinates,
          });
        } catch (err) {
          console.error("Live location update failed", err);
        }
      },

      (err) => {
        switch (err.code) {
          case GeolocationPositionError.PERMISSION_DENIED:
            console.error("Location permission denied.");
            break;
          case GeolocationPositionError.POSITION_UNAVAILABLE:
            console.warn("Position unavailable. Retrying in 5s...");
            navigator.geolocation.clearWatch(watchId);
            retryTimeout = setTimeout(startWatch, 5000);
            break;
          case GeolocationPositionError.TIMEOUT:
            console.warn("Geolocation timed out.");
            break;
        }
      },

      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );
  };

  if (navigator.geolocation) {
    startWatch();
  } else {
    console.warn("Geolocation not supported.");
  }

  return () => {
    navigator.geolocation.clearWatch(watchId);
    clearTimeout(retryTimeout);
  };
}, [localDelivery.status, localDelivery._id]);
useEffect(() => {
  const socket = io(BASE_URL ?? "http://localhost:3000");

  socket.emit("join-delivery", localDelivery._id);

  socket.on("delivery-live-location", ({ deliveryId, coordinates }) => {
    if (deliveryId === localDelivery._id) {
      setLiveBoyCoords(coordinates); // ← triggers DeliveryMap re-render
    }
  });

  return () => {
    socket.disconnect();
  };
}, [localDelivery._id]);
  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={(e) => {
          if (e.target === backdropRef.current) onClose();
        }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(3px)",
          animation: "ddFadeIn .2s ease",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(520px, 100vw)",
          zIndex: 201,
          background: "var(--bg-surface)",
          boxShadow: "-20px 0 60px rgba(0,0,0,.5)",
          display: "flex",
          flexDirection: "column",
          animation: "ddSlideIn .28s cubic-bezier(.22,1,.36,1)",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-surface)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-lg)",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Delivery Details
            </div>

            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 2,
              }}
            >
              {new Date(localDelivery.createdAt).toLocaleString()}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <StatusBadge status={localDelivery.status} />

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
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Customer */}
          <section>
            <SectionLabel icon="👤" text="Customer" />

            <div
              style={{
                background: "var(--bg-page)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "var(--cyan-500)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 18,
                  color: "var(--navy-900)",
                  flexShrink: 0,
                }}
              >
                {localDelivery.user.firstName[0].toUpperCase()}
              </div>

              <div>
                <div
                  style={{
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    fontSize: "var(--text-base)",
                  }}
                >
                  {localDelivery.user.firstName}{" "}
                  {localDelivery.user.lastName ?? ""}
                </div>

                {localDelivery.user.address && (
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                      marginTop: 3,
                    }}
                  >
                    📍 {localDelivery.user.address}
                  </div>
                )}

                {localDelivery.user.phone && (
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    📞 {localDelivery.user.phone}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Map */}
          <section>
            <SectionLabel icon="🗺️" text="Delivery Location" />
<DeliveryMap
  coordinates={localDelivery.userLocation.coordinates}
  deliveryBoyCoordinates={liveBoyCoords}
  showRoute={
    localDelivery.status === "started" ||
    localDelivery.status === "collected_from_user" ||
    localDelivery.status === "service_done"||
    localDelivery.status === "collected_from_shops"
  }
  status={localDelivery.status}
  shops={
    localDelivery.status === "collected_from_user" ||
    localDelivery.status === "service_done"         // ← ADD
      ? Object.values(
          (localDelivery.services || []).reduce((acc, svc) => {
            const sid = svc.shop._id;
            if (!acc[sid] && svc.shop.location?.coordinates) {
              acc[sid] = {
                shopId: sid,
                coordinates: svc.shop.location.coordinates as [number, number],
                name: svc.shop.name,
              };
            }
            return acc;
          }, {} as Record<string, { shopId: string; coordinates: [number, number]; name: string }>)
        )
      : undefined
  }
  completedShopIds={
    new Set(
      Object.values(
        (localDelivery.services || []).reduce((acc, svc) => {
          const sid = svc.shop._id;
          if (!acc[sid]) acc[sid] = { shopId: sid, services: [] as typeof localDelivery.services };
          acc[sid].services.push(svc);
          return acc;
        }, {} as Record<string, { shopId: string; services: typeof localDelivery.services }>)
      )
      .filter((g) =>
  localDelivery.status === "service_done"
    ? g.services.every((s) => s.status === "collected_from_shop")
    : g.services.every((s) => s.status === "given_to_shop")
) // ← "collected_from_shop" for return trip
      .map((g) => g.shopId)
    )
  }
/>

            <div
              style={{
                marginTop: 8,
                padding: "8px 12px",
                background: "var(--bg-page)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ color: "var(--cyan-500)" }}>⊕</span>

              {localDelivery.userLocation.coordinates[1].toFixed(6)},
              {" "}
              {localDelivery.userLocation.coordinates[0].toFixed(6)}
            </div>
          </section>

          {/* Services */}
<section>

  <SectionLabel
    icon="🧺"
    text={`Services (${localDelivery.services.length})`}
  />

  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 18,
    }}
  >

    {Object.values(groupedServices).map((group: any) => {

      const distanceToShop = shopDistances[group.shop._id] ?? Infinity;
const isWithinShop = distanceToShop <= 150;

const canGiveToShop =
  localDelivery.status === "collected_from_user" &&
  group.services.every(
    (s: any) => s.status === "collected_from_user"
  );

const canCollectFromShop =
  isOrder1Boy &&
  isWithinShop &&          // ← add this
  group.services.length > 0 &&
  group.services.every((s: any) => s.status === "service_done");

      return (

        <div
          key={group.shop._id}
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xl)",
            overflow: "hidden",
            background: "var(--bg-surface)",
          }}
        >

          {/* Shop Header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "rgba(6,182,212,.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >

            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "var(--text-base)",
                  color: "var(--text-primary)",
                }}
              >
                🏪 {group.shop.name}
              </div>

              {group.shop.address && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: "var(--text-xs)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {group.shop.address}
                </div>
              )}
            </div>

            {/* Give To Shop Button */}
         
{canGiveToShop && (

  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 10,
      minWidth: 220,
    }}
  >

    {!shopOtpInputs[group.shop._id] ? (

      <button
  className="btn btn-primary"
  disabled={!isWithinShop || submitting}
  title={!isWithinShop ? `Move within 150m of shop (currently ${Math.round(distanceToShop)}m away)` : undefined}
  style={{
    height: 42,
    padding: "0 18px",
    borderRadius: "var(--radius-lg)",
    fontWeight: 800,
    fontSize: "var(--text-sm)",
    whiteSpace: "nowrap",
    opacity: (!isWithinShop || submitting) ? 0.45 : 1,
    pointerEvents: (!isWithinShop || submitting) ? "none" : "auto",
    cursor: !isWithinShop ? "not-allowed" : "pointer",
  }}
  onClick={async () => {

          try {

            setSubmitting(true);

            await deliveryApi.createOtpForShopCollection({
              deliveryId: localDelivery._id,
              shopId: group.shop._id,
            });

            alert("OTP created successfully");

            setShopOtpInputs(prev => ({
              ...prev,
              [group.shop._id]: true
            }));

          } catch (err: any) {

            alert(err.message);

          } finally {

            setSubmitting(false);

          }

        }}
      >
        Give To Shop
      </button>

    ) : (

      <>
        <input
          type="text"
          maxLength={6}
          placeholder="Enter OTP"
          value={shopOtps[group.shop._id] || ""}
          onChange={(e) => {

            setShopOtps(prev => ({
              ...prev,
              [group.shop._id]: e.target.value
            }));

          }}
          style={{
            width: "100%",
            height: 44,
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-page)",
            color: "var(--text-primary)",
            padding: "0 14px",
            fontSize: "var(--text-sm)",
            outline: "none",
          }}
        />

        <button
          className="btn btn-primary"
          style={{
            height: 42,
            borderRadius: "var(--radius-lg)",
            fontWeight: 800,
            fontSize: "var(--text-sm)",
            opacity: submitting ? 0.7 : 1,
            pointerEvents: submitting ? "none" : "auto",
          }}
          onClick={async () => {

            try {

              setSubmitting(true);

              const updatedDelivery =
                await deliveryApi.verifyOtpForShopCollection({
                  deliveryId: localDelivery._id,
                  shopId: group.shop._id,
                  otp: shopOtps[group.shop._id]
                });

              setLocalDelivery(updatedDelivery);

              setShopOtpInputs(prev => ({
                ...prev,
                [group.shop._id]: false
              }));

              setShopOtps(prev => ({
                ...prev,
                [group.shop._id]: ""
              }));

              alert("Shop collection verified");

            } catch (err: any) {

              alert(err.message);

            } finally {

              setSubmitting(false);

            }

          }}
        >
          Verify OTP
        </button>
        {!isWithinShop && (
  <div style={{
    fontSize: 11,
    color: "#f59e0b",
    fontWeight: 600,
    textAlign: "center",
    marginTop: 4,
  }}>
    📍 {Math.round(distanceToShop)}m away — move within 150m
  </div>
)}
      </>

    )}

  </div>

)}
{/* Collect From Shop */}
{canCollectFromShop && (

  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 10,
      minWidth: 220,
      marginTop: 12,
    }}
  >

    {!shopOtpInputs[`collect-${group.shop._id}`] ? (

      <button
        className="btn btn-primary"
        style={{
          height: 42,
          padding: "0 18px",
          borderRadius: "var(--radius-lg)",
          fontWeight: 800,
          fontSize: "var(--text-sm)",
          whiteSpace: "nowrap",
          background: "#22c55e",
          opacity: submitting ? 0.7 : 1,
          pointerEvents: submitting ? "none" : "auto",
        }}
        onClick={async () => {

          try {

            setSubmitting(true);

            await deliveryApi.createOtpForCollectionFromShop({
              deliveryId: localDelivery._id,
              shopId: group.shop._id,
            });

            alert("OTP created successfully");

            setShopOtpInputs(prev => ({
              ...prev,
              [`collect-${group.shop._id}`]: true
            }));

          } catch (err: any) {

            alert(err.message);

          } finally {

            setSubmitting(false);

          }

        }}
      >
        Collect From Shop
      </button>

    ) : (

      <>
        <input
          type="text"
          maxLength={6}
          placeholder="Enter OTP"
          value={
            shopOtps[`collect-${group.shop._id}`] || ""
          }
          onChange={(e) => {

            setShopOtps(prev => ({
              ...prev,
              [`collect-${group.shop._id}`]:
                e.target.value
            }));

          }}
          style={{
            width: "100%",
            height: 44,
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-page)",
            color: "var(--text-primary)",
            padding: "0 14px",
            fontSize: "var(--text-sm)",
            outline: "none",
          }}
        />

        <button
          className="btn btn-primary"
          style={{
            height: 42,
            borderRadius: "var(--radius-lg)",
            fontWeight: 800,
            fontSize: "var(--text-sm)",
            background: "#22c55e",
            opacity: submitting ? 0.7 : 1,
            pointerEvents: submitting ? "none" : "auto",
          }}
          onClick={async () => {

            try {

              setSubmitting(true);

              const updatedDelivery =
                await deliveryApi.verifyOtpForCollectionFromShop({
                  deliveryId: localDelivery._id,
                    otpCode:
      shopOtps[`collect-${group.shop._id}`]
  });

              setLocalDelivery(updatedDelivery);

              setShopOtpInputs(prev => ({
                ...prev,
                [`collect-${group.shop._id}`]: false
              }));

              setShopOtps(prev => ({
                ...prev,
                [`collect-${group.shop._id}`]: ""
              }));

              alert("Collected from shop successfully");

            } catch (err: any) {

              alert(err.message);

            } finally {

              setSubmitting(false);

            }

          }}
        >
          Verify OTP
        </button>
      </>

    )}

  </div>

)}
          </div>

          {/* Services */}
          <div
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >

            {group.services.map((svc: any, i: number) => (

              <div
                key={svc._id || i}
                style={{
                  background: "var(--bg-page)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >

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
                    flexShrink: 0,
                  }}
                >
                  {svc.price.picture ? (
                    <img
                      src={svc.price.picture}
                      alt={svc.price.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : svc.price.icon ? (
                    <span style={{ fontSize: 22 }}>
                      {svc.price.icon}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontWeight: 800,
                        color: "var(--text-tertiary)",
                        fontSize: 13,
                      }}
                    >
                      {svc.price.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>

                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {svc.price.name}
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >

                    <span
                      style={{
                        background: "rgba(6,182,212,.12)",
                        color: "var(--cyan-400)",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      ×{svc.quantity}
                    </span>

                    <StatusBadge status={svc.status} />

                  </div>

                </div>

                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "var(--text-base)",
                    color: "var(--text-primary)",
                    flexShrink: 0,
                  }}
                >
                  ₹{(svc.price.charge * svc.quantity).toFixed(2)}
                </div>

              </div>

            ))}

          </div>

        </div>

      );

    })}

  </div>

</section>

          {/* Total */}
          <div
            style={{
              background: "var(--navy-900)",
              borderRadius: "var(--radius-lg)",
              padding: "14px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: "var(--text-sm)",
              }}
            >
              Total Amount
            </span>

            <span
              style={{
                color: "var(--cyan-400)",
                fontWeight: 800,
                fontSize: "var(--text-xl)",
              }}
            >
              ₹{total.toFixed(2)}
            </span>
          </div>

          {/* Collect + OTP */}
          {showCollect && (
            <>
              {!showOtpInput ? (
                <button
                  onClick={async () => {
                    try {
                      setSubmitting(true);

                      await deliveryApi.createOtpCode({
                        deliveryId: localDelivery._id,
                        user1: localDelivery.user._id,
                      });

                      setShowOtpInput(true);

                    } catch (err: any) {
                      alert(err.message);
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: "var(--radius-lg)",
                    fontWeight: 800,
                    fontSize: "var(--text-base)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: "0 0 24px rgba(6,182,212,.35)",
                    animation: "ddPulse 2.5s ease-in-out infinite",
                    opacity: submitting ? 0.7 : 1,
                    pointerEvents: submitting ? "none" : "auto",
                  }}
                >
                  Collect Delivery
                </button>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <input
                    type="text"
                    value={otp}
                    maxLength={6}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP"
                    style={{
                      width: "100%",
                      height: 52,
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-page)",
                      color: "var(--text-primary)",
                      padding: "0 16px",
                      fontSize: "var(--text-base)",
                      outline: "none",
                    }}
                  />

                  <button
                    onClick={async () => {
                      try {
                        setSubmitting(true);

                        const updatedDelivery =
                          await deliveryApi.verifyOtpCollectionStarted({
                            deliveryId: localDelivery._id,
                            otp,
                          });

                        setLocalDelivery(updatedDelivery);

                        setShowOtpInput(false);

                      } catch (err: any) {
                        alert(err.message);
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    className="btn btn-primary"
                    style={{
                      width: "100%",
                      height: 52,
                      borderRadius: "var(--radius-lg)",
                      fontWeight: 800,
                      fontSize: "var(--text-base)",
                      opacity: submitting ? 0.7 : 1,
                      pointerEvents: submitting ? "none" : "auto",
                    }}
                  >
                    Verify OTP
                  </button>
                </div>
              )}
            </>
          )}
          {/* Give To User */}
{/* Give To User */}
{canGiveToUser && (

  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}
  >

    {!showOtpInput ? (

      <button
        onClick={async () => {

          try {

            setSubmitting(true);

            await deliveryApi.giveToUser({
              deliveryId: localDelivery._id,
            });

            alert("OTP created successfully");

            setShowOtpInput(true);

          } catch (err: any) {

            alert(err.message);

          } finally {

            setSubmitting(false);

          }

        }}
        className="btn btn-primary"
        disabled={!isWithin50Meters}
        style={{
          width: "100%",
          height: 52,
          borderRadius: "var(--radius-lg)",
          fontWeight: 800,
          fontSize: "var(--text-base)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background: !isWithin50Meters
  ? "linear-gradient(rgba(220,220,220,0.7), rgba(220,220,220,0.7)), #22c55e"
  : "#22c55e",
    color: !isWithin50Meters ? "#6b7280" : "#ffffff",
    boxShadow: !isWithin50Meters
      ? "none"
      : "0 0 24px rgba(34,197,94,.35)",
    cursor: !isWithin50Meters ? "not-allowed" : "pointer",
    opacity: submitting ? 0.7 : 1,
    pointerEvents: submitting ? "none" : "auto",
        }}
      >
        Give To User
      </button>

    ) : (

      <>
        <input
          type="text"
          maxLength={6}
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          style={{
            width: "100%",
            height: 52,
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-page)",
            color: "var(--text-primary)",
            padding: "0 16px",
            fontSize: "var(--text-base)",
            outline: "none",
          }}
        />

        <button
          onClick={async () => {

            try {

              setSubmitting(true);

              const updatedDelivery =
                await deliveryApi.verifyOtpForGiveToUser({
                  deliveryId: localDelivery._id,
                  otpCode: otp,
                });

              setLocalDelivery(updatedDelivery);

              alert("OTP verified successfully");

              setShowOtpInput(false);

              setOtp("");

            } catch (err: any) {

              alert(err.message);

            } finally {

              setSubmitting(false);

            }

          }}
          className="btn btn-primary"
          style={{
            width: "100%",
            height: 52,
            borderRadius: "var(--radius-lg)",
            fontWeight: 800,
            fontSize: "var(--text-base)",
            background: "#22c55e",
            opacity: submitting ? 0.7 : 1,
            pointerEvents: submitting ? "none" : "auto",
          }}
        >
          Verify OTP
        </button>
      </>

    )}

  </div>

)}
{localDelivery.status === "collected_from_shops" &&
 !isWithin50Meters && (
  <div
    style={{
      marginTop: 10,
      padding: 12,
      borderRadius: 10,
      background: "rgba(239,68,68,.1)",
      color: "#ef4444",
      fontSize: 13,
      fontWeight: 600,
    }}
  >
    Move closer to the customer location.
    Current distance: {Math.round(distanceToUser)}m
    (must be within 150m to deliver)
  </div>
)}
{localDelivery.status === "started" &&
 currentDeliveryBoy &&
 !isWithin50Meters && (
  <div
    style={{
      marginTop: 10,
      padding: 12,
      borderRadius: 10,
      background: "rgba(239,68,68,.1)",
      color: "#ef4444",
      fontSize: 13,
      fontWeight: 600,
    }}
  >
    Move closer to the customer location.
    Current distance: {Math.round(distanceToUser)}m
    (must be within 50m to collect delivery)
  </div>
)}
          <div style={{ height: 12 }} />
        </div>
      </div>

      <style>{`
        @keyframes ddFadeIn  {
          from { opacity:0 }
          to { opacity:1 }
        }

        @keyframes ddSlideIn {
          from { transform:translateX(100%) }
          to { transform:translateX(0) }
        }

        @keyframes ddPulse {
          0%,100% {
            box-shadow: 0 0 20px rgba(6,182,212,.3);
          }

          50% {
            box-shadow: 0 0 36px rgba(6,182,212,.65);
          }
        }

        .leaflet-pane,
        .leaflet-control-container {
          z-index:1 !important;
        }

        .leaflet-top,
        .leaflet-bottom {
          z-index:2 !important;
        }
      `}</style>
    </>
  );
}

// ─── Small helper: section label ─────────────────────────────

function SectionLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7,
      marginBottom: 10,
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: ".6px",
        textTransform: "uppercase", color: "var(--text-tertiary)",
      }}>
        {text}
      </span>
    </div>
  );
}

// ─── DeliveryCard (collapsed list item) ──────────────────────

function DeliveryCard({
  delivery,
  onClick,
}: {
  delivery: Delivery;
  onClick: () => void;
}) {
  const total = delivery.services.reduce(
    (acc, s) => acc + s.price.charge * s.quantity, 0
  );

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xl)",
        padding: "18px 20px",
        cursor: "pointer",
        transition: "border-color .15s, box-shadow .15s, transform .1s",
        display: "flex", alignItems: "center", gap: 16,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--cyan-500)";
        el.style.boxShadow = "0 0 0 1px var(--cyan-500), 0 6px 24px rgba(6,182,212,.15)";
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--border-default)";
        el.style.boxShadow = "none";
        el.style.transform = "none";
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 46, height: 46, borderRadius: "50%",
        background: "var(--cyan-500)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 18, color: "var(--navy-900)",
        flexShrink: 0,
      }}>
        {delivery.user.firstName[0].toUpperCase()}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, color: "var(--text-primary)",
          fontSize: "var(--text-base)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {delivery.user.firstName} {delivery.user.lastName ?? ""}
        </div>
        <div style={{
          fontSize: "var(--text-xs)", color: "var(--text-tertiary)",
          marginTop: 3,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {delivery.user.address
            ? `📍 ${delivery.user.address}`
            : `📍 ${delivery.userLocation.coordinates[1].toFixed(4)}, ${delivery.userLocation.coordinates[0].toFixed(4)}`}
        </div>
        <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge status={delivery.status} />
          <span style={{
            fontSize: 11, color: "var(--text-tertiary)",
          }}>
            {delivery.services.length} service{delivery.services.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Right: total + chevron */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        <span style={{ fontWeight: 800, fontSize: "var(--text-base)", color: "var(--cyan-400)" }}>
          ₹{total.toFixed(0)}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-tertiary)" strokeWidth="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────

const DeliveryDashboard = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Delivery | null>(null);

  // Decode current user id from JWT
  const token = getToken();
  const currentUser = token ? decodeJwt(token) : null;
  const currentUserId = currentUser?.id ?? "";

  useEffect(() => {
    (async () => {
      try {
        const data = await deliveryApi.getMyDeliveries();
        setDeliveries(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  
  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--bg-page)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 14,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" stroke="var(--cyan-500)"
          strokeWidth="2" fill="none" style={{ animation: "ddSpin 1s linear infinite" }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
          Loading deliveries…
        </span>
        <style>{`@keyframes ddSpin { to { transform:rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <>
      <div style={{
        minHeight: "100vh",
       margin: "0 auto",
      }}>
        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <div style={{
              width: 42, height: 42, borderRadius: "var(--radius-md)",
              background: "var(--cyan-500)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "var(--shadow-cyan)", flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="var(--navy-900)" strokeWidth="2.5">
                <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8"/>
                <path d="M10 12v4M14 12v4"/>
              </svg>
            </div>
            <div>
              <h1 style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-2xl)", fontWeight: 700,
                color: "var(--text-primary)",
              }}>
                My Deliveries
              </h1>
              {deliveries.length > 0 && (
                <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 2 }}>
                  {deliveries.length} pending assignment{deliveries.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Empty ── */}
        {deliveries.length === 0 ? (
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xl)",
            padding: "60px 32px",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 16,
          }}>
            <div style={{ fontSize: 48 }}>📦</div>
            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-xl)", fontWeight: 700,
              color: "var(--text-primary)",
            }}>
              No Pending Deliveries
            </div>
            <p style={{
              margin: 0, fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)", textAlign: "center",
            }}>
              You're all caught up. New deliveries will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {deliveries.map((d, i) => (
              <div
                key={d._id}
                style={{ animation: `ddFadeUp .3s ease both`, animationDelay: `${i * 0.06}s` }}
              >
                <DeliveryCard delivery={d} onClick={() => setSelected(d)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {selected && (
        <DetailDrawer
          delivery={selected}
          currentUserId={currentUserId}
          onClose={() => setSelected(null)}
        />
      )}

      <style>{`
        @keyframes ddFadeUp {
          from { opacity:0; transform:translateY(12px) }
          to   { opacity:1; transform:translateY(0) }
        }
        @keyframes ddFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes ddSlideIn { from { transform:translateX(100%) } to { transform:translateX(0) } }
        @keyframes ddSpin    { to { transform:rotate(360deg) } }
        @keyframes ddPulse   {
          0%,100% { box-shadow: 0 0 20px rgba(6,182,212,.3); }
          50%      { box-shadow: 0 0 36px rgba(6,182,212,.65); }
        }
      `}</style>
    </>
  );
};

export default DeliveryDashboard;