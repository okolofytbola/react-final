import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import DiscountBadge from "./DiscountBadge";
import Reviews from "./Reviews";
import { rub, isStaff, stars, MAX_QTY_PER_ITEM } from "./utils";

function ProductCard({ car, onReviewsChanged }) {
  const { user } = useAuth();
  const { cart, addToCart } = useCart();
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [showReviews, setShowReviews] = useState(false);

  const staff = isStaff(user);

  const freeStock = Number(car.available ?? car.stock ?? 0);
  const reservedByOthers = Number(car.reserved || 0);
  const allSoldOut = Number(car.stock) === 0;
  const outOfStock = freeStock === 0;
  const zeroPrice = car.finalPrice < 1 || car.purchasable === false;
  const inCart = cart.find((item) => item.carId === car.id);
  const inCartQty = inCart ? inCart.quantity : 0;

  const maxQty = Math.max(0, Math.min(MAX_QTY_PER_ITEM, freeStock));
  const limitReached = inCartQty >= maxQty;

  const lowStock = !outOfStock && freeStock <= 3;

  async function handleAdd() {
    if (!user) {
      navigate("/login");
      return;
    }
    if (outOfStock) {
      setError(
        allSoldOut
          ? "Товар закончился — все машины этой модели выкуплены"
          : "Товар закончился — все свободные машины сейчас в корзинах других покупателей"
      );
      return;
    }
    if (limitReached) {
      setError(`Больше ${maxQty} шт. этой модели не добавить (${inCartQty} уже в корзине). Другие товары доступны`);
      return;
    }
    setError("");
    setStatus("adding");
    try {
      await addToCart(car.id);
      setStatus("added");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <article className="product">
      <img className="product-img" src={car.imageUrl} alt={car.name} loading="lazy" />
      <div className="product-body">
        {car.categoryName && <span className="tag">{car.categoryName}</span>}
        {allSoldOut && <span className="badge badge-sale product-soldout">Распродано</span>}
        {!allSoldOut && outOfStock && <span className="badge badge-sale product-soldout">Разобрали</span>}
        <h3 className="product-name">{car.name}</h3>
        <p className="product-desc">{car.description}</p>
        <ul className="product-meta">
          <li>Срок владения: {car.ownedYears} г.</li>
          <li>Пробег: {car.mileageKm.toLocaleString("ru-RU")} км</li>
          <li className="muted">Код: {car.code}</li>
          <li className={outOfStock ? "error" : lowStock ? "low-stock" : "muted"}>
            {outOfStock
              ? allSoldOut
                ? "Товар закончился — все машины выкуплены"
                : inCartQty > 0
                  ? `Свободных машин нет — ваши ${inCartQty} шт. уже в корзине`
                  : "Товар закончился — машины разобрали другие покупатели"
              : lowStock
                ? `Осталось мало: всего ${freeStock} шт.`
                : `В наличии: ${freeStock} шт.`}
          </li>
          {reservedByOthers > 0 && !outOfStock && (
            <li className="muted">Ещё {reservedByOthers} шт. в корзинах других покупателей</li>
          )}
        </ul>
        <div className="product-price">
          {car.discount > 0 && <span className="old-price">{rub(car.price)}</span>}
          <span className={car.discount > 0 ? "new-price" : "price"}>{rub(car.finalPrice)}</span>
        </div>
        <DiscountBadge item={car} />
        <button className="link-btn" onClick={() => setShowReviews((v) => !v)}>
          <span className="stars">{car.reviewsCount > 0 ? stars(Math.round(car.ratingAvg)) : "☆☆☆☆☆"}</span>{" "}
          {car.reviewsCount > 0 ? `${car.ratingAvg} · отзывов: ${car.reviewsCount}` : "Нет отзывов"} {showReviews ? "▲" : "▼"}
        </button>
        {showReviews && <Reviews carId={car.id} onChanged={onReviewsChanged} />}
        {error && <p className="error small">{error}</p>}
        {inCartQty > 0 && (
          <p className="muted small">
            {maxQty > inCartQty
              ? `В корзине: ${inCartQty} шт. (можно до ${maxQty})`
              : `В корзине: ${inCartQty} шт. — это всё, что осталось свободного`}
          </p>
        )}
        {!staff && (
          <button
            className="btn btn-primary btn-block"
            onClick={handleAdd}
            disabled={status === "adding" || zeroPrice || outOfStock || limitReached}
          >
            {outOfStock
              ? allSoldOut
                ? "Товар закончился"
                : "Машины разобрали"
              : zeroPrice
                ? "Цена 0 ₽ — товар недоступен"
                : limitReached
                  ? `В корзине уже ${inCartQty} из ${maxQty} шт.`
                  : !user
                    ? "Войти, чтобы купить"
                    : status === "adding"
                      ? "Добавляем..."
                      : status === "added"
                        ? "Добавлено ✓"
                        : "В корзину"}
          </button>
        )}
      </div>
    </article>
  );
}

export default ProductCard;
