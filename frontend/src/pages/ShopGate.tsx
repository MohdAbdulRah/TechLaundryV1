import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { getToken, getUser } from "../utils/auth";
import { DashboardLayout } from "../components/DashboardLayout";
import CreateShop from "./CreateShop";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

type GateState = "loading" | "no-shop" | "has-shop";

// ── Minimal full-page loader ───────────────────────────────────────────────────
function FullPageLoader() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-page)",
      gap: 16,
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: "3px solid rgba(0,180,216,0.15)",
        borderTop: "3px solid var(--cyan-500)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <span style={{
        color: "var(--text-tertiary)",
        fontSize: 13,
        fontFamily: "var(--font-sans)",
      }}>
        Loading your shop…
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Bare CreateShop wrapper (no sidebar, no topbar) ───────────────────────────
// Gives a centered, full-page feel with just the header and form.
function BareCreateShop({ onCreated }: { onCreated: () => void }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-page)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "40px 16px",
    }}>
      {/* Brand strip at top */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 32,
        alignSelf: "flex-start",
        maxWidth: 680,
        width: "100%",
        margin: "0 auto 32px",
      }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "linear-gradient(135deg, var(--cyan-500), #8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 17,
          fontWeight: 800,
          color: "#fff",
          fontFamily: "var(--font-display)",
          flexShrink: 0,
        }}>
          M
        </div>
        <span style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          fontWeight: 800,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
        }}>
          MANRO
        </span>
      </div>

      {/* Welcome message */}
      <div style={{
        maxWidth: 680,
        width: "100%",
        margin: "0 auto 24px",
      }}>
        <div style={{
          background: "rgba(0,180,216,0.06)",
          border: "1px solid rgba(0,180,216,0.15)",
          borderRadius: "var(--radius-md)",
          padding: "14px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>👋</span>
          <div>
            <div style={{
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 3,
              fontFamily: "var(--font-sans)",
            }}>
              Welcome! Let's set up your shop.
            </div>
            <div style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              lineHeight: 1.6,
              fontFamily: "var(--font-sans)",
            }}>
              Your account is ready but you don't have a shop yet. Create one below to
              access your dashboard, manage prices, and receive orders.
            </div>
          </div>
        </div>
      </div>

      {/* The actual CreateShop form, constrained to 680px */}
      <div style={{ maxWidth: 680, width: "100%" }}>
        <CreateShop onCreated={onCreated} />
      </div>
    </div>
  );
}

// ── ShopGate ──────────────────────────────────────────────────────────────────
export default function ShopGate() {
  const [state,   setState]   = useState<GateState>("loading");
  const navigate              = useNavigate();
  const location              = useLocation();

  const checkShop = async () => {
    setState("loading");
    try {
      const res  = await fetch(`${BASE_URL}/api/shop/details`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      // 200 + success → has a shop
      if (res.ok && json.success) {
        setState("has-shop");
      } else {
        // 404 "No shop associated with this user" → no shop
        setState("no-shop");
      }
    } catch {
      setState("no-shop");
    }
  };

  useEffect(() => {
    checkShop();
  }, []);

  // After shop is created, re-check and redirect into the dashboard
  const handleCreated = () => {
    setState("loading");
    checkShop().then(() => {
      navigate("/shop-dashboard", { replace: true });
    });
  };

  if (state === "loading") return <FullPageLoader />;

  if (state === "no-shop") {
    return <BareCreateShop onCreated={handleCreated} />;
  }

  // Has a shop → render full dashboard layout with nested routes
  return (
    <DashboardLayout role="shopOwner">
      <Outlet />
    </DashboardLayout>
  );
}