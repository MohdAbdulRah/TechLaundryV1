import React, { useEffect, useMemo, useState } from "react";
import { deliveryApi } from "../utils/api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface DeliveryBoyEntry {
  _id: string;
  deliveryBoy: {
    _id: string;
    firstName: string;
    lastName?: string;
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
    };
  }[];
  createdAt: string;
}

// ─────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  given_to_shop: {
    label: "Given To Shop",
    color: "#f59e0b",
    bg: "rgba(245,158,11,.12)",
  },
  given_to_user: {
    label: "Given To User",
    color: "#22c55e",
    bg: "rgba(34,197,94,.12)",
  },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || {
    label: status,
    color: "#94a3b8",
    bg: "rgba(148,163,184,.12)",
  };

  return (
    <span
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        background: meta.bg,
        color: meta.color,
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: ".5px",
      }}
    >
      {meta.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Toggle Button
// ─────────────────────────────────────────────

function ToggleButton({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={expanded ? "Collapse card" : "Expand card"}
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        border: "1.5px solid var(--border-default)",
        background: expanded ? "var(--cyan-500)" : "var(--bg-page)",
        color: expanded ? "#000" : "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.2s, color 0.2s, transform 0.2s",
        transform: expanded ? "rotate(45deg)" : "rotate(0deg)",
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1,
        padding: 0,
      }}
    >
      +
    </button>
  );
}

// ─────────────────────────────────────────────
// Delivery Card
// ─────────────────────────────────────────────

function DeliveryCard({ delivery }: { delivery: Delivery }) {
  const [expanded, setExpanded] = useState(false);

  const total = delivery.services.reduce(
    (acc, item) => acc + item.quantity * item.price.charge,
    0
  );

  const currentDoneBoy = delivery.deliveryBoys.find((b) => b.status === "Done");

  const actionText =
    currentDoneBoy?.order === 0
      ? "Transferred clothes from User to Shop"
      : "Transferred clothes from Shop to User";

  const actionStatus =
    currentDoneBoy?.order === 0 ? "given_to_shop" : "given_to_user";

  const fullName = `${delivery.user.firstName}${delivery.user.lastName ? " " + delivery.user.lastName : ""}`;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}
    >
      {/* ── Collapsed Header (always visible) ── */}
      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          cursor: "pointer",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Avatar */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--cyan-500)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            color: "#000",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {delivery.user.firstName[0].toUpperCase()}
        </div>

        {/* Name + date */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              color: "var(--text-primary)",
              fontSize: "var(--text-base)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {fullName}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
            {new Date(delivery.createdAt).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </div>
        </div>

        {/* Status badge (visible when collapsed) */}
        {!expanded && (
          <StatusBadge status={actionStatus} />
        )}

        {/* Toggle */}
        <ToggleButton
          expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        />
      </div>

      {/* ── Expanded Content ── */}
      {expanded && (
        <div
          style={{
            padding: "0 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: 18,
          }}
        >
          {/* Address & Phone */}
          {(delivery.user.address || delivery.user.phone) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {delivery.user.address && (
                <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                  📍 {delivery.user.address}
                </div>
              )}
              {delivery.user.phone && (
                <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                  📞 {delivery.user.phone}
                </div>
              )}
            </div>
          )}

          {/* Status + date row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <StatusBadge status={actionStatus} />
          </div>

          {/* Action */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "var(--radius-lg)",
              background: "rgba(6,182,212,.08)",
              border: "1px solid rgba(6,182,212,.2)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--cyan-400)",
                textTransform: "uppercase",
                letterSpacing: ".5px",
                marginBottom: 8,
              }}
            >
              Work Done
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {actionText}
            </div>
          </div>

          {/* Services */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {delivery.services.map((service) => (
              <div
                key={service._id}
                style={{
                  background: "var(--bg-page)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "var(--radius-md)",
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
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: 22 }}>{service.price.icon || "🧺"}</span>
                    )}
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                      {service.price.name}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-tertiary)" }}>
                      🏪 {service.shop.name}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 12, color: "var(--text-tertiary)" }}>
                      Qty: {service.quantity}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontWeight: 800,
                    color: "var(--cyan-400)",
                    fontSize: "var(--text-base)",
                  }}
                >
                  ₹{(service.quantity * service.price.charge).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 10,
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>Total</span>
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
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

const DoneDeliveries = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await deliveryApi.getDoneDeliveries();
        setDeliveries(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sortedDeliveries = useMemo(() => {
    return [...deliveries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [deliveries]);

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
        Loading completed deliveries...
      </div>
    );
  }

  if (sortedDeliveries.length === 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-page)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xl)",
            padding: "50px 40px",
            textAlign: "center",
            maxWidth: 420,
            width: "100%",
          }}
        >
          <div style={{ fontSize: 54 }}>📦</div>
          <h2 style={{ marginTop: 16, marginBottom: 8, color: "var(--text-primary)" }}>
            No Done Deliveries
          </h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14, margin: 0 }}>
            Completed delivery history will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: 850, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              margin: 0,
              color: "var(--text-primary)",
              fontSize: "var(--text-2xl)",
              fontWeight: 800,
            }}
          >
            Done Deliveries
          </h1>
          <p style={{ marginTop: 8, color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            {sortedDeliveries.length} completed delivery
            {sortedDeliveries.length !== 1 ? "ies" : "y"}
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {sortedDeliveries.map((delivery) => (
            <DeliveryCard key={delivery._id} delivery={delivery} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DoneDeliveries;