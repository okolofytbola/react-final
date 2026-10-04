const BASE_URL = "http://localhost:3001/api";

async function request(path, token, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("Сервер недоступен. Проверьте, что backend запущен на http://localhost:3001");
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    throw new Error(`Сервер вернул непредвиденный ответ (код ${response.status})`);
  }

  if (!response.ok) {
    throw new Error(data.error || `Ошибка запроса (код ${response.status})`);
  }
  return data;
}

export function login(email, password) {
  return request("/login", null, { method: "POST", body: JSON.stringify({ email, password }) });
}

export function register(email, password, fullName) {
  return request("/register", null, { method: "POST", body: JSON.stringify({ email, password, fullName }) });
}

export function updateProfile(token, currentPassword, email, password, address) {
  return request("/profile", token, {
    method: "PUT",
    body: JSON.stringify({ currentPassword, email, password, address }),
  });
}

export function getCategories() {
  return request("/categories", null);
}

export function addCategory(token, name) {
  return request("/categories", token, { method: "POST", body: JSON.stringify({ name }) });
}

export function getCoupons(token) {
  return request("/coupons", token);
}

export function addCoupon(token, code, name, discountPercent) {
  return request("/coupons", token, { method: "POST", body: JSON.stringify({ code, name, discountPercent }) });
}

export function assignCoupon(token, couponId, targetUserId) {
  return request(`/coupons/${couponId}/assign`, token, {
    method: "PUT",
    body: JSON.stringify({ userId: targetUserId }),
  });
}

export function getUsers(token) {
  return request("/users", token);
}

export function getCars(search, categoryIds) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (categoryIds && categoryIds.length) params.set("categoryIds", categoryIds.join(","));
  const query = params.toString();
  return request(`/cars${query ? `?${query}` : ""}`, null);
}

export function setCarDiscount(token, carId, discountPercent) {
  return request(`/cars/${carId}/discount`, token, {
    method: "PUT",
    body: JSON.stringify({ discountPercent }),
  });
}

export function getCart(token) {
  return request("/cart", token);
}

export function addToCart(token, carId) {
  return request("/cart", token, { method: "POST", body: JSON.stringify({ carId }) });
}

export function updateCartQuantity(token, itemId, quantity) {
  return request(`/cart/${itemId}`, token, { method: "PUT", body: JSON.stringify({ quantity }) });
}

export function removeFromCart(token, itemId) {
  return request(`/cart/${itemId}`, token, { method: "DELETE" });
}

export function checkout(token, address) {
  return request("/orders", token, { method: "POST", body: JSON.stringify({ address }) });
}