import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useDebouncedValue, useOnRecovered, rub, formatDate, formatDay, ORDER_STATUSES, PAYMENT_STATUSES } from "./utils";
import * as api from "./api";

function AdminOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const debounced = useDebouncedValue(search.trim());

  const load = useCallback(() => {
    api
      .getAllOrders(user.token, debounced)
      .then((list) => {
        setOrders(list);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user.token, debounced]);

  useEffect(() => {
    load();
  }, [load]);
  useOnRecovered(load);

  async function changeStatus(order, status) {
    setError("");
    setNotice("");
    setBusyId(order.id);
    try {
      const res = await api.setOrderStatus(user.token, order.id, status);
      if (res && res.returnedToStock > 0) {
        setNotice(`Заказ №${order.id} отменён: ${res.returnedToStock} шт. вернулись на склад и снова доступны покупателям.`);
      } else if (status === "cancelled") {
        setNotice(`Заказ №${order.id} отменён.`);
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function markPaid(order) {
    setError("");
    setBusyId(order.id);
    try {
      await api.setOrderPayment(user.token, order.id, "paid");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card admin-card">
      <h2>Заказы</h2>
      <p className="muted small">
        Все заказы клиентов. У каждого заказа один номер и одна общая сумма на все комплектующие.
        Чек удалить нельзя — он хранится как документ продажи.
      </p>
      <div className="alert alert-warn">
        <span>
          Оплаченный заказ перевести обратно в «{PAYMENT_STATUSES.pending}» невозможно: кнопки отмены оплаты нет,
          а сервер отклоняет такой запрос. Статус оплаты меняется только в сторону «Оплачен».
        </span>
      </div>
      <input className="input search" placeholder="Поиск по номеру заказа, клиенту, адресу или статусу" value={search} onChange={(e) => setSearch(e.target.value)} />
      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Загрузка...</p>}
      {!loading && !error && orders.length === 0 && <p className="muted">{debounced ? `Заказы по запросу «${debounced}» не найдены.` : "Заказов пока нет."}</p>}
      {orders.map((order) => (
        <div key={order.id} className="order">
          <div className="between order-head">
            <strong>Чек (заказ) №{order.id} · {order.userName}</strong>
            <span className="actions-cell">
              <span className={`status ${order.isPaid ? "status-delivered" : "status-processing"}`}>
                {PAYMENT_STATUSES[order.paymentStatus] || order.paymentLabel}
              </span>
              <select
                className="input status-select"
                value={order.status}
                disabled={busyId === order.id}
                onChange={(e) => changeStatus(order, e.target.value)}
              >
                {Object.entries(ORDER_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </span>
          </div>
          <p className="muted small">
            {order.userEmail} · {order.userPhone || "телефон не указан"} · оформлен {formatDate(order.createdAt)} · доставка {formatDay(order.deliveryDate)} · {order.address}
          </p>
          <ul className="order-items">
            {order.items.map((item, i) => (
              <li key={i} className="between small"><span>{item.carName} × {item.quantity}</span><span>{rub(item.priceAfter)}</span></li>
            ))}
          </ul>
          <div className="between">
            <strong>Общая сумма заказа №{order.id}: {rub(order.totalAfter)}</strong>
            {order.isPaid ? (
              <span className="success small">
                Оплачен{order.paidAt ? ` ${formatDate(order.paidAt)}` : ""} — отменить оплату нельзя
              </span>
            ) : (
              <button className="btn btn-sm btn-primary" disabled={busyId === order.id} onClick={() => markPaid(order)}>
                Отметить оплаченным
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AdminOrders;
