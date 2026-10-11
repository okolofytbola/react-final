import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  useOnRecovered, rub, formatDate, formatDay, validPhone, PHONE_PLACEHOLDER, PHONE_ERROR,
  personNameError, formatPhone, ORDER_STATUSES, PAYMENT_STATUSES, EMAIL_RE,
} from "./utils";
import * as api from "./api";

function Profile() {
  const { user, updateUser } = useAuth();

  const [form, setForm] = useState({ fullName: user.fullName || "", email: user.email || "", phone: user.phone || "", address: user.address || "" });
  const [infoErrors, setInfoErrors] = useState({});
  const [infoMsg, setInfoMsg] = useState({ type: "", text: "" });
  const [infoSaving, setInfoSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [secMsg, setSecMsg] = useState({ type: "", text: "" });
  const [secSaving, setSecSaving] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [payingId, setPayingId] = useState(null);

  const loadOrders = useCallback(() => {
    setOrdersLoading(true);
    api
      .getOrders(user.token)
      .then((list) => {
        setOrders(list);
        setOrdersError("");
      })
      .catch((err) => setOrdersError(err.message))
      .finally(() => setOrdersLoading(false));
  }, [user.token]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);
  useOnRecovered(loadOrders);

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function payOrder(order) {
    setOrdersError("");
    setPayingId(order.id);
    try {
      await api.payOrder(user.token, order.id);
      loadOrders();
    } catch (err) {
      setOrdersError(err.message);
    } finally {
      setPayingId(null);
    }
  }

  async function saveInfo(e) {
    e.preventDefault();
    setInfoMsg({ type: "", text: "" });
    const next = {};
    const nameError = personNameError(form.fullName);
    if (nameError) next.fullName = nameError;
    if (!EMAIL_RE.test(form.email.trim())) next.email = "Введите корректный email";
    if (!validPhone(form.phone)) next.phone = PHONE_ERROR;
    setInfoErrors(next);
    if (Object.keys(next).length) return;
    setInfoSaving(true);
    try {
      const updated = await api.updateProfile(user.token, {
        fullName: form.fullName,
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address,
      });
      updateUser(updated);
      setInfoMsg({ type: "success", text: "Данные сохранены. Адрес будет подставляться при оформлении заказа." });
    } catch (err) {
      setInfoMsg({ type: "error", text: err.message });
    } finally {
      setInfoSaving(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setSecMsg({ type: "", text: "" });
    if (!currentPassword) return setSecMsg({ type: "error", text: "Введите текущий пароль" });
    if (!password) return setSecMsg({ type: "error", text: "Введите новый пароль" });
    if (password.length < 6) return setSecMsg({ type: "error", text: "Новый пароль не короче 6 символов" });
    if (password !== repeat) return setSecMsg({ type: "error", text: "Пароли не совпадают" });
    setSecSaving(true);
    try {
      await api.updateProfile(user.token, { currentPassword, password });
      setCurrentPassword("");
      setPassword("");
      setRepeat("");
      setSecMsg({ type: "success", text: "Пароль изменён" });
    } catch (err) {
      setSecMsg({ type: "error", text: err.message });
    } finally {
      setSecSaving(false);
    }
  }

  const initial = (user.fullName || user.email || "?").trim().charAt(0).toUpperCase();
  const msg = (m) => m.text && <div className={`alert ${m.type === "error" ? "alert-error" : "alert-success"}`}>{m.text}</div>;
  const field = (key, label, props = {}) => (
    <label className="field">
      <span>{label}</span>
      <input className={`input ${infoErrors[key] ? "invalid" : ""}`} value={form[key]} onChange={setField(key)} {...props} />
      {infoErrors[key] && <small className="error">{infoErrors[key]}</small>}
    </label>
  );

  return (
    <div className="page profile">
      <section className="card profile-head">
        <div className="avatar">{initial}</div>
        <div className="grow">
          <h2>{user.fullName}</h2>
          <p className="muted">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p>
          <p className="small">{user.address ? `Адрес по умолчанию: ${user.address}` : "Адрес по умолчанию не указан"}</p>
        </div>
        <div>
          {user.coupon ? (
            <span className="badge badge-coupon">
              Купон {user.coupon.code} · −{user.coupon.percent}%
              {user.coupon.firstOrderOnly ? " · только на первый заказ" : ""}
            </span>
          ) : (
            <span className="badge">Купона нет</span>
          )}
          {user.coupon && user.coupon.firstOrderOnly && (
            <p className="muted small">Приветственный купон действует только на первый заказ.</p>
          )}
        </div>
      </section>

      <div className="profile-grid">
        <form className="card form" onSubmit={saveInfo} noValidate>
          <h3>Личная информация</h3>
          {field("fullName", "ФИО")}
          {field("email", "Email (логин)")}
          <label className="field">
            <span>Телефон</span>
            <input
              className={`input ${infoErrors.phone ? "invalid" : ""}`}
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))}
              placeholder={PHONE_PLACEHOLDER}
              inputMode="tel"
            />
            <small className="muted">Формат: {PHONE_PLACEHOLDER}</small>
            {infoErrors.phone && <small className="error">{infoErrors.phone}</small>}
          </label>
          {field("address", "Адрес по умолчанию", { placeholder: "Город, улица, дом, квартира" })}
          {msg(infoMsg)}
          <button className="btn btn-primary btn-block" disabled={infoSaving}>{infoSaving ? "Сохраняем..." : "Сохранить"}</button>
        </form>

        <form className="card form" onSubmit={savePassword} noValidate>
          <h3>Изменение пароля</h3>
          <label className="field">
            <span>Текущий пароль</span>
            <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </label>
          <label className="field">
            <span>Новый пароль</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="field">
            <span>Повторите новый пароль</span>
            <input className="input" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </label>
          {msg(secMsg)}
          <button className="btn btn-primary btn-block" disabled={secSaving}>{secSaving ? "Сохраняем..." : "Изменить пароль"}</button>
        </form>
      </div>

      <section className="card">
        <h3>Мои заказы</h3>
        <p className="muted small">
          У каждого заказа один номер и одна общая сумма на все комплектующие.
        </p>
        {ordersLoading && <p className="muted">Загрузка заказов...</p>}
        {ordersError && (
          <div className="alert alert-error">
            <span>{ordersError}</span>
            <button className="btn btn-sm" onClick={loadOrders}>Повторить</button>
          </div>
        )}
        {!ordersLoading && !ordersError && orders.length === 0 && <p className="muted">Заказов пока нет.</p>}
        {orders.map((order) => (
          <div key={order.id} className="order">
            <div className="between order-head">
              <strong>Заказ №{order.id} · {order.itemsCount} шт. комплектующих</strong>
              <span className="actions-cell">
                <span className={`status status-${order.status}`}>{ORDER_STATUSES[order.status] || order.status}</span>
                <span className={`status ${order.isPaid ? "status-delivered" : "status-processing"}`}>
                  {PAYMENT_STATUSES[order.paymentStatus] || order.paymentLabel}
                </span>
              </span>
            </div>
            <p className="muted small">
              Оформлен: {formatDate(order.createdAt)} · Доставка: {formatDay(order.deliveryDate)} · {order.address}
            </p>
            <ul className="order-items">
              {order.items.map((item, i) => (
                <li key={i} className="between small">
                  <span>{item.carName} × {item.quantity} шт.</span>
                  <span>{rub(item.priceAfter)}</span>
                </li>
              ))}
            </ul>
            <div className="between">
              <span>
                Куплено: {order.itemsCount} шт.
                {order.isPaid && order.paidAt ? ` · оплачен ${formatDate(order.paidAt)}` : ""}
              </span>
              <strong>Общая сумма заказа: {rub(order.totalAfter)}</strong>
            </div>
            {!order.isPaid && order.status !== "cancelled" && (
              <button className="btn btn-primary btn-sm mt" disabled={payingId === order.id} onClick={() => payOrder(order)}>
                {payingId === order.id ? "Оплачиваем..." : `Оплатить заказ №${order.id} — ${rub(order.totalAfter)}`}
              </button>
            )}
            {order.isPaid && (
              <p className="success small">Заказ оплачен. Статус оплаты изменить нельзя — админ не может вернуть «Ожидает оплаты».</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

export default Profile;
