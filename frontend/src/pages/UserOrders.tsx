// pages/UserOrders.tsx

import React, { useEffect, useRef, useState } from "react";
import { deliveryApi } from "../utils/api";
import { io } from "socket.io-client";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

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

// ─── Status config ────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  started:               { label: "Started",              color: "#60a5fa", bg: "rgba(96,165,250,.12)",  dot: "#60a5fa" },
  collected_from_user:   { label: "Collected from you",   color: "#a78bfa", bg: "rgba(167,139,250,.12)", dot: "#a78bfa" },
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
}: {
  coordinates: [number, number];
  deliveryBoyCoordinates?: [number, number];
  showRoute: boolean;
  status: string;
  shops?: { shopId: string; coordinates: [number, number]; name: string }[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const dbMarkerRef = useRef<L.Marker | null>(null);
  const routingRef = useRef<any>(null);
  const shopMarkerRefs = useRef<Record<string, L.Marker>>({});

  const isCollectedFromUser = status === "collected_from_user";

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

    // User pin — only when NOT collected_from_user
    if (!isCollectedFromUser) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:40px;height:40px;
          background:var(--cyan-500,#06b6d4);
          border:3px solid #fff;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 4px 18px rgba(6,182,212,.7);
        "></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });
      L.marker([lat, lng], { icon })
        .addTo(mapInstance.current)
        .bindPopup("Delivery location")
        .openPopup();
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

    // ── Build waypoints ──────────────────────────────────────────
    let waypoints: L.LatLng[];

    if (isCollectedFromUser && shops && shops.length > 0) {
      // Sort shops by distance from delivery boy (nearest first)
      const sorted = [...shops].sort((a, b) => {
        const distA = Math.hypot(dbLat - a.coordinates[1], dbLng - a.coordinates[0]);
        const distB = Math.hypot(dbLat - b.coordinates[1], dbLng - b.coordinates[0]);
        return distA - distB;
      });

      waypoints = [
        L.latLng(dbLat, dbLng),
        ...sorted.map((s) => L.latLng(s.coordinates[1], s.coordinates[0])),
      ];

      // Add shop pins — same logic as DeliveryDashboard
      sorted.forEach((shop, idx) => {
        if (!shopMarkerRefs.current[shop.shopId]) {
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
        width:36px;height:36px;
        background:#22c55e;
        border:3px solid #fff;
        border-radius:50%;
        box-shadow:0 4px 14px rgba(34,197,94,.6);
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

    mapInstance.current!.fitBounds(
      L.latLngBounds(waypoints.map((w) => [w.lat, w.lng] as [number, number])),
      { padding: [40, 40] }
    );

  }, [deliveryBoyCoordinates, showRoute, status, shops]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: 240,
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
      }}
    />
  );
}

// ─── Detail Modal ─────────────────────────────────────────────

function DetailModal({
  delivery,
  onClose,
}: {
  delivery: Delivery;
  onClose: () => void;
}) {

  const total = delivery.services.reduce(
    (acc, s) => acc + s.price.charge * s.quantity,
    0
  );

  const [otp, setOtp] = useState<string | null>(null);

  // Live delivery boy coordinates (updates via socket)
 const activeBoy = delivery.deliveryBoys?.find(
  (db) => db.status === "Pending"   // ← removed order === 0, any pending boy is the active one
);

const [liveBoyCoords, setLiveBoyCoords] = useState<[number, number] | undefined>(
  activeBoy?.deliveryBoy?.location?.coordinates
);

  // ── Socket.IO live tracking ────────────────────────────────
  useEffect(() => {
    if (
  delivery.status !== "started" &&
  delivery.status !== "collected_from_user" &&
  delivery.status !== "collected_from_shops"
) return;
    const socket = io(BASE_URL ?? "http://localhost:3000");

    socket.emit("join-delivery", delivery._id);

    socket.on("delivery-live-location", ({ deliveryId, coordinates }: { deliveryId: string; coordinates: [number, number] }) => {
      if (deliveryId === delivery._id) {
        setLiveBoyCoords(coordinates);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [delivery._id, delivery.status]);

  // ── Fetch OTP Based On Delivery Status ──────────────────
  useEffect(() => {

    const fetchOtp = async () => {

      try {

        // ─────────────────────────────────────
        // OTP for collection from user
        // status = started
        // ─────────────────────────────────────

        if (delivery.status === "started") {

          const response =
            await deliveryApi.getOtpStarted(
              delivery._id
            );

          if (response?.otp) {

            setOtp(response.otp.toString());

          }

          return;

        }

        // ─────────────────────────────────────
        // OTP for give to user
        // status = collected_from_shop
        // ─────────────────────────────────────

        if (
          delivery.status ===
          "collected_from_shops"
        ) {

          const response =
            await deliveryApi.getOtpForGiveToUser({
              deliveryId : delivery._id
        });

          if (response?.otp) {

            setOtp(response.otp.toString());

          }

          return;

        }

        // ─────────────────────────────────────
        // Other statuses
        // ─────────────────────────────────────

        setOtp(null);

      } catch (error) {

        setOtp(null);

      }

    };

    fetchOtp();

  }, [delivery]);

  // Close on backdrop click
  const backdropRef = useRef<HTMLDivElement>(null);

  // ── Group Services By Shop ─────────────────────────────

  const groupedServices = delivery.services.reduce((acc, service) => {

    const shopId = service.shop._id;

    if (!acc[shopId]) {

      acc[shopId] = {
        shop: service.shop,
        services: [],
        total: 0,
      };

    }

    acc[shopId].services.push(service);

    acc[shopId].total +=
      service.price.charge * service.quantity;

    return acc;

  }, {} as Record<
    string,
    {
      shop: Delivery["services"][0]["shop"];
      services: Delivery["services"];
      total: number;
    }
  >);

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
          animation: "uoFadeIn .2s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(620px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 32px)",
          zIndex: 201,
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "0 24px 80px rgba(0,0,0,.5)",
          display: "flex",
          flexDirection: "column",
          animation: "uoScaleIn .28s cubic-bezier(.22,1,.36,1)",
          overflowY: "auto",
        }}
      >

        {/* ── Modal Header ── */}
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
            borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
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
              Order Details
            </div>

            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 2,
              }}
            >
              {new Date(delivery.createdAt).toLocaleString()}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <StatusBadge status={delivery.status} />

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

          {/* ── OTP Section ── */}
          {(
  delivery.status === "started" ||
  delivery.status === "collected_from_shops"
) && otp && (
            <section>

              <SectionLabel
                icon="🔐"
                text={
  delivery.status === "started"
    ? "Collection OTP"
    : "Delivery OTP"
}
              />

              <div
                style={{
                  background: "var(--bg-page)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: "22px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >

                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    fontWeight: 700,
                  }}
                >{
  delivery.status === "started"
    ? "Share this OTP with Delivery Boy"
    : "Share this OTP to receive your order"
}
                </div>

                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    letterSpacing: "10px",
                    color: "var(--cyan-400)",
                    lineHeight: 1,
                  }}
                >
                  {otp}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                  }}
                >
                  Valid for 5 minutes
                </div>

              </div>

            </section>
          )}

          {/* ── Delivery Boys ── */}
          {delivery.deliveryBoys.length > 0 && (
            <section>

              <SectionLabel
                icon="🚴"
                text="Delivery Personnel"
              />

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >

                {delivery.deliveryBoys
                  .sort((a, b) => a.order - b.order)
                  .map((db) => (

                    <div
                      key={db._id}
                      style={{
                        background: "var(--bg-page)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-lg)",
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >

                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background:
                            db.status === "Done"
                              ? "var(--cyan-500)"
                              : "var(--slate-600)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: 14,
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        {db.deliveryBoy.firstName[0].toUpperCase()}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            fontSize: "var(--text-sm)",
                          }}
                        >
                          {db.deliveryBoy.firstName}{" "}
                          {db.deliveryBoy.lastName ?? ""}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            marginTop: 2,
                          }}
                        >
                          Order #{db.order + 1}
                        </div>
                      </div>

                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 999,
                          background:
                            db.status === "Done"
                              ? "rgba(52,211,153,.12)"
                              : "rgba(148,163,184,.12)",
                          color:
                            db.status === "Done"
                              ? "#34d399"
                              : "#94a3b8",
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                        }}
                      >
                        {db.status}
                      </span>

                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* ── Map / Processing Banner ── */}
<section>
  <SectionLabel icon="🗺️" text="Delivery Location" />

  {delivery.status === "service_done" || delivery.status === "given_to_shops" ? (
    <div style={{
      borderRadius: "var(--radius-xl)",
      border: "1px solid rgba(245,158,11,.25)",
      background: "linear-gradient(135deg, rgba(245,158,11,.08) 0%, rgba(234,179,8,.06) 100%)",
      padding: "32px 24px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16,
      textAlign: "center",
    }}>
      {/* Animated icons row */}
      <div style={{ display: "flex", gap: 12, fontSize: 36 }}>
        <span style={{ animation: "uoBounce 1.4s ease-in-out infinite" }}>👕</span>
        <span style={{ animation: "uoBounce 1.4s ease-in-out .2s infinite" }}>✨</span>
        <span style={{ animation: "uoBounce 1.4s ease-in-out .4s infinite" }}>🧺</span>
      </div>

      {/* Title */}
      <div style={{
        fontWeight: 800,
        fontSize: "var(--text-lg)",
        color: "#f59e0b",
        letterSpacing: ".2px",
      }}>
        Under Processing at Store
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: "var(--text-sm)",
        color: "var(--text-tertiary)",
        maxWidth: 300,
        lineHeight: 1.6,
      }}>
        Your items are being expertly cleaned and pressed. We'll notify you as soon as they're ready! 🌟
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#f59e0b",
              animation: `uoPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  ) : (
    <>
     <DeliveryMap
  coordinates={delivery.userLocation.coordinates}
  deliveryBoyCoordinates={liveBoyCoords}
  status={delivery.status}
  showRoute={
    delivery.status === "started" ||
    delivery.status === "collected_from_user" ||
    delivery.status === "collected_from_shops"
  }
  shops={
    delivery.status === "collected_from_user"
      ? Object.values(
          (delivery.services || []).reduce((acc, svc) => {
            const sid = svc.shop._id;
            if (!acc[sid] && (svc.shop as any).location?.coordinates) {
              acc[sid] = {
                shopId: sid,
                coordinates: (svc.shop as any).location.coordinates as [number, number],
                name: svc.shop.name,
              };
            }
            return acc;
          }, {} as Record<string, { shopId: string; coordinates: [number, number]; name: string }>)
        )
      : undefined
  }
/>
      <div style={{
        marginTop: 8, padding: "8px 12px",
        background: "var(--bg-page)", borderRadius: "var(--radius-md)",
        fontSize: "var(--text-xs)", color: "var(--text-tertiary)",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ color: "var(--cyan-500)" }}>⊕</span>
        {delivery.userLocation.coordinates[1].toFixed(6)},{" "}
        {delivery.userLocation.coordinates[0].toFixed(6)}
      </div>
    </>
  )}
</section>

          {/* ── Services Grouped By Shop ── */}
          <section>

            <SectionLabel
              icon="🧺"
              text={`Shops (${Object.keys(groupedServices).length})`}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >

              {Object.values(groupedServices).map((group, index) => (

                <div
                  key={group.shop._id || index}
                  style={{
                    background: "var(--bg-page)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-xl)",
                    overflow: "hidden",
                  }}
                >

                  {/* ── Shop Header ── */}
                  <div
                    style={{
                      padding: "14px 16px",
                      borderBottom: "1px solid var(--border-subtle)",
                      background: "rgba(6,182,212,.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >

                    <div>
                      <div
                        style={{
                          fontWeight: 800,
                          color: "var(--text-primary)",
                          fontSize: "var(--text-sm)",
                        }}
                      >
                        🏪 {group.shop.name}
                      </div>

                      {group.shop.address && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {group.shop.address}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        fontWeight: 800,
                        color: "var(--cyan-400)",
                        fontSize: "var(--text-base)",
                        flexShrink: 0,
                      }}
                    >
                      ₹{group.total.toFixed(2)}
                    </div>

                  </div>

                  {/* ── Shop Services ── */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >

                    {group.services.map((svc, i) => (

                      <div
                        key={i}
                        style={{
                          padding: "14px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          borderBottom:
                            i !== group.services.length - 1
                              ? "1px solid var(--border-subtle)"
                              : "none",
                        }}
                      >

                        {/* Thumbnail */}
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
                              {svc.price.name
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Info */}
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
                            }}
                          >
                            <span
                              style={{
                                background:
                                  "rgba(6,182,212,.12)",
                                color: "var(--cyan-400)",
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              ×{svc.quantity}
                            </span>

                            <span
                              style={{
                                fontSize: 12,
                                color: "var(--text-tertiary)",
                              }}
                            >
                              ₹{svc.price.charge} each
                            </span>
                          </div>

                        </div>

                        {/* Price */}
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: "var(--text-base)",
                            color: "var(--text-primary)",
                            flexShrink: 0,
                          }}
                        >
                          ₹
                          {(
                            svc.price.charge *
                            svc.quantity
                          ).toFixed(2)}
                        </div>

                      </div>
                    ))}

                  </div>

                </div>
              ))}

            </div>

          </section>

          {/* ── Total ── */}
          <div style={{
            background: "var(--navy-900)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 18px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "var(--text-sm)" }}>
              Total Amount
            </span>
            <span style={{
              color: "var(--cyan-400)", fontWeight: 800, fontSize: "var(--text-xl)",
            }}>
              ₹{total.toFixed(2)}
            </span>
          </div>

          {/* Bottom spacing */}
          <div style={{ height: 12 }} />
        </div>
      </div>

      <style>{`
        @keyframes uoFadeIn   { from { opacity:0 } to { opacity:1 } }
        @keyframes uoScaleIn  { from { opacity:0; transform:translate(-50%,-50%) scale(0.94) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }
        @keyframes uoSpin     { to { transform:rotate(360deg) } }
        .leaflet-pane,.leaflet-control-container { z-index:1 !important; }
        .leaflet-top,.leaflet-bottom { z-index:2 !important; }
        @keyframes uoBounce {
  0%, 100% { transform: translateY(0) }
  50%       { transform: translateY(-8px) }
}
@keyframes uoPulse {
  0%, 100% { opacity: .3; transform: scale(1) }
  50%       { opacity: 1;  transform: scale(1.3) }
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

// ─── OrderCard (simple list card) ─────────────────────────────

function OrderCard({
  delivery,
  onClick,
}: {
  delivery: Delivery;
  onClick: () => void;
}) {
  const totalServices = delivery.services.length;
  const totalQuantity = delivery.services.reduce((acc, s) => acc + s.quantity, 0);
  const totalAmount = delivery.services.reduce((acc, s) => acc + s.price.charge * s.quantity, 0);

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
      {/* Header: Date & Status */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-tertiary)" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{
            fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 600,
          }}>
            {new Date(delivery.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            at{" "}
            {new Date(delivery.createdAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <StatusBadge status={delivery.status} />
      </div>

      {/* Services Summary */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        paddingTop: 12,
        borderTop: "1px solid var(--border-subtle)",
      }}>
        {/* Icon */}
        <div style={{
          width: 48, height: 48, borderRadius: "var(--radius-md)",
          background: "var(--cyan-500)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="var(--navy-900)" strokeWidth="2.5">
            <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8"/>
            <path d="M10 12v4M14 12v4"/>
          </svg>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700, color: "var(--text-primary)",
            fontSize: "var(--text-base)", marginBottom: 4,
          }}>
            {totalServices} Service{totalServices !== 1 ? "s" : ""}
          </div>
          <div style={{
            fontSize: "var(--text-sm)", color: "var(--text-tertiary)",
          }}>
            Total {totalQuantity} item{totalQuantity !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Amount & Arrow */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6,
          flexShrink: 0,
        }}>
          <span style={{
            fontWeight: 800, fontSize: "var(--text-lg)",
            color: "var(--cyan-400)",
          }}>
            ₹{totalAmount.toFixed(0)}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-tertiary)" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────

const UserOrders = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  useEffect(() => {
    (async () => {
      try {
        const data = await deliveryApi.getUserDeliveries();
        setDeliveries(data || []);
      } catch (err) {
        console.error("Failed to fetch deliveries:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredDeliveries =
    selectedStatus === "all"
      ? deliveries
      : deliveries.filter(
          (delivery) => delivery.status === selectedStatus
        );

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 14,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" stroke="var(--cyan-500)"
          strokeWidth="2" fill="none" style={{ animation: "uoSpin 1s linear infinite" }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
          Loading your orders…
        </span>
        <style>{`@keyframes uoSpin { to { transform:rotate(360deg) } }`}</style>
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
                <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              </svg>
            </div>
            <div>
              <h1 style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-2xl)", fontWeight: 700,
                color: "var(--text-primary)",
              }}>
                My Orders
              </h1>
              {deliveries.length > 0 && (
                <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 2 }}>
                  {deliveries.length} order{deliveries.length !== 1 ? "s" : ""} in total
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Status Filters ── */}
        <div
          style={{
            display: "flex",
            gap: 10,
            overflowX: "auto",
            paddingBottom: 6,
            marginBottom: 22,
          }}
        >
          {[
            { key: "all", label: "All" },
            { key: "started", label: "Started" },
            { key: "collected_from_user", label: "Collected" },
            { key: "given_to_shops", label: "At Shop" },
            { key: "service_done", label: "Service Done" },
            { key: "collected_from_shops", label: "Picked Up" },
            { key: "given_to_user", label: "Delivered" },
          ].map((item) => {
            const active = selectedStatus === item.key;

            return (
              <button
                key={item.key}
                onClick={() => setSelectedStatus(item.key)}
                style={{
                  border: active
                    ? "1px solid var(--cyan-500)"
                    : "1px solid var(--border-default)",
                  background: active
                    ? "rgba(6,182,212,.12)"
                    : "var(--bg-surface)",
                  color: active
                    ? "var(--cyan-400)"
                    : "var(--text-secondary)",
                  padding: "10px 14px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  transition: "all .15s ease",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* ── Empty State ── */}
        {filteredDeliveries.length === 0 ? (
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
              {selectedStatus === "all"
                ? "No Orders Yet"
                : "No Orders Found"}
            </div>
            <p style={{
              margin: 0, fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)", textAlign: "center",
            }}>
              {selectedStatus === "all"
                ? "You haven't placed any orders yet. Start exploring services!"
                : "No deliveries found for this status."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredDeliveries.map((delivery, i) => (
              <div
                key={delivery._id}
                style={{
                  animation: `uoFadeUp .3s ease both`,
                  animationDelay: `${i * 0.06}s`,
                }}
              >
                <OrderCard
                  delivery={delivery}
                  onClick={() => setSelectedDelivery(delivery)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {selectedDelivery && (
        <DetailModal
          delivery={selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
        />
      )}

      <style>{`
        @keyframes uoFadeUp {
          from { opacity:0; transform:translateY(12px) }
          to   { opacity:1; transform:translateY(0) }
        }
        @keyframes uoFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes uoScaleIn {
          from { opacity:0; transform:translate(-50%,-50%) scale(0.94) }
          to   { opacity:1; transform:translate(-50%,-50%) scale(1) }
        }
        @keyframes uoSpin    { to { transform:rotate(360deg) } }
      `}</style>
    </>
  );
};

export default UserOrders;