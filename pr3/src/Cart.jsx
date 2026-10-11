import { Link, useNavigate } from "react-router-dom";
import { useCart } from "./CartContext";
import DiscountBadge from "./DiscountBadge";
import { rub, MAX_QTY_PER_ITEM } from "./utils";

function Cart() {
  const { cart, totals, dayCapacity, reserveMinutes, loading, loaded, error, changeQuantity, removeItem, reloadCart } = useCart();
  const navigate = useNavigate();
  const tooManyForOneDay = totals.itemsCount > dayCapacity;
  const reserve = reserveMinutes || 60;

  return (
    <div className="page">
      <h1>Корзина</h1>
      <p className="muted small">
        <strong>Ваши машины забронированы.</strong> Пока товар лежит в корзине, он считается занятым — другие
        покупатели видят его как разобранный. Бронь держится {reserve} минут (потом машины снова становятся
        свободными), после оформления заказа машины списываются со склада окончательно.
        <br />
        <strong>Лимиты:</strong> за раз можно взять не больше {MAX_QTY_PER_ITEM} шт. одной модели, а на один день
        доставки магазин отдаёт не больше {dayCapacity} машин всего (столько сотрудников и автовозов) — в корзине
        сейчас {totals.itemsCount} шт.{" "}
        {tooManyForOneDay
          ? ` Это больше, чем влезает в один день: оформите заказ частями, например ${dayCapacity} машин на одну дату, остальное на другую.`
          : "."}
      </p>
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
          <button className="btn btn-sm" onClick={reloadCart}>Повторить</button>
        </div>
      )}
      {(loading || !loaded) && cart.length === 0 && !error && <p className="muted">Загрузка корзины...</p>}
      {loaded && !loading && cart.length === 0 && !error && (
        <div className="empty">
          <p>Корзина пуста.</p>
          <Link className="btn btn-primary" to="/">Перейти в каталог</Link>
        </div>
      )}

      {cart.length > 0 && (
        <div className="cart-layout">
          <div className="cart-list">
            {cart.map((item) => (
              <div key={item.id} className="cart-item card">
                <img src={item.imageUrl} alt={item.name} className="cart-img" />
                <div className="cart-info">
                  <h3>{item.name}</h3>
                  <p className="muted small">
                    Код: {item.code} · {item.ownedYears} г. владения · {item.mileageKm.toLocaleString("ru-RU")} км
                  </p>
                  <p className="small">
                    Цена за шт.:{" "}
                    {item.discount > 0 && <span className="old-price">{rub(item.unitPrice)}</span>}{" "}
                    <strong>{rub(item.unitFinal)}</strong>
                  </p>
                  <p className={item.outOfStock || item.stockShortage ? "error small" : "muted small"}>
                    {item.outOfStock
                      ? "Товар закончился — все машины выкуплены, уберите его из корзины"
                      : item.stockShortage
                        ? `Осталось всего ${item.stock} шт. — уменьшите количество до ${item.stock}`
                        : `На складе: ${item.stock} шт. · ваши ${item.quantity} шт. забронированы${item.reservedUntil ? ` до ${new Date(item.reservedUntil).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
                  </p>
                  <DiscountBadge item={item} />
                  <div className="qty-row">
                    <div className="qty">
                      <button className="btn btn-sm" disabled={item.quantity <= 1} onClick={() => changeQuantity(item.id, item.quantity - 1)} aria-label="Уменьшить">
                        −
                      </button>
                      <span className="qty-value">{item.quantity}</span>
                      <button
                        className="btn btn-sm"
                        disabled={item.quantity >= Math.min(MAX_QTY_PER_ITEM, item.stock)}
                        onClick={() => changeQuantity(item.id, item.quantity + 1)}
                        aria-label="Увеличить"
                      >
                        +
                      </button>
                    </div>
                    <button className="btn btn-sm btn-danger" onClick={() => removeItem(item.id)}>Удалить</button>
                  </div>
                  <p className="muted small">
                    {item.quantity >= Math.min(MAX_QTY_PER_ITEM, item.stock)
                      ? `Больше не добавить: на складе ${item.stock} шт., в корзине ${item.quantity}. Другие товары доступны`
                      : `Можно до ${Math.min(MAX_QTY_PER_ITEM, item.stock)} шт. этого товара`}
                  </p>
                </div>
                <div className="cart-sum">
                  {item.discount > 0 && <div className="old-price">{rub(item.priceBefore)}</div>}
                  <div className="line-total">{rub(item.priceAfter)}</div>
                </div>
              </div>
            ))}
          </div>

          <aside className="summary card">
            <h3>Чек</h3>
            <ul className="receipt-lines">
              {cart.map((item) => (
                <li key={item.id}>
                  <div className="between">
                    <span>{item.name} × {item.quantity}</span>
                    <span>{rub(item.priceBefore)}</span>
                  </div>
                  {item.discount > 0 && (
                    <div className="between muted small">
                      <span>{item.discountSource === "coupon" ? `Купон ${item.couponCode}` : "Скидка на товар"} −{item.discount}%</span>
                      <span>−{rub(item.saved)}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="between"><span>Цена до скидок</span><span>{rub(totals.totalBefore)}</span></div>
            <div className="between"><span>Скидка</span><span className="success">−{rub(totals.totalSaved)}</span></div>
            <div className="between total"><span>Итого</span><span>{rub(totals.totalAfter)}</span></div>
            <button className="btn btn-primary btn-block mt" onClick={() => navigate("/checkout")}>
              Оформить заказ
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

export default Cart;
