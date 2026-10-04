import { useLocation, Navigate } from "react-router-dom";
import { useTheme } from "./ThemeContext";

function Checkout() {
  const { theme } = useTheme();
  const location = useLocation();
  const order = location.state && location.state.order;
  const textColor = theme === "light" ? "#000000" : "#ffffff";

  if (!order) {
    return <Navigate to="/" />;
  }

  return (
    <div style={{ padding: "10px" }}>
      <h1 style={{ color: textColor }}>Чек №{order.orderId}</h1>
      <p style={{ color: textColor }}>Адрес доставки: {order.address}</p>
      {order.items.map((item, index) => (
        <div key={index} style={{ color: textColor, marginBottom: "6px" }}>
          {item.carName} × {item.quantity} — было {Math.round(item.priceBefore).toLocaleString("ru-RU")} ₽, стало{" "}
          {Math.round(item.priceAfter).toLocaleString("ru-RU")} ₽
        </div>
      ))}
      <h3 style={{ color: textColor }}>Сумма без скидки: {Math.round(order.totalBefore).toLocaleString("ru-RU")} ₽</h3>
      <h3 style={{ color: textColor }}>Итого к оплате: {Math.round(order.totalAfter).toLocaleString("ru-RU")} ₽</h3>
    </div>
  );
}

export default Checkout;