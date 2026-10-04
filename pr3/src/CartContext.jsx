import { createContext, useState, useEffect, useContext } from "react";
import { useAuth } from "./AuthContext";
import * as api from "./api";

const CartContext = createContext();

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function loadCart() {
    if (!user || user.role === "admin") {
      setCart([]);
      return;
    }
    setLoading(true);
    setError("");
    api
      .getCart(user.token)
      .then(setCart)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCart();
  }, [user]);

  async function addToCart(carId) {
    try {
      await api.addToCart(user.token, carId);
      loadCart();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeQuantity(itemId, quantity) {
    try {
      await api.updateCartQuantity(user.token, itemId, quantity);
      loadCart();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeItem(itemId) {
    try {
      await api.removeFromCart(user.token, itemId);
      loadCart();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <CartContext.Provider value={{ cart, loading, error, addToCart, changeQuantity, removeItem, reloadCart: loadCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}