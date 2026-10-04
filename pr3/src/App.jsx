import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./Navbar";
import Catalog from "./Catalog";
import Cart from "./Cart";
import Checkout from "./Checkout";
import Login from "./Login";
import Register from "./Register";
import Profile from "./Profile";
import AdminLayout from "./AdminLayout";
import AdminCategories from "./AdminCategories";
import AdminCoupons from "./AdminCoupons";
import AdminCars from "./AdminCars";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import AdminUsers from "./AdminUsers";

function RequireUser({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.role === "admin") return <Navigate to="/admin" />;
  return children;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user || user.role !== "admin") return <Navigate to="/" />;
  return children;
}

function App() {
  const { theme } = useTheme();
  const style = {
    backgroundColor: theme === "light" ? "#ffffff" : "#1c1c1c",
    color: theme === "light" ? "#000000" : "#ffffff",
    minHeight: "100vh",
  };

  return (
    <div style={style}>
      <Navbar />
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/cart"
          element={
            <RequireUser>
              <Cart />
            </RequireUser>
          }
        />
        <Route
          path="/checkout"
          element={
            <RequireUser>
              <Checkout />
            </RequireUser>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireUser>
              <Profile />
            </RequireUser>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminCategories />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="cars" element={<AdminCars />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;