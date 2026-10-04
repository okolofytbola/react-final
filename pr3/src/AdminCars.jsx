import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import * as api from "./api";

function AdminCars() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [cars, setCars] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const isLight = theme === "light";
  const textColor = isLight ? "#000000" : "#ffffff";
  const borderColor = isLight ? "#ddd" : "#444";
  const cardStyle = {
    backgroundColor: isLight ? "#ffffff" : "#2a2a2a",
    border: `1px solid ${borderColor}`,
    borderRadius: "10px",
    padding: "20px",
  };
  const cellStyle = { padding: "8px", borderBottom: `1px solid ${borderColor}`, color: textColor, textAlign: "left" };
  const headStyle = { ...cellStyle, fontWeight: "bold" };

  function load(searchValue) {
    api.getCars(searchValue).then(setCars).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load(search);
  }, [search]);

  async function handleChange(carId, value) {
    setError("");
    try {
      await api.setCarDiscount(user.token, carId, Number(value));
      load(search);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ color: textColor, marginTop: 0 }}>Товары и скидки</h2>
      <input
        placeholder="Поиск по названию или коду"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: "8px", marginBottom: "15px", width: "260px" }}
      />
      {error && <p style={{ color: "#c0392b" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={headStyle}>Код</th>
            <th style={headStyle}>Модель</th>
            <th style={headStyle}>Цена</th>
            <th style={headStyle}>Скидка, %</th>
          </tr>
        </thead>
        <tbody>
          {cars.map((car) => (
            <tr key={car.id}>
              <td style={cellStyle}>{car.code}</td>
              <td style={cellStyle}>{car.name}</td>
              <td style={cellStyle}>{car.price.toLocaleString("ru-RU")} ₽</td>
              <td style={cellStyle}>
                <input
                  type="number"
                  min="0"
                  max="99"
                  defaultValue={car.discount_percent}
                  onBlur={(e) => handleChange(car.id, e.target.value)}
                  style={{ width: "60px", padding: "4px" }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminCars;