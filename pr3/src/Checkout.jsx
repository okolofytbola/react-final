import { useState, useEffect, useCallback, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import DiscountBadge from "./DiscountBadge";
import { rub, formatDate, formatDay, todayISO, PAYMENT_STATUSES, useOnRecovered } from "./utils";
import * as api from "./api";

function Receipt({ order }) {
  const saved = order.totalBefore - order.totalAfter;
  return (
    <div className="page narrow">
      <div className="card receipt">
        <div className="success-mark">✓</div>
        <h1>Заказ оформлен</h1>
        <p className="muted center">Чек №{order.orderId} · {formatDate(order.createdAt)}</p>
        <p className="center">Адрес доставки: <strong>{order.address}</strong></p>
        <p className="center">Дата доставки: <strong>{formatDay(order.deliveryDate)}</strong></p>
        <p className="center">
          Статус оплаты: <strong className="status status-processing">{PAYMENT_STATUSES[order.paymentStatus] || "Ожидает оплаты"}</strong>
        </p>
        <ul className="receipt-lines">
          {order.items.map((item, i) => (
            <li key={i}>
              <div className="between">
                <span>{item.carName} × {item.quantity}</span>
                <span>{rub(item.priceBefore)}</span>
              </div>
              {item.discount > 0 && (
                <div className="between muted small">
                  <span>
                    {item.discountSource === "coupon" ? `Купон ${item.couponCode}` : "Скидка на товар"} −{item.discount}%
                  </span>
                  <span>итого {rub(item.priceAfter)}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="between"><span>Цена до скидок</span><span>{rub(order.totalBefore)}</span></div>
        <div className="between"><span>Скидка</span><span className="success">−{rub(saved)}</span></div>
        <div className="between total"><span>Итого к оплате (одна сумма на заказ №{order.orderId})</span><span>{rub(order.totalAfter)}</span></div>
        {order.couponBurned && (
          <p className="muted small center">
            Приветственный купон сработал в первый раз и больше не действует — он выдаётся только на первый заказ.
          </p>
        )}
        <p className="muted small center">
          Оплатить заказ можно в разделе «Профиль → Мои заказы». После оплаты вернуть статус «Ожидает оплаты» нельзя.
        </p>
        <div className="actions center">
          <Link className="btn btn-primary" to="/">В каталог</Link>
          <Link className="btn" to="/profile">История заказов</Link>
        </div>
      </div>
    </div>
  );
}

function Checkout() {
  const { user, updateUser } = useAuth();
  const { cart, totals, loaded, reloadCart } = useCart();
  const [address, setAddress] = useState(user.address || "");
  const [saveAddress, setSaveAddress] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(todayISO(1));
  const [capacity, setCapacity] = useState(null);
  const [capacityError, setCapacityError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState(null);
  const touched = useRef(false);

  useEffect(() => {
    if (!touched.current) setAddress(user.address || "");
  }, [user.address]);

  const loadCapacity = useCallback(() => {
    api
      .getDeliveryCapacity(21)
      .then((data) => {
        setCapacity(data);
        setCapacityError("");
      })
      .catch((err) => setCapacityError(err.message));
  }, []);

  useEffect(() => {
    loadCapacity();
  }, [loadCapacity]);
  useOnRecovered(loadCapacity);

  const dayInfo = capacity ? capacity.days.find((d) => d.date === deliveryDate) : null;
  const needSlots = totals.itemsCount;
  const dateFits = Boolean(dayInfo && dayInfo.available >= needSlots);
  const freeDates = capacity ? capacity.days.filter((d) => d.available >= needSlots) : [];

  if (order) return <Receipt order={order} />;
  if (!loaded) return <div className="page"><p className="muted">Загрузка...</p></div>;
  if (cart.length === 0) return <Navigate to="/cart" replace />;

  const differs = address.trim() !== (user.address || "").trim();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!address.trim()) {
      setError("Укажите адрес доставки");
      return;
    }
    if (!deliveryDate) {
      setError("Укажите дату доставки");
      return;
    }
    if (deliveryDate < todayISO()) {
      setError("Дата доставки не может быть раньше сегодняшнего дня");
      return;
    }
    if (dayInfo && !dateFits) {
      setError(
        dayInfo.full
          ? `На ${formatDay(deliveryDate)} мест больше нет: на этот день уже оформлено ${dayInfo.booked} из ${dayInfo.capacity} шт., поэтому все товары и категории закрыты. Выберите другую дату.`
          : `На ${formatDay(deliveryDate)} свободно ${dayInfo.available} мест, а в корзине ${needSlots} шт. Выберите дату со свободными местами или оформите заказ в два приёма (уменьшите количество и оформите остаток на другую дату).`
      );
      return;
    }
    if (totals.totalAfter < 1) {
      setError("Сумма заказа не может быть нулевой: товар с ценой 0 ₽ купить нельзя");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await api.checkout(user.token, address.trim(), deliveryDate, saveAddress || !user.address);
      if (saveAddress || !user.address) updateUser({ address: address.trim() });
      setOrder(result);
      loadCapacity();
      reloadCart();
    } catch (err) {
      setError(err.message);
      loadCapacity();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>Оформление заказа</h1>
      <form className="cart-layout" onSubmit={handleSubmit} noValidate>
        <div className="cart-list">
          <section className="card">
            <h3>Адрес доставки</h3>
            <p className="muted small">
              {user.address ? "Подставлен ваш основной адрес из профиля. Чтобы доставить по другому адресу — просто измените поле." : "Укажите адрес — он сохранится в профиле как основной."}
            </p>
            <input
              className="input"
              value={address}
              placeholder="Город, улица, дом, квартира"
              onChange={(e) => {
                touched.current = true;
                setAddress(e.target.value);
              }}
            />
            {differs && user.address && (
              <label className="check mt">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                <span>Сохранить этот адрес как основной</span>
              </label>
            )}
          </section>

          <section className="card">
            <h3>Дата доставки</h3>
            <p className="muted small">
              Дата не может быть раньше сегодняшней. Это лимит <strong>доставки</strong>, а не количество машин:
              в один день магазин может отдать не больше {capacity ? capacity.capacity : 10} машин по всем моделям
              (столько сотрудников и автовозов). Сколько машин есть на складе — видно в каталоге и в корзине.
            </p>
            <input className="input" type="date" min={todayISO()} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            {capacityError && <p className="error small">Не удалось получить свободные даты: {capacityError}</p>}
            {dayInfo && (
              <p className={`small ${dateFits ? "success" : "error"}`}>
                {dayInfo.full
                  ? `На ${formatDay(dayInfo.date)} мест нет: оформлено ${dayInfo.booked} из ${dayInfo.capacity} шт. — все товары и категории на этот день закрыты. Выберите другую дату.`
                  : dateFits
                    ? `На ${formatDay(dayInfo.date)} свободно ${dayInfo.available} из ${dayInfo.capacity} мест — для вашего заказа нужно ${needSlots}.`
                    : `На ${formatDay(dayInfo.date)} свободно только ${dayInfo.available} мест, а в корзине ${needSlots} шт. Выберите дату посвободнее или оформите заказ в два приёма.`}
              </p>
            )}
            {capacity && (
              <>
                <p className="muted small mt">Даты, куда влезает весь заказ ({needSlots} шт.):</p>
                <div className="date-chips">
                  {freeDates.slice(0, 8).map((d) => (
                    <button
                      type="button"
                      key={d.date}
                      className={`btn btn-sm ${d.date === deliveryDate ? "btn-primary" : ""}`}
                      onClick={() => setDeliveryDate(d.date)}
                    >
                      {formatDay(d.date)} · свободно {d.available}
                    </button>
                  ))}
                  {freeDates.length === 0 && (
                    <span className="error small">
                      Ни на одну из ближайших 3 недель заказ такого размера не влезает — уменьшите количество в корзине
                      или оформите заказ в два приёма (не больше {capacity.capacity} шт. на дату).
                    </span>
                  )}
                </div>
              </>
            )}
          </section>

          <section className="card">
            <h3>Состав заказа</h3>
            {cart.map((item) => (
              <div key={item.id} className="checkout-row">
                <img src={item.imageUrl} alt={item.name} className="checkout-img" />
                <div className="grow">
                  <strong>{item.name}</strong> × {item.quantity}
                  <div><DiscountBadge item={item} /></div>
                </div>
                <div className="cart-sum">
                  {item.discount > 0 && <div className="old-price">{rub(item.priceBefore)}</div>}
                  <div className="line-total">{rub(item.priceAfter)}</div>
                </div>
              </div>
            ))}
            <Link to="/cart" className="small">← Изменить состав в корзине</Link>
          </section>
        </div>

        <aside className="summary card">
          <h3>Итого</h3>
          <div className="between"><span>Цена до скидок</span><span>{rub(totals.totalBefore)}</span></div>
          <div className="between"><span>Скидка</span><span className="success">−{rub(totals.totalSaved)}</span></div>
          <div className="between total"><span>К оплате</span><span>{rub(totals.totalAfter)}</span></div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block mt" disabled={submitting}>
            {submitting ? "Оформляем..." : "Подтвердить заказ"}
          </button>
        </aside>
      </form>
    </div>
  );
}

export default Checkout;
