import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  useDebouncedValue, useOnRecovered, ROLE_NAMES, validPhone, PHONE_PLACEHOLDER, PHONE_ERROR,
  personNameError, formatPhone, EMAIL_RE,
} from "./utils";
import * as api from "./api";

function CreateUserForm({ token, onDone, onCancel }) {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", role: "user" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const nameError = personNameError(form.fullName);
    if (nameError) return setError(nameError);
    if (!EMAIL_RE.test(form.email.trim())) return setError("Введите корректный email");
    if (!validPhone(form.phone)) return setError(PHONE_ERROR);
    if (form.password.length < 6) return setError("Пароль не короче 6 символов");
    setBusy(true);
    try {
      await api.createUser(token, { ...form, email: form.email.trim(), phone: form.phone.trim() });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="panel admin-form" onSubmit={handleSubmit} noValidate>
      <h3>Новый пользователь</h3>
      <div className="form-grid">
        <label className="field"><span>ФИО (настоящие фамилия и имя)</span><input className="input" value={form.fullName} onChange={set("fullName")} placeholder="Иванов Иван" /></label>
        <label className="field"><span>Email</span><input className="input" value={form.email} onChange={set("email")} /></label>
        <label className="field">
          <span>Телефон</span>
          <input
            className="input"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))}
            placeholder={PHONE_PLACEHOLDER}
            inputMode="tel"
          />
        </label>
        <label className="field"><span>Пароль</span><input className="input" type="password" value={form.password} onChange={set("password")} /></label>
        <label className="field">
          <span>Роль</span>
          <select className="input" value={form.role} onChange={set("role")}>
            <option value="user">{ROLE_NAMES.user}</option>
            <option value="employee">{ROLE_NAMES.employee}</option>
          </select>
        </label>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="toolbar">
        <button className="btn btn-primary" disabled={busy}>Создать</button>
        <button type="button" className="btn" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}

function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const debounced = useDebouncedValue(search.trim());

  const load = useCallback(() => {
    Promise.all([api.getUsers(user.token, debounced), api.getCoupons(user.token)])
      .then(([userList, couponList]) => {
        setUsers(userList);
        setCoupons(couponList);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user.token, debounced]);

  useEffect(() => {
    load();
  }, [load]);
  useOnRecovered(load);

  async function act(target, fn) {
    setError("");
    setSavingId(target.id);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="card admin-card">
      <h2>Пользователи</h2>
      <div className="alert alert-warn">
        <span>
          ФИО, email, телефон и адрес пользователя администратор менять не может, удалять пользователей — тоже.
          Свои данные пользователь меняет сам в профиле. Здесь доступны только роль и выдача купона.
        </span>
      </div>
      <p className="muted small">
        Купон (персональная скидка) выдаётся только покупателям. Купон «только на первый заказ» сгорает после
        первого оформленного заказа. Роль «Сотрудник» можно назначить пользователю, роль «Администратор» — только в базе данных.
      </p>
      <div className="toolbar">
        <input className="input grow" placeholder="Поиск по email, имени или купону" value={search} onChange={(e) => setSearch(e.target.value)} />
        {!creating && <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Добавить пользователя</button>}
      </div>
      {creating && <CreateUserForm token={user.token} onCancel={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />}
      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Загрузка...</p>}
      {!loading && !error && users.length === 0 && (
        <p className="muted">{debounced ? `Пользователи по запросу «${debounced}» не найдены.` : "Пользователей пока нет."}</p>
      )}
      {users.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Email</th><th>Имя</th><th>Телефон</th><th>Роль</th><th>Купон</th><th>Заказов</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.fullName}</td>
                  <td className="small">{u.phone || <span className="muted">—</span>}</td>
                  <td>
                    {u.role === "admin" ? (
                      ROLE_NAMES.admin
                    ) : (
                      <select className="input" value={u.role} disabled={savingId === u.id} onChange={(e) => act(u, () => api.setUserRole(user.token, u.id, e.target.value))}>
                        <option value="user">{ROLE_NAMES.user}</option>
                        <option value="employee">{ROLE_NAMES.employee}</option>
                      </select>
                    )}
                  </td>
                  <td>
                    {u.role !== "user" ? (
                      <span className="muted">—</span>
                    ) : (
                      <select className="input" value={u.couponId || ""} disabled={savingId === u.id} onChange={(e) => act(u, () => api.setUserCoupon(user.token, u.id, e.target.value ? Number(e.target.value) : null))}>
                        <option value="">Без купона</option>
                        {coupons.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} · {c.discountPercent}%{c.firstOrderOnly ? " (только 1-й заказ)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>{u.role === "admin" ? <span className="muted">—</span> : u.ordersCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminUsers;
