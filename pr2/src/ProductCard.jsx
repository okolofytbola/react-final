function ProductCard({ name, price, image, textColor, btnStyle, onAdd }) {
  return (
    <div style={{ width: "160px", textAlign: "center", marginRight: "15px", marginBottom: "15px" }}>
      <img src={image} alt={name} style={{ width: "100%", height: "120px", objectFit: "cover" }} />
      <p style={{ color: textColor, margin: "5px 0" }}>{name}</p>
      <p style={{ color: textColor, margin: "5px 0" }}>{price} руб.</p>
      <button onClick={onAdd} style={btnStyle}>В корзину</button>
    </div>
  );
}

export default ProductCard;