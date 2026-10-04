import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import * as api from "./api";

function Profile() {
  const { user, setUser } = useAuth();
  const { theme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [email, setEmail] = useState(user.email);
  const [address, setAddress] = useState(user.address || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState("");

  const isLight = theme === "light";
  const textColor = isLight ? "#000000" : "#ffffff";
  const borderColor = isLight ? "#ddd" : "#444";
  const cardStyle = {
    maxWidth: "360px",
    margin: "40px auto",
    padding: "24px",
    borderRadius: "10px",
    border: `1px solid ${borderColor}`,
    boxShadow: isLight ? "0 2px 10px rgba(0,0,0,0.08)" : "0 2px 10px rgba(0,0,0,0.4)",
  };
  const historyStyle = {
    maxWidth: "500px",
    margin: "20px auto 40px",
    padding: "20px",
    borderRadius: "10px",
    border: `1px solid ${borderColor}`,
  };
  const inputStyle = { width: "100%", padding: "8px", boxSizing: "border-box", marginTop: "4px" };
  const labelStyle = { color: textColor, fontSize: "14px", display: "block", marginTop: "12px" };
  const btnStyle = {
    backgroundColor: isLight ? "#eeeeee" : "#444444",
    color: textColor,
    width: "100%",
    padding: "8px",
    marginTop: "18px",
  };

  useEffect(() => {
    api
      .getOrders(user.token)
      .then(setOrders)
      .catch((err) => setOrdersError(err.message));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!currentPassword) {
      setError("Введите текущий пароль для подтверждения");
      return;
    }
    try {
      const result = await api.updateProfile(user.token, currentPassword, email, password, address);
      setUser({ ...user, email: result.email, address: result.address });
      setMessage("Данные обновлены");
      setCurrentPassword("");
      setPassword("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={{ color: textColor, margin: 0, textAlign: "center" }}>Профиль</h2>
        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            Email
            <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label style={labelStyle}>
            Адрес доставки
            <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label style={labelStyle}>
            Новый пароль
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="оставьте пустым, если не меняете"
            />
          </label>
          <label style={labelStyle}>
            Текущий пароль
            <input
              style={inputStyle}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          {error && <p style={{ color: "#c0392b" }}>{error}</p>}
          {message && <p style={{ color: "#27ae60" }}>{message}</p>}
          <button type="submit" style={btnStyle}>Сохранить</button>
        </form>
      </div>

      <div style={historyStyle}>
        <h3 style={{ color: textColor, marginTop: 0 }}>История заказов</h3>
        {ordersError && <p style={{ color: "#c0392b" }}>{ordersError}</p>}
        {!ordersError && orders.length === 0 && <p style={{ color: textColor }}>Заказов пока нет</p>}
        {orders.map((order) => {
          const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
          return (
            <div key={order.id} style={{ borderBottom: `1px solid ${borderColor}`, padding: "8px 0", color: textColor }}>
              Заказ №{order.id} — {count} шт. на сумму {Math.round(order.total_after).toLocaleString("ru-RU")} ₽
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Profile;