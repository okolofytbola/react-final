import { useCart } from "./CartContext";
import { useTheme } from "./ThemeContext";

function Cart() {
  const { cart, addToCart, removeFromCart } = useCart();
  const { theme } = useTheme();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const textColor = theme === "light" ? "#000000" : "#ffffff";
  const btnStyle = {
    backgroundColor: theme === "light" ? "#eeeeee" : "#444444",
    color: textColor,
  };

  return (
    <div style={{ padding: "10px" }}>
      <h1 style={{ color: textColor }}>Корзина</h1>
      {cart.length === 0 && <p style={{ color: textColor }}>Корзина пуста</p>}
      {cart.map((item) => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
          <img src={item.image} alt={item.name} width="60" style={{ marginRight: "10px" }} />
          <span style={{ color: textColor, marginRight: "10px" }}>
            {item.name} — {item.price} руб. × {item.quantity}
          </span>
          <button style={btnStyle} onClick={() => addToCart(item)}>+</button>
          <button style={btnStyle} onClick={() => removeFromCart(item.id)}>-</button>
        </div>
      ))}
      <h3 style={{ color: textColor }}>Итого: {total} руб.</h3>
    </div>
  );
}

export default Cart;