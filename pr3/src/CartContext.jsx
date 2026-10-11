import { createContext, useState, useEffect, useContext, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useOnRecovered } from "./utils";
import * as api from "./api";

const CartContext = createContext();
const EMPTY_TOTALS = { totalBefore: 0, totalAfter: 0, totalSaved: 0, itemsCount: 0 };
const DEFAULT_LIMITS = { maxQty: 10, dayCapacity: 10, reserveMinutes: 60 };

export function CartProvider({ children }) {
  const { user } = useAuth();
  const token = user ? user.token : null;
  const isShopper = Boolean(user) && user.role === "user";

  const [cart, setCart] = useState([]);
  const [totals, setTotals] = useState(EMPTY_TOTALS);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const loadCart = useCallback(async () => {
    if (!token || !isShopper) {
      setCart([]);
      setTotals(EMPTY_TOTALS);
      setLoaded(true);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getCart(token);
      setCart(data.items);
      setTotals(data.totals);
      setLimits({
        maxQty: data.maxQty || DEFAULT_LIMITS.maxQty,
        dayCapacity: data.dayCapacity || DEFAULT_LIMITS.dayCapacity,
        reserveMinutes: data.reserveMinutes || 60,
      });
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [token, isShopper]);

  useEffect(() => {
    setLoaded(false);
    loadCart();
  }, [loadCart]);

  useOnRecovered(loadCart);

  async function addToCart(carId) {
    await api.addToCart(token, carId);
    await loadCart();
  }

  async function changeQuantity(itemId, quantity) {
    try {
      await api.updateCartQuantity(token, itemId, quantity);
      await loadCart();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeItem(itemId) {
    try {
      await api.removeFromCart(token, itemId);
      await loadCart();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <CartContext.Provider
      value={{
        cart, totals, limits, dayCapacity: limits.dayCapacity, maxQty: limits.maxQty, reserveMinutes: limits.reserveMinutes,
        loading, loaded, error, addToCart, changeQuantity, removeItem, reloadCart: loadCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
