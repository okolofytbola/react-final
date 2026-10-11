import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import StatusBanner from "./StatusBanner";
import Catalog from "./Catalog";
import Cart from "./Cart";
import Checkout from "./Checkout";
import Login from "./Login";
import Register from "./Register";
import ForgotPassword from "./ForgotPassword";
import Profile from "./Profile";
import AccessDenied from "./AccessDenied";
import AdminLayout from "./AdminLayout";
import AdminCategories from "./AdminCategories";
import AdminCoupons from "./AdminCoupons";
import AdminCars from "./AdminCars";
import AdminOrders from "./AdminOrders";
import AdminReviews from "./AdminReviews";
import AdminUsers from "./AdminUsers";
import { useAuth } from "./AuthContext";
import { isStaff } from "./utils";

function SessionCheck() {
  return <div className="page narrow"><p className="muted">Проверяем сессию…</p></div>;
}

function RequireUser({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <SessionCheck />;
  if (!user) return <Navigate to="/login" replace />;
  if (isStaff(user)) {
    return (
      <AccessDenied
        title="Доступ запрещён"
        message="Администратору и сотруднику недоступны корзина, адрес доставки и раздел «Мои заказы» — это разделы покупателя."
      />
    );
  }
  return children;
}

function RequireStaff({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <SessionCheck />;
  if (!isStaff(user)) return <AccessDenied />;
  return children;
}

function RequireAdmin({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <SessionCheck />;
  if (!user || user.role !== "admin") {
    return <AccessDenied title="Доступ запрещён" message="Этот раздел доступен только администратору магазина." />;
  }
  return children;
}

function App() {
  const { pathname } = useLocation();
  const inAdmin = pathname.startsWith("/admin");

  return (
    <div className="app">
      <StatusBanner />
      {!inAdmin && <Navbar />}
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/cart" element={<RequireUser><Cart /></RequireUser>} />
        <Route path="/checkout" element={<RequireUser><Checkout /></RequireUser>} />
        <Route path="/profile" element={<RequireUser><Profile /></RequireUser>} />
        <Route path="/admin" element={<RequireStaff><AdminLayout /></RequireStaff>}>
          <Route index element={<Navigate to="categories" replace />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="coupons" element={<RequireAdmin><AdminCoupons /></RequireAdmin>} />
          <Route path="cars" element={<AdminCars />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
