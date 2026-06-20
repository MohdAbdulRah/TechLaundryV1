import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ShopOwnerSignupPage from './pages/ShopOwnerSignupPage';
import {AdminDashboard, Unauthorized} from './pages/Dashboards';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboardOverview } from './pages/AdminDashboardOverview';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './components/DashboardLayout';
import PricesPage from './pages/PricesPage';
import './App.css';
import PricesUser from './pages/PricesUser';
import PredictPrices from './pages/PredictPrices';
import CartPage from './pages/CartPage';
import CategoriesPage from './pages/CategoriesPage';
import DeliveryDashboard from './pages/DeliveryDashboard';
import UserOrders from './pages/UserOrders';
import AIChatPage from './pages/AIChatPage';
import OrdersForShop from './pages/OrdersForShop';
import DoneDeliveries from './pages/DoneDeliveries';
import UserProfile from './pages/UserProfile';
import DeliveryBoySignupPage from './pages/DeliveryBoySignupPage';
import ShopOverview from './pages/ShopOverview';
import ShopDetails from './pages/ShopDetails';
import ShopGate from './pages/ShopGate';
import ShopOwnerProfile from './pages/ShopOwnerProfile';
import DeliveryBoyProfile from './pages/DeliveryBoyProfile';
import AllShops from './pages/AllShops';
import AllUsers from './pages/AllUsers';

// ─── Layout route wrappers ────────────────────────────────────────────────────
// These live here so individual pages stay layout-free.
// Each one renders <DashboardLayout role="…" /> which internally renders <Outlet />,
// passing control down to whichever child route matches.

function UserLayoutRoute() {
  return <DashboardLayout role="user" />;
}

function ShopLayoutRoute() {
  return <DashboardLayout role="shopOwner" />;
}

function AdminLayoutRoute() {
  return <DashboardLayout role="admin" />;
}
function DeliveryLayoutRoute() {
  return <DashboardLayout role="deliveryBoy" />;
}
// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Guest-only routes ──────────────────────────────────────────── */}
        <Route path="/login"             element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/signup"            element={<GuestRoute><SignupPage /></GuestRoute>} />
        <Route path="/signup/shop-owner" element={<GuestRoute><ShopOwnerSignupPage /></GuestRoute>} />
        <Route path="/signup/delivery-boy" element={<GuestRoute><DeliveryBoySignupPage /></GuestRoute>} />

        {/* ── User dashboard ─────────────────────────────────────────────── */}
        {/*
          ProtectedRoute guards the entire subtree.
          UserLayoutRoute renders the sidebar + <Outlet />.
          Child routes render their page content inside the layout.
        */}
        <Route
          element={
            <ProtectedRoute roles={['user']}>
              <UserLayoutRoute />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path='/user/prices' element={<PricesUser />} />
          <Route path='/predict/prices' element={<PredictPrices />} />
          <Route path='/cart' element={<CartPage />} />
          <Route path='/orders' element={<UserOrders />} />
          <Route path='/chat-user' element={<AIChatPage />} />
          <Route path="/dashboard/userProfile" element={<UserProfile />} />
          {/* Add more user pages here — they all get the sidebar automatically:
              <Route path="/dashboard/profile" element={<UserProfile />} />
          */}
        </Route>

        {/* ── Shop owner dashboard ───────────────────────────────────────── */}
        <Route
          element={
            <ProtectedRoute roles={['shopOwner']}>
              <ShopGate />
            </ProtectedRoute>
          }
        >
          <Route path="/shop-dashboard"          element={<ShopOverview />} />
          <Route path="/shop-dashboard/shop"   element={<ShopDetails />} />
          <Route path="/shop-dashboard/prices" element={<PricesPage />} />
          <Route path="/shop/orders" element={<OrdersForShop />} />
          <Route path="/shop/owner/profile" element={<ShopOwnerProfile />} />
        </Route>

        {/* ── Admin dashboard ────────────────────────────────────────────── */}
        <Route
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminLayoutRoute />
            </ProtectedRoute>
          }
        >
          <Route path="/admin-dashboard"           element={<AdminDashboardOverview />} />
          <Route path="/categories"           element={<CategoriesPage />} />
          <Route path="/admin-dashboard/users"  element={<AllUsers />} />
          <Route path="/admin-dashboard/shops"  element={<AllShops />} />
        </Route>
        
        <Route
          element={
            <ProtectedRoute roles={['deliveryBoy']}>
              <DeliveryLayoutRoute />
            </ProtectedRoute>
          }
        >
          <Route
            path="/delivery-dashboard"
            element={<DeliveryDashboard />}
          />

        
          <Route
            path="/delivery-dashboard/done-delieveries"
            element={<DoneDeliveries />}
          />
          <Route
            path="/delivery-dashboard/profile"
            element={<DeliveryBoyProfile />}
          />
        </Route>
        {/* ── Misc ───────────────────────────────────────────────────────── */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/"             element={<Navigate to="/login" replace />} />
        <Route path="*"             element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}