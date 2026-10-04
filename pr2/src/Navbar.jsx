import { NavLink } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import { useCart } from "./CartContext";

function Navbar() {
  const { theme, setTheme } = useTheme();
  const { cart } = useCart();
  const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function toggleTheme() {
    setTheme(theme === "light" ? "dark" : "light");
  }

  const textColor = theme === "light" ? "#000000" : "#ffffff";

  const linkStyle = ({ isActive }) => ({
    marginRight: "10px",
    color: textColor,
    fontWeight: isActive ? "bold" : "normal",
  });

  const buttonStyle = {
    backgroundColor: theme === "light" ? "#eeeeee" : "#444444",
    color: textColor,
  };

  return (
    <nav style={{ padding: "10px" }}>
      <NavLink to="/" end style={linkStyle}>Каталог</NavLink>
      <NavLink to="/cart" style={linkStyle}>Корзина ({itemsCount})</NavLink>
      <NavLink to="/login" style={linkStyle}>Вход</NavLink>
      <NavLink to="/dashboard" style={linkStyle}>Кабинет</NavLink>
      <button style={buttonStyle} onClick={toggleTheme}>
        {theme === "light" ? "Тёмная тема" : "Светлая тема"}
      </button>
    </nav>
  );
}

export default Navbar;