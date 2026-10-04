import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "./CartContext";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import * as api from "./api";

function Cart() {
  const { cart, loading, error, changeQuantity, removeItem, reloadCart } = useCart();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [checkoutError, setCheckoutError] = useState("");
  const [address, setAddress] = useState(user.address || "");

  const textColor = theme === "light" ? "#000000" : "#ffffff";
  const btnStyle = { backgroundColor: theme === "light" ? "#eeeeee" : "#444444", color: textColor };

  const totalBefore = cart.reduce((sum, item) => sum + item.priceBefore, 0);
  const totalAfter = cart.reduce((sum, item) => sum + item.priceAfter, 0);

  async function handleCheckout() {
    setCheckoutError("");
    try {
      const order = await api.checkout(user.token, address);
      reloadCart();
      navigate("/checkout", { state: { order } });
    } catch (err) {
      setCheckoutError(err.message);
    }
  }

  return (
    <div style={{ padding: "10px" }}>
      <h1 style={{ color: textColor }}>Корзина</h1>
      {loading && <p style={{ color: textColor }}>Загрузка...</p>}
      {error && <p style={{ color: "#c0392b" }}>{error}</p>}
      {!loading && cart.length === 0 && <p style={{ color: textColor }}>Корзина пуста</p>}
      {cart.map((item) => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
          <img src={item.image_url} alt={item.name} width="80" style={{ marginRight: "10px" }} />
          <span style={{ color: textColor, marginRight: "10px", width: "220px" }}>
            {item.name} × {item.quantity}
            {item.discount > 0 && (
              <span style={{ color: "#c0392b" }}> (скидка {item.discount}%)</span>
            )}
          </span>
          <button style={btnStyle} onClick={() => changeQuantity(item.id, item.quantity + 1)}>+</button>
          <button style={btnStyle} onClick={() => changeQuantity(item.id, item.quantity - 1)}>-</button>
          <button style={{ ...btnStyle, marginLeft: "10px" }} onClick={() => removeItem(item.id)}>Удалить</button>
          <span style={{ color: textColor, marginLeft: "10px" }}>
            {Math.round(item.priceAfter).toLocaleString("ru-RU")} ₽
          </span>
        </div>
      ))}
      {cart.length > 0 && (
        <>
          <h3 style={{ color: textColor }}>Сумма без скидки: {Math.round(totalBefore).toLocaleString("ru-RU")} ₽</h3>
          <h3 style={{ color: textColor }}>Итого со скидкой: {Math.round(totalAfter).toLocaleString("ru-RU")} ₽</h3>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ color: textColor, display: "block", marginBottom: "4px" }}>Адрес доставки</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Укажите адрес, если отличается от основного"
              style={{ width: "320px", padding: "6px" }}
            />
          </div>
          {checkoutError && <p style={{ color: "#c0392b" }}>{checkoutError}</p>}
          <button style={btnStyle} onClick={handleCheckout}>Оформить заказ</button>
        </>
      )}
    </div>
  );
}

export default Cart;