import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import * as api from "./api";

function AdminUsers() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [users, setUsers] = useState([]);
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
  };
  const cellStyle = { padding: "8px", borderBottom: `1px solid ${borderColor}`, color: textColor, textAlign: "left" };
  const headStyle = { ...cellStyle, fontWeight: "bold" };

  useEffect(() => {
    setLoading(true);
    api.getUsers(user.token).then(setUsers).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div style={cardStyle}>
      <h2 style={{ color: textColor, marginTop: 0 }}>Пользователи</h2>
      {loading && <p style={{ color: textColor }}>Загрузка...</p>}
      {error && <p style={{ color: "#c0392b" }}>{error}</p>}
      {!loading && !error && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={headStyle}>Email</th>
              <th style={headStyle}>Имя</th>
              <th style={headStyle}>Роль</th>
              <th style={headStyle}>Купон</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={cellStyle}>{u.email}</td>
                <td style={cellStyle}>{u.full_name}</td>
                <td style={cellStyle}>{u.role === "admin" ? "Администратор" : "Пользователь"}</td>
                <td style={cellStyle}>{u.coupon_name || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AdminUsers;