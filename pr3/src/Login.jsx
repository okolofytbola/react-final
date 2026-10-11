import { useState, useEffect } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { isStaff } from "./utils";
import * as api from "./api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, setUser, ready, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();

  useEffect(() => clearSessionMessage, [clearSessionMessage]);

  if (!ready) return <div className="page narrow"><p className="muted">Проверяем сессию…</p></div>;
  if (user) return <Navigate to={isStaff(user) ? "/admin" : "/"} replace />;

  function validate() {
    const next = {};
    if (!email.trim()) next.email = "Введите email";
    else if (!EMAIL_RE.test(email.trim())) next.email = "Введите корректный email, например name@mail.ru";
    if (!password) next.password = "Введите пароль";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      const logged = await api.login(email.trim(), password);
      setUser(logged);
      navigate(isStaff(logged) ? "/admin" : "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page narrow">
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <h1>Вход</h1>
        {sessionMessage && <div className="alert alert-warn">{sessionMessage}</div>}
        <label className="field">
          <span>Email</span>
          <input className={`input ${errors.email ? "invalid" : ""}`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@mail.ru" />
          {errors.email && <small className="error">{errors.email}</small>}
        </label>
        <label className="field">
          <span>Пароль</span>
          <input className={`input ${errors.password ? "invalid" : ""}`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {errors.password && <small className="error">{errors.password}</small>}
        </label>
        <p className="small right">
          <Link to="/forgot-password">Забыли пароль?</Link>
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? "Входим..." : "Войти"}
        </button>
        <p className="muted center small">Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
      </form>
    </div>
  );
}

export default Login;
