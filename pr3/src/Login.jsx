import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import * as api from "./api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setError("Заполните оба поля");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const user = await api.login(email, password);
      setUser(user);
      navigate(user.role === "admin" ? "/admin" : "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "10px" }}>
      <h1 style={{ color: textColor }}>Вход</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "8px" }}>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div style={{ marginBottom: "8px" }}>
          <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p style={{ color: "#c0392b" }}>{error}</p>}
        <button type="submit" style={btnStyle} disabled={loading}>
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
      <p style={{ color: textColor }}>
        Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
      </p>
      <p style={{ color: textColor, fontSize: "13px" }}>
        Демо: user@lada.shop / user123, admin@lada.shop / admin123
      </p>
    </div>
  );
}

export default Login;