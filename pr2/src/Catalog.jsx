import { useNavigate } from "react-router-dom";
import { useCart } from "./CartContext";
import { useTheme } from "./ThemeContext";
import ProductCard from "./ProductCard";

const products = [
  { id: 1, name: "Наушники", price: 55000, image: "https://images.biggeek.ru/1/870/e42d/28401-970airpods-4-hero-select-202409@2x.jpg" },
  { id: 2, name: "Kappa", price: 1200, image: "https://avatars.mds.yandex.net/get-mpic/16435911/2a0000019a4691b4935177a0088906cb2f77/450x600" },
  { id: 3, name: "lada", price: 2500, image: "https://avatars.avto.ru/get-autoru-vos/20543926/069f4f298569575dfa746373e0e9bade/1200x900" },
  { id: 4, name: "Айфон", price: 15000, image: "https://ae-pic-a1.aliexpress-media.com/kf/Sca5c2b8558734b788cddd7255f0606b97.jpg_480x480.jpg" },
  { id: 5, name: "Ноутбук", price: 3200, image: "https://www.mmcomp.pl/userdata/public/gfx/108103/Laptop-Lenovo-ThinkPad-T14-G6-Ultra-7-265U-16GB-DDR5-256GB-SSD-WUXGA-IPS-Marka-Lenovo.webp" },
];

function Catalog() {
  const { addToCart } = useCart();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const textColor = theme === "light" ? "#000000" : "#ffffff";
  const btnStyle = {
    backgroundColor: theme === "light" ? "#eeeeee" : "#444444",
    color: textColor,
  };

  function handleAdd(product) {
    addToCart(product);
    navigate("/cart");
  }

  return (
    <div style={{ padding: "10px" }}>
      <h1 style={{ color: textColor }}>Каталог товаров</h1>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            name={product.name}
            price={product.price}
            image={product.image}
            textColor={textColor}
            btnStyle={btnStyle}
            onAdd={() => handleAdd(product)}
          />
        ))}
      </div>
    </div>
  );
}

export default Catalog;