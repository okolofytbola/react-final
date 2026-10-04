import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import * as api from "./api";

function AdminCoupons() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [coupons, setCoupons] = useState([]);
  const [users, setUsers] = useState([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [discountPercent, setDiscountPercent] = useState(10);
  const [error, setError] = useState("");

  const isLight = theme === "light";
  const textColor = isLight ? "#000000" : "#ffffff";
  const borderColor = isLight ? "#ddd" : "#444";
  const cardStyle = {
    backgroundColor: isLight ? "#ffffff" : "#2a2a2a",
    border: `1px solid ${borderColor}`,
    borderRadius: "10px",
    padding: "20px",
    maxWidth: "700px",
  };
  const cellStyle = { padding: "8px", borderBottom: `1px solid ${borderColor}`, color: textColor, textAlign: "left" };
  const headStyle = { ...cellStyle, fontWeight: "bold" };

  function load() {
    api.getCoupons(user.token).then(setCoupons).catch((err) => setError(err.message));
    api.getUsers(user.token).then(setUsers).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await api.addCoupon(user.token, code, name, Number(discountPercent));
      setCode("");
      setName("");
      setDiscountPercent(10);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAssign(couponId, targetUserId) {
    await api.assignCoupon(user.token, couponId, Number(targetUserId));
    load();
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ color: textColor, marginTop: 0 }}>Купоны</h2>
      <form onSubmit={handleAdd} style={{ marginBottom: "18px", display: "flex", gap: "8px", alignItems: "center" }}>
        <input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} style={{ padding: "8px", width: "100px" }} />
        <input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "8px", flex: 1 }} />
        <input
          type="number"
          min="1"
          max="99"
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
          style={{ width: "60px", padding: "8px" }}
        />
        <span style={{ color: textColor }}>%</span>
        <button type="submit" style={{ padding: "8px 16px" }}>Создать</button>
      </form>
      {error && <p style={{ color: "#c0392b" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={headStyle}>Код</th>
            <th style={headStyle}>Название</th>
            <th style={headStyle}>Скидка</th>
            <th style={headStyle}>Выдан</th>
            <th style={headStyle}>Выдать</th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((coupon) => (
            <tr key={coupon.id}>
              <td style={cellStyle}>{coupon.code}</td>
              <td style={cellStyle}>{coupon.name}</td>
              <td style={cellStyle}>{coupon.discount_percent}%</td>
              <td style={cellStyle}>{coupon.assigned_emails || "—"}</td>
              <td style={cellStyle}>
                <select onChange={(e) => e.target.value && handleAssign(coupon.id, e.target.value)} defaultValue="">
                  <option value="" disabled>
                    Выбрать
                  </option>
                  {users
                    .filter((u) => u.role === "user")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email}
                      </option>
                    ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminCoupons;