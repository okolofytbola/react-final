import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import * as api from "./api";

function AdminCategories() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const isLight = theme === "light";
  const textColor = isLight ? "#000000" : "#ffffff";
  const borderColor = isLight ? "#ddd" : "#444";
  const cardStyle = {
    backgroundColor: isLight ? "#ffffff" : "#2a2a2a",
    border: `1px solid ${borderColor}`,
    borderRadius: "10px",
    padding: "20px",
    maxWidth: "500px",
  };

  function load() {
    setLoading(true);
    api.getCategories().then(setCategories).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await api.addCategory(user.token, name);
      setName("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ color: textColor, marginTop: 0 }}>Категории</h2>
      <form onSubmit={handleAdd} style={{ marginBottom: "15px", display: "flex", gap: "8px" }}>
        <input
          placeholder="Название новой категории"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: "8px" }}
        />
        <button type="submit" style={{ padding: "8px 16px" }}>Добавить</button>
      </form>
      {error && <p style={{ color: "#c0392b" }}>{error}</p>}
      {loading && <p style={{ color: textColor }}>Загрузка...</p>}
      {categories.map((category) => (
        <div
          key={category.id}
          style={{ color: textColor, padding: "8px 0", borderBottom: `1px solid ${borderColor}` }}
        >
          {category.name}
        </div>
      ))}
    </div>
  );
}

export default AdminCategories;