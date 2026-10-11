import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { formatPhone, validPhone, PHONE_PLACEHOLDER, PHONE_ERROR, personNameError, EMAIL_RE } from "./utils";
import * as api from "./api";

function Register() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", phone: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, setUser, ready } = useAuth();
  const navigate = useNavigate();

  if (!ready) return <div className="page narrow"><p className="muted">Проверяем сессию…</p></div>;
  if (user) return <Navigate to="/" replace />;

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function validate() {
    const next = {};
    const nameError = personNameError(form.fullName);
    if (nameError) next.fullName = nameError;
    if (!form.email.trim()) next.email = "Введите email";
    else if (!EMAIL_RE.test(form.email.trim())) next.email = "Введите корректный email, например name@mail.ru";
    if (!form.password) next.password = "Введите пароль";
    else if (form.password.length < 6) next.password = "Пароль не короче 6 символов";
    if (!form.phone.trim()) next.phone = "Введите телефон";
    else if (!validPhone(form.phone)) next.phone = PHONE_ERROR;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      const created = await api.register({
        fullName: form.fullName,
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
      });
      setUser(created);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const field = (key, label, props = {}) => (
    <label className="field">
      <span>{label}</span>
      <input className={`input ${errors[key] ? "invalid" : ""}`} value={form[key]} onChange={set(key)} {...props} />
      {errors[key] && <small className="error">{errors[key]}</small>}
    </label>
  );

  return (
    <div className="page narrow">
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <h1>Регистрация</h1>
        {field("fullName", "Полное имя (ФИО) — настоящие фамилия и имя", { placeholder: "Иванов Иван Иванович" })}
        {field("email", "Email (он же логин)", { placeholder: "name@mail.ru" })}
        {field("password", "Пароль", { type: "password" })}
        <label className="field">
          <span>Телефон</span>
          <input
            className={`input ${errors.phone ? "invalid" : ""}`}
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))}
            placeholder={PHONE_PLACEHOLDER}
            inputMode="tel"
          />
          <small className="muted">Формат: {PHONE_PLACEHOLDER}</small>
          {errors.phone && <small className="error">{errors.phone}</small>}
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? "Регистрируем..." : "Зарегистрироваться"}
        </button>
        <p className="muted center small">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
      </form>
    </div>
  );
}

export default Register;
