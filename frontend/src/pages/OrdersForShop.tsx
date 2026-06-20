import React, { useEffect, useState } from "react";
import { deliveryApi, shopApi } from "../utils/api";
import { useRef} from "react"; // already have useState/useEffect, add useRef
import { io } from "socket.io-client";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface DeliveryBoyEntry {
  deliveryBoy: {
    _id: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    location?: {           // ← ADD THIS
      type: "Point";
      coordinates: [number, number];
    };
  };
  order: number;
  status: "Pending" | "Done";
}

interface Service {
  serviceId: string;
  quantity: number;
  status: string;
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
    location?: {           // ← ADD THIS
      type: "Point";
      coordinates: [number, number]; // [lng, lat]
    };
  };
}

interface Delivery {
  deliveryId: string;

  deliveryStatus: string;

  deliveryBoys: DeliveryBoyEntry[];

  services: Service[];

  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Status Config
// ─────────────────────────────────────────────────────────────
const getEffectiveDeliveryStatus = (delivery: Delivery) => {
  if (delivery.services.length === 0) {
    return delivery.deliveryStatus;
  }

  const allCollectedFromShop = delivery.services.every(
    (s) => s.status === "collected_from_shop"
  );

  if (allCollectedFromShop) {
    return "collected_from_shop";
  }

  const allGivenToShop = delivery.services.every(
    (s) => s.status === "given_to_shop"
  );

  if (allGivenToShop) {
    return "given_to_shop";
  }

  return delivery.deliveryStatus;
};
const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; dot: string }
> = {
  started: {
    label: "Started",
    color: "#60a5fa",
    bg: "rgba(96,165,250,.12)",
    dot: "#60a5fa",
  },
  collected_from_user: {
    label: "Collected From User",
    color: "#a78bfa",
    bg: "rgba(167,139,250,.12)",
    dot: "#a78bfa",
  },
  given_to_shop: {
    label: "At Shop",
    color: "#f59e0b",
    bg: "rgba(245,158,11,.12)",
    dot: "#f59e0b",
  },
  service_done: {
    label: "Service Done",
    color: "#34d399",
    bg: "rgba(52,211,153,.12)",
    dot: "#34d399",
  },
  collected_from_shop: {
    label: "Collected From Shop",
    color: "#06b6d4",
    bg: "rgba(6,182,212,.12)",
    dot: "#06b6d4",
  },
  given_to_user: {
    label: "Delivered",
    color: "#4ade80",
    bg: "rgba(74,222,128,.12)",
    dot: "#4ade80",
  },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    color: "#94a3b8",
    bg: "rgba(148,163,184,.12)",
    dot: "#94a3b8",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: meta.bg,
        color: meta.color,
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: meta.dot,
        }}
      />
      {meta.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail Modal
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Shop Delivery Map  (delivery boy → shop)
// ─────────────────────────────────────────────────────────────
function ShopDeliveryMap({
  shopCoordinates,
  deliveryBoyCoordinates,
  shopName,
}: {
  shopCoordinates: [number, number];   // [lng, lat]
  deliveryBoyCoordinates?: [number, number];
  shopName: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const dbMarkerRef = useRef<L.Marker | null>(null);
  const routingRef = useRef<any>(null);

  // ── Init map once ──────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const [lng, lat] = shopCoordinates;

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

    // Shop pin
    const shopIcon = L.divIcon({
      className: "",
      html: `<div style="
        width:40px;height:40px;
        background:#f59e0b;
        border:3px solid #fff;
        border-radius:8px;
        display:flex;align-items:center;justify-content:center;
        font-size:18px;
        box-shadow:0 4px 18px rgba(245,158,11,.7);
      ">🏪</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    L.marker([lat, lng], { icon: shopIcon })
      .addTo(mapInstance.current)
      .bindPopup(shopName)
      .openPopup();

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
      dbMarkerRef.current = null;
      routingRef.current = null;
    };
  }, []);

  // ── Reactive: delivery boy position ticks ─────────────────
  useEffect(() => {
    if (!mapInstance.current || !deliveryBoyCoordinates) return;

    const [dbLng, dbLat] = deliveryBoyCoordinates;
    const [shopLng, shopLat] = shopCoordinates;

    // Delivery boy marker — create once, move on every tick
    const dbIcon = L.divIcon({
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
      dbMarkerRef.current = L.marker([dbLat, dbLng], { icon: dbIcon })
        .addTo(mapInstance.current!)
        .bindPopup("Delivery Boy");
    } else {
      dbMarkerRef.current.setLatLng([dbLat, dbLng]);
    }

    // Routing — create once, update waypoints on every tick
    const waypoints = [
      L.latLng(dbLat, dbLng),
      L.latLng(shopLat, shopLng),
    ];

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
      L.latLngBounds([[dbLat, dbLng], [shopLat, shopLng]]),
      { padding: [40, 40] }
    );
  }, [deliveryBoyCoordinates]);

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
function DetailModal({
  delivery,
  onClose,
}: {
  delivery: Delivery;
  onClose: () => void;
}) {
  const [otpData, setOtpData] = useState<{
  otp: number;
  createdAt: string;
} | null>(null);
const [updatingServiceId, setUpdatingServiceId] =
  useState<string | null>(null);
const [assigningDeliveryBoy, setAssigningDeliveryBoy] =
  useState(false);
const [, forceUpdate] = useState({});

useEffect(() => {

  // ─────────────────────────────────────────────
  // Existing OTP (Collected From User)
  // ─────────────────────────────────────────────

  if (
    delivery.deliveryStatus ===
    "collected_from_user"
  ) {

    (async () => {

      try {

        const response =
          await shopApi.getOtpCollectedFromUser({
            deliveryId: delivery.deliveryId,
          });

        if (response?.otp) {

          setOtpData({
            otp: response.otp,
            createdAt: response.createdAt,
          });

        }

      } catch (err) {

        console.log(err);

      }

    })();

  }

  // ─────────────────────────────────────────────
  // OTP For Collection From Shop
  // ─────────────────────────────────────────────

  const allServicesDone =
    delivery.services.length > 0 &&
    delivery.services.every(
      (service) =>
        service.status === "service_done"
    );

  if (allServicesDone) {

    (async () => {

      try {

        const response =
          await shopApi.getValidOtpForCollectionFromShop(
            delivery.deliveryId
          );

        if (response?.otp) {

          setOtpData({
            otp: response.otp,
            createdAt: response.createdAt,
          });

        }

      } catch (err) {

        // no otp yet

        console.log(err);

      }

    })();

  }

}, [
  delivery.deliveryId,
  delivery.deliveryStatus,
  delivery.services,
]);
 // ── Determine if order:1 delivery boy is en-route to shop ──
const order1Boy = delivery.deliveryBoys.find(
  (db) => db.order === 1 && db.status === "Pending"
);

const showReturnMap =
  delivery.deliveryStatus === "service_done" && !!order1Boy;

// Live coordinates for order:1 boy
const [liveBoyCoords, setLiveBoyCoords] = useState<[number, number] | undefined
>(order1Boy?.deliveryBoy?.location?.coordinates);

// ── Socket.IO — track order:1 boy while returning to shop ──
useEffect(() => {
  if (!showReturnMap) return;

  const socket = io(BASE_URL);
  socket.emit("join-delivery", delivery.deliveryId);

  socket.on(
    "delivery-live-location",
    ({
      deliveryId,
      coordinates,
    }: {
      deliveryId: string;
      coordinates: [number, number];
    }) => {
      if (deliveryId === delivery.deliveryId) {
        setLiveBoyCoords(coordinates);
      }
    }
  );

  return () => { socket.disconnect(); };
}, [delivery.deliveryId, showReturnMap]);

// Pick the first shop that has location coords
const shopWithLocation = delivery.services.find(
  (s) => s.shop?.location?.coordinates
)?.shop;
  const total = delivery.services.reduce(
    (acc, s) => acc + s.price.charge * s.quantity,
    0
  );

  const markServiceDone = async (
  serviceId: string
) => {
  try {

    setUpdatingServiceId(serviceId);

    await shopApi.markServiceDone({
      deliveryId: delivery.deliveryId,
      serviceId,
    });

    // Update local UI instantly

    delivery.services = delivery.services.map(
      (service) => {

        if (service.serviceId === serviceId) {

          return {
            ...service,
            status: "service_done",
          };

        }

        return service;

      }
    );

    // If all services done → update delivery status

    const allDone = delivery.services.every(
      (service) =>
        service.status === "service_done"
    );

    if (allDone) {

      delivery.deliveryStatus = "service_done";

    }

    // force rerender

    setOtpData((prev) =>
      prev ? { ...prev } : null
    );
    forceUpdate({});

  } catch (err) {

    console.log(err);

  } finally {

    setUpdatingServiceId(null);

  }
};
const assignDeliveryBoy = async () => {
  try {

    setAssigningDeliveryBoy(true);

    const response =
      await shopApi.assignDeliveryBoy({
        deliveryId: delivery.deliveryId,
      });

    if (response) {

      delivery.deliveryBoys.push({
        deliveryBoy: response.deliveryBoy,
        order: response.order,
        status: response.status,
      });

      // rerender

      setOtpData((prev) =>
        prev ? { ...prev } : null
      );

    }

  } catch (err) {

    console.log(err);

  } finally {

    setAssigningDeliveryBoy(false);

  }
};
const allServicesDone =
  delivery.services.length > 0 &&
  delivery.services.every(
    (service) =>
      service.status === "service_done"
  );

const order2Exists =
  delivery.deliveryStatus === "marked_for_delivery" ||
  delivery.deliveryBoys.some(
    (d) => d.order === 1 && d.status === "Pending"
  );

  
  return (
    <>
      {/* Backdrop */}

      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.65)",
          backdropFilter: "blur(4px)",
          zIndex: 100,
        }}
      />

      {/* Modal */}

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(680px, calc(100vw - 30px))",
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          zIndex: 101,
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "0 24px 80px rgba(0,0,0,.5)",
        }}
      >
        {/* Header */}

        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            background: "var(--bg-surface)",
            zIndex: 10,
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "var(--text-xl)",
                color: "var(--text-primary)",
              }}
            >
              Delivery Details
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "var(--text-tertiary)",
              }}
            >
              {new Date(delivery.createdAt).toLocaleString()}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {allServicesDone &&
  !order2Exists && (
    <button
      onClick={assignDeliveryBoy}
      disabled={assigningDeliveryBoy}
      style={{
        border: "none",
        background: "#06b6d4",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: 12,
        fontWeight: 700,
        cursor: "pointer",
        opacity: assigningDeliveryBoy
          ? 0.7
          : 1,
      }}
    >
      {assigningDeliveryBoy
        ? "Assigning..."
        : "Add Delivery Boy"}
    </button>
  )}
            <StatusBadge
  status={
   getEffectiveDeliveryStatus(delivery)
  }
/>

            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: "1px solid var(--border-default)",
                background: "transparent",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: 18,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}

        <div
          style={{
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          {/* Delivery Boys */}

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
                  gap: 10,
                }}
              >
                {delivery.deliveryBoys.map((db, index) => (
                  <div
                    key={index}
                    style={{
                      background: "var(--bg-page)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-lg)",
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {db.deliveryBoy.firstName}{" "}
                        {db.deliveryBoy.lastName ?? ""}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: "var(--text-tertiary)",
                        }}
                      >
                        📞 {db.deliveryBoy.phone}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: "var(--text-tertiary)",
                        }}
                      >
                        Order #{db.order + 1}
                      </div>
                    </div>

                    <StatusBadge status={db.status} />
                  </div>
                ))}
              </div>
            </section>
          )}
          {/* OTP */}

{otpData && (
  <section>

    <SectionLabel
      icon="🔐"
      text="Collection OTP"
    />

    <div
      style={{
        background: "rgba(6,182,212,.08)",
        border: "1px solid rgba(6,182,212,.22)",
        borderRadius: "var(--radius-xl)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "center",
        justifyContent: "center",
      }}
    >

      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".8px",
          color: "var(--text-tertiary)",
        }}
      >
        OTP Code
      </div>

      <div
        style={{
          fontSize: 42,
          fontWeight: 900,
          letterSpacing: "10px",
          color: "var(--cyan-400)",
          lineHeight: 1,
        }}
      >
        {otpData.otp}
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
{/* ── Return Map: delivery boy → shop ── */}
{showReturnMap && shopWithLocation?.location && (
  <section>
    <SectionLabel icon="🗺️" text="Returning to Shop" />
    <ShopDeliveryMap
      shopCoordinates={shopWithLocation.location.coordinates}
      deliveryBoyCoordinates={liveBoyCoords}
      shopName={shopWithLocation.name}
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
      <span style={{ color: "#22c55e" }}>●</span>
      Delivery boy is on the way to collect completed items
    </div>

    <style>{`
      .leaflet-pane,.leaflet-control-container { z-index:1 !important; }
      .leaflet-top,.leaflet-bottom { z-index:2 !important; }
    `}</style>
  </section>
)}
          {/* Services */}

          <section>
            <SectionLabel
              icon="🧺"
              text={`Services (${delivery.services.length})`}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {delivery.services.map((service) => (
                <div
                  key={service.serviceId}
                  style={{
                    background: "var(--bg-page)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                  }}
                >
                  {/* Left */}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    {/* Image */}

                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        overflow: "hidden",
                        background: "var(--navy-800)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {service.price.picture ? (
                        <img
                          src={service.price.picture}
                          alt={service.price.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            color: "#fff",
                            fontWeight: 800,
                          }}
                        >
                          {service.price.name
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Info */}

                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {service.price.name}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          color: "var(--text-tertiary)",
                          fontSize: "var(--text-sm)",
                        }}
                      >
                        Quantity: {service.quantity}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <StatusBadge status={service.status} />
                      </div>
                    </div>
                  </div>

               
                  {/* Right Side */}

<div
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 10,
    flexShrink: 0,
  }}
>
  {/* Price */}

  <div
    style={{
      fontWeight: 800,
      color: "var(--cyan-400)",
      fontSize: "var(--text-lg)",
    }}
  >
    ₹
    {(
      service.quantity * service.price.charge
    ).toFixed(0)}
  </div>

  {/* Mark Done Button */}

  {service.status === "given_to_shop" && (
    <button
      onClick={() =>
        markServiceDone(service.serviceId)
      }
      disabled={
        updatingServiceId ===
        service.serviceId
      }
      style={{
        border: "none",
        background: "#10b981",
        color: "#fff",
        padding: "8px 14px",
        borderRadius: 10,
        fontWeight: 700,
        cursor: "pointer",
        opacity:
          updatingServiceId ===
          service.serviceId
            ? 0.7
            : 1,
      }}
    >
      {updatingServiceId ===
      service.serviceId
        ? "Updating..."
        : "Mark Done"}
    </button>
  )}
</div>
                </div>
              ))}
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
              }}
            >
              Total Amount
            </span>

            <span
              style={{
                color: "var(--cyan-400)",
                fontWeight: 900,
                fontSize: "var(--text-xl)",
              }}
            >
              ₹{total.toFixed(0)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Section Label
// ─────────────────────────────────────────────────────────────

function SectionLabel({
  icon,
  text,
}: {
  icon: string;
  text: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
      }}
    >
      <span>{icon}</span>

      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {text}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Order Card
// ─────────────────────────────────────────────────────────────

function OrderCard({
  delivery,
  onClick,
}: {
  delivery: Delivery;
  onClick: () => void;
}) {
  const totalServices = delivery.services.length;

  const totalQuantity = delivery.services.reduce(
    (acc, s) => acc + s.quantity,
    0
  );

  const totalAmount = delivery.services.reduce(
    (acc, s) => acc + s.price.charge * s.quantity,
    0
  );

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xl)",
        padding: "18px 20px",
        cursor: "pointer",
      }}
    >
      {/* Top */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
            }}
          >
            {new Date(delivery.createdAt).toLocaleDateString()}
          </div>

          <div
            style={{
              marginTop: 6,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {totalServices} Service
            {totalServices !== 1 ? "s" : ""}
          </div>
        </div>

        <StatusBadge
  status={
    getEffectiveDeliveryStatus(delivery)
  }
/>
      </div>

      {/* Bottom */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 14,
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            color: "var(--text-tertiary)",
            fontSize: "var(--text-sm)",
          }}
        >
          {totalQuantity} item
          {totalQuantity !== 1 ? "s" : ""}
        </div>

        <div
          style={{
            fontWeight: 900,
            fontSize: "var(--text-xl)",
            color: "var(--cyan-400)",
          }}
        >
          ₹{totalAmount.toFixed(0)}
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

const OrdersForShop = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDelivery, setSelectedDelivery] =
    useState<Delivery | null>(null);
  
    const [activeFilter, setActiveFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      try {
        const data =
          await shopApi.getShopDeliveries();

        setDeliveries(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-page)",
          color: "var(--text-tertiary)",
        }}
      >
        Loading shop orders...
      </div>
    );
  }
  const uniqueStatuses = Array.from(
  new Set(deliveries.map((d) => getEffectiveDeliveryStatus(d)))
);

const filteredDeliveries =
  activeFilter === "all"
    ? deliveries
    : deliveries.filter(
        (d) => getEffectiveDeliveryStatus(d) === activeFilter
      );
  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          margin: "0 auto",
        }}
      >
        {/* Header */}
<div style={{ marginBottom: 24 }}>
  <h1
    style={{
      margin: 0,
      fontSize: "var(--text-2xl)",
      fontWeight: 800,
      color: "var(--text-primary)",
    }}
  >
    Shop Orders
  </h1>

  <p style={{ marginTop: 6, color: "var(--text-tertiary)" }}>
    {filteredDeliveries.length} of {deliveries.length} order
    {deliveries.length !== 1 ? "s" : ""}
  </p>

  {/* Filter Chips */}
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 16,
    }}
  >
    {["all", ...uniqueStatuses].map((status) => {
      const isActive = activeFilter === status;
      const meta = STATUS_META[status] ?? {
        label: "All",
        color: "#94a3b8",
        bg: "rgba(148,163,184,.12)",
        dot: "#94a3b8",
      };
      const label =
        status === "all" ? "All" : meta.label;
      const count =
        status === "all"
          ? deliveries.length
          : deliveries.filter(
              (d) => getEffectiveDeliveryStatus(d) === status
            ).length;

      return (
        <button
          key={status}
          onClick={() => setActiveFilter(status)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            border: isActive
              ? `1.5px solid ${status === "all" ? "#94a3b8" : meta.color}`
              : "1.5px solid var(--border-default)",
            background: isActive
              ? status === "all"
                ? "rgba(148,163,184,.15)"
                : meta.bg
              : "transparent",
            color: isActive
              ? status === "all"
                ? "#94a3b8"
                : meta.color
              : "var(--text-tertiary)",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all .15s",
          }}
        >
          {isActive && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  status === "all" ? "#94a3b8" : meta.dot,
                flexShrink: 0,
              }}
            />
          )}
          {label}
          <span
            style={{
              background: isActive
                ? status === "all"
                  ? "rgba(148,163,184,.25)"
                  : `${meta.color}25`
                : "var(--border-subtle)",
              color: isActive
                ? status === "all"
                  ? "#94a3b8"
                  : meta.color
                : "var(--text-tertiary)",
              borderRadius: 999,
              padding: "1px 7px",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {count}
          </span>
        </button>
      );
    })}
  </div>
</div>

        {/* Empty */}

        {deliveries.length === 0 ? (
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xl)",
              padding: "60px 30px",
              textAlign: "center",
              color: "var(--text-tertiary)",
            }}
          >
            No Orders Found
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {filteredDeliveries.map((delivery) => (
              <OrderCard
                key={delivery.deliveryId}
                delivery={delivery}
                onClick={() =>
                  setSelectedDelivery(delivery)
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}

      {selectedDelivery && (
        <DetailModal
          delivery={selectedDelivery}
          onClose={() =>
            setSelectedDelivery(null)
          }
        />
      )}
    </>
  );
};

export default OrdersForShop;