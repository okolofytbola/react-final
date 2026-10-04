import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";

function AdminLayout() {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const isLight = theme === "light";
  const textColor = isLight ? "#000000" : "#ffffff";
  const sidebarBg = isLight ? "#f5f5f5" : "#242424";
  const borderColor = isLight ? "#ddd" : "#444";

  const linkStyle = ({ isActive }) => ({
    display: "block",
    padding: "10px 14px",
    borderRadius: "6px",
    color: textColor,
    marginBottom: "6px",
    backgroundColor: isActive ? (isLight ? "#ffffff" : "#3a3a3a") : "transparent",
    fontWeight: isActive ? "bold" : "normal",
    boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
  });

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 56px)" }}>
      <aside style={{ width: "220px", backgroundColor: sidebarBg, padding: "16px", borderRight: `1px solid ${borderColor}` }}>
        <p style={{ color: textColor, fontWeight: "bold", marginTop: 0 }}>Админ-панель</p>
        <p style={{ color: textColor, fontSize: "13px", opacity: 0.7, marginTop: "-8px" }}>{user.fullName}</p>
        <NavLink to="/admin/categories" style={linkStyle}>Категории</NavLink>
        <NavLink to="/admin/coupons" style={linkStyle}>Купоны</NavLink>
        <NavLink to="/admin/cars" style={linkStyle}>Товары и скидки</NavLink>
        <NavLink to="/admin/users" style={linkStyle}>Пользователи</NavLink>
        <button onClick={logout} style={{ marginTop: "20px", width: "100%", padding: "8px" }}>Выйти</button>
      </aside>
      <div style={{ flex: 1, padding: "24px" }}>
        <Outlet />
      </div>
    </div>
  );
}

export default AdminLayout;