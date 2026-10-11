import { discountText } from "./utils";

function DiscountBadge({ item }) {
  if (!item.discount) return null;
  return (
    <span className={`badge ${item.discountSource === "coupon" ? "badge-coupon" : "badge-sale"}`}>
      {discountText(item)}
    </span>
  );
}

export default DiscountBadge;
