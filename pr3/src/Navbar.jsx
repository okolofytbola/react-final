import { NavLink } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";

function Navbar() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const textColor = theme === "light" ? "#000000" : "#ffffff";
  const linkStyle = ({ isActive }) => ({
    marginRight: "12px",
    color: textColor,
    fontWeight: isActive ? "bold" : "normal",
  });
  const btnStyle = {
    backgroundColor: theme === "light" ? "#eeeeee" : "#444444",
    color: textColor,
    marginLeft: "8px",
  };

  return (
    <nav style={{ padding: "10px", display: "flex", alignItems: "center", flexWrap: "wrap" }}>
      <NavLink to="/" end style={linkStyle}>Каталог</NavLink>
      {user && user.role !== "admin" && (
        <NavLink to="/cart" style={linkStyle}>Корзина ({itemsCount})</NavLink>
      )}
      {user && user.role === "admin" && <NavLink to="/admin" style={linkStyle}>Админка</NavLink>}
      {user && user.role !== "admin" && <NavLink to="/profile" style={linkStyle}>Профиль</NavLink>}
      {!user && <NavLink to="/login" style={linkStyle}>Вход</NavLink>}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
        {user && <span style={{ color: textColor, marginRight: "8px" }}>{user.fullName}</span>}
        {user && <button style={btnStyle} onClick={logout}>Выйти</button>}
        <button style={btnStyle} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? "Тёмная тема" : "Светлая тема"}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;