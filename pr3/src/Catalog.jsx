import { useState, useEffect } from "react";
import { useTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import ProductCard from "./ProductCard";
import * as api from "./api";

function Catalog() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const textColor = theme === "light" ? "#000000" : "#ffffff";
  const btnStyle = { backgroundColor: theme === "light" ? "#eeeeee" : "#444444", color: textColor };

  useEffect(() => {
    api.getCategories().then(setCategories).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .getCars(search, selectedCategories)
      .then(setCars)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, selectedCategories]);

  function toggleCategory(id) {
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  return (
    <div style={{ padding: "10px", display: "flex", gap: "20px" }}>
      <aside style={{ width: "180px", flexShrink: 0 }}>
        <h3 style={{ color: textColor }}>Категории</h3>
        {categories.map((category) => (
          <label key={category.id} style={{ color: textColor, display: "block", marginBottom: "6px" }}>
            <input
              type="checkbox"
              checked={selectedCategories.includes(category.id)}
              onChange={() => toggleCategory(category.id)}
            />{" "}
            {category.name}
          </label>
        ))}
      </aside>
      <div style={{ flex: 1 }}>
        <h1 style={{ color: textColor }}>Каталог Lada</h1>
        <input
          placeholder="Поиск по названию"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: "15px", padding: "6px", width: "250px" }}
        />
        {loading && <p style={{ color: textColor }}>Загрузка...</p>}
        {error && <p style={{ color: "#c0392b" }}>{error}</p>}
        {!loading && !error && cars.length === 0 && <p style={{ color: textColor }}>Ничего не найдено</p>}
        {!loading && !error && cars.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
            {cars.map((car) => (
              <ProductCard
                key={car.id}
                car={car}
                textColor={textColor}
                btnStyle={btnStyle}
                onAdd={() => user && user.role !== "admin" && addToCart(car.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Catalog;