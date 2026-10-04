import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import * as api from "./api";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const textColor = theme === "light" ? "#000000" : "#ffffff";
  const btnStyle = { backgroundColor: theme === "light" ? "#eeeeee" : "#444444", color: textColor };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Заполните email и пароль");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const user = await api.register(email, password, fullName);
      setUser(user);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "10px" }}>
      <h1 style={{ color: textColor }}>Регистрация</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "8px" }}>
          <input placeholder="Имя" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div style={{ marginBottom: "8px" }}>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div style={{ marginBottom: "8px" }}>
          <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p style={{ color: "#c0392b" }}>{error}</p>}
        <button type="submit" style={btnStyle} disabled={loading}>
          {loading ? "Регистрация..." : "Зарегистрироваться"}
        </button>
      </form>
    </div>
  );
}

export default Register;