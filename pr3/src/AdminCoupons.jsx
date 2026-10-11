import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useDebouncedValue, useOnRecovered } from "./utils";
import * as api from "./api";

function CouponRow({ coupon, token, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    code: coupon.code, name: coupon.name, discountPercent: coupon.discountPercent,
    firstOrderOnly: Boolean(coupon.firstOrderOnly),
  });
  const [busy, setBusy] = useState(false);

  const reset = () =>
    setForm({
      code: coupon.code, name: coupon.name, discountPercent: coupon.discountPercent,
      firstOrderOnly: Boolean(coupon.firstOrderOnly),
    });

  async function save() {
    onError("");
    const percent = Number(form.discountPercent);
    if (!Number.isInteger(percent) || percent < 1 || percent > 99) {
      onError("Скидка должна быть целым числом от 1 до 99%");
      return;
    }
    setBusy(true);
    try {
      await api.updateCoupon(token, coupon.id, form);
      setEditing(false);
      onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    onError("");
    try {
      await api.deleteCoupon(token, coupon.id);
      onChanged();
    } catch (err) {
      onError(err.message);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr>
        <td><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></td>
        <td><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></td>
        <td>
          <input className="input narrow-input" type="number" min="1" max="99" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
        </td>
        <td>
          <label className="check">
            <input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })} />
            <span className="small">только 1-й заказ</span>
          </label>
        </td>
        <td className="muted small">{coupon.assignedEmails || "—"}</td>
        <td className="actions-cell">
          <button className="btn btn-sm btn-primary" onClick={save} disabled={busy}>Сохранить</button>
          <button className="btn btn-sm" onClick={() => { setEditing(false); onError(""); reset(); }}>Отмена</button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td><strong>{coupon.code}</strong></td>
      <td>{coupon.name}</td>
      <td>{coupon.discountPercent}%</td>
      <td className="small">
        {coupon.firstOrderOnly ? (
          <span className="badge badge-sale">только на первый заказ</span>
        ) : (
          <span className="muted">постоянный</span>
        )}
      </td>
      <td className="small">{coupon.assignedEmails || <span className="muted">не выдан</span>}</td>
      <td className="actions-cell">
        {deleting ? (
          <>
            <span className="small">{coupon.usersCount > 0 ? `У ${coupon.usersCount} польз. купон будет снят. ` : ""}Удалить?</span>
            <button className="btn btn-sm btn-danger" onClick={remove} disabled={busy}>Да</button>
            <button className="btn btn-sm" onClick={() => setDeleting(false)}>Нет</button>
          </>
        ) : (
          <>
            <button className="btn btn-sm" onClick={() => setEditing(true)}>Изменить</button>
            <button className="btn btn-sm btn-danger" onClick={() => setDeleting(true)}>Удалить</button>
          </>
        )}
      </td>
    </tr>
  );
}

function AdminCoupons() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ code: "", name: "", discountPercent: 10, firstOrderOnly: true });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const debounced = useDebouncedValue(search.trim());

  const load = useCallback(() => {
    api
      .getCoupons(user.token, debounced)
      .then(setCoupons)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user.token, debounced]);

  useEffect(() => {
    load();
  }, [load]);
  useOnRecovered(load);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    const percent = Number(form.discountPercent);
    if (!form.code.trim() || !form.name.trim()) {
      setError("Заполните код и название купона");
      return;
    }
    if (!Number.isInteger(percent) || percent < 1 || percent > 99) {
      setError("Скидка должна быть целым числом от 1 до 99%");
      return;
    }
    try {
      await api.addCoupon(user.token, form);
      setForm({ code: "", name: "", discountPercent: 10, firstOrderOnly: true });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card admin-card">
      <h2>Купоны</h2>
      <p className="muted small">
        Персональная скидка покупателя привязана к купону (от 1 до 99%). Купон «только на первый заказ» —
        приветственный: он действует один раз и сгорает после первого оформленного заказа. Выдать купон
        пользователю можно в разделе «Пользователи».
      </p>
      <form onSubmit={handleAdd} className="toolbar" noValidate>
        <input className="input" placeholder="Код (GOLD)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input className="input grow" placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input narrow-input" type="number" min="1" max="99" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
        <span>%</span>
        <label className="check">
          <input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })} />
          <span className="small">только на первый заказ</span>
        </label>
        <button type="submit" className="btn btn-primary">Создать</button>
      </form>
      <input className="input search" placeholder="Поиск по коду, названию или email владельца" value={search} onChange={(e) => setSearch(e.target.value)} />
      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Загрузка...</p>}
      {!loading && coupons.length === 0 && (
        <p className="muted">{debounced ? `Купоны по запросу «${debounced}» не найдены.` : "Купонов пока нет."}</p>
      )}
      {coupons.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Код</th><th>Название</th><th>Скидка</th><th>Срок действия</th><th>Выдан</th><th>Действия</th></tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <CouponRow key={coupon.id} coupon={coupon} token={user.token} onChanged={load} onError={setError} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminCoupons;
