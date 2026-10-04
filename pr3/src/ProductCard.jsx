function ProductCard({ car, textColor, btnStyle, onAdd }) {
  const finalPrice = car.price * (1 - car.discount_percent / 100);

  return (
    <div style={{ width: "100%", textAlign: "center", border: "1px solid #888", padding: "8px", boxSizing: "border-box" }}>
      <img src={car.image_url} alt={car.name} style={{ width: "100%", height: "110px", objectFit: "cover" }} />
      <p style={{ color: textColor, margin: "5px 0" }}>{car.name}</p>
      {car.discount_percent > 0 ? (
        <p style={{ margin: "5px 0" }}>
          <span style={{ textDecoration: "line-through", color: "#888", marginRight: "6px" }}>
            {car.price.toLocaleString("ru-RU")} ₽
          </span>
          <span style={{ color: "#c0392b" }}>{Math.round(finalPrice).toLocaleString("ru-RU")} ₽</span>
        </p>
      ) : (
        <p style={{ color: textColor, margin: "5px 0" }}>{car.price.toLocaleString("ru-RU")} ₽</p>
      )}
      <button onClick={onAdd} style={btnStyle}>В корзину</button>
    </div>
  );
}

export default ProductCard;