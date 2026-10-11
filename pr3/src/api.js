const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

export class ApiError extends Error {
  constructor(message, { kind, status, code } = {}) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

async function request(path, token, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      "Сервер временно недоступен: ведутся технические работы. Пожалуйста, повторите попытку позже.",
      { kind: "network" }
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      (data && data.error) ||
      (response.status >= 500
        ? `Ошибка на сервере (код ${response.status}), подробности не переданы`
        : `Ошибка запроса (код ${response.status})`);
    if (data && data.code === "SESSION_EXPIRED" && token && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(message, {
      kind: response.status >= 500 ? "server" : "request",
      status: response.status,
      code: data && data.code,
    });
  }

  if (data === null) {
    throw new ApiError(`Сервер вернул непредвиденный ответ (код ${response.status})`, { kind: "server" });
  }
  return data;
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

export const checkHealth = () => request("/test-db", null);

export const login = (email, password) => request("/login", null, json("POST", { email, password }));
export const register = (data) => request("/register", null, json("POST", data));
export const logout = (token) => request("/logout", token, { method: "POST" });
export const getProfile = (token) => request("/profile", token);
export const updateProfile = (token, data) => request("/profile", token, json("PUT", data));

export const requestPasswordCode = (email) => request("/password/forgot", null, json("POST", { email }));
export const resetPassword = (email, code, password) => request("/password/reset", null, json("POST", { email, code, password }));

export const getCategories = () => request("/categories", null);
export const addCategory = (token, name) => request("/categories", token, json("POST", { name }));
export const renameCategory = (token, id, name) => request(`/categories/${id}`, token, json("PUT", { name }));
export const deleteCategory = (token, id, moveTo) =>
  request(`/categories/${id}${moveTo ? `?moveTo=${moveTo}` : ""}`, token, { method: "DELETE" });

export const getCoupons = (token, search = "") =>
  request(`/coupons${search ? `?search=${encodeURIComponent(search)}` : ""}`, token);
export const addCoupon = (token, data) => request("/coupons", token, json("POST", data));
export const updateCoupon = (token, id, data) => request(`/coupons/${id}`, token, json("PUT", data));
export const deleteCoupon = (token, id) => request(`/coupons/${id}`, token, { method: "DELETE" });

export const getUsers = (token, search = "") =>
  request(`/users${search ? `?search=${encodeURIComponent(search)}` : ""}`, token);
export const createUser = (token, data) => request("/users", token, json("POST", data));

export const setUserRole = (token, userId, role) => request(`/users/${userId}/role`, token, json("PUT", { role }));
export const setUserCoupon = (token, userId, couponId) =>
  request(`/users/${userId}/coupon`, token, json("PUT", { couponId }));

export const getCars = ({ token, search, categoryIds, onlyDiscount, sort, minPrice, maxPrice } = {}) => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (categoryIds && categoryIds.length) params.set("categoryIds", categoryIds.join(","));
  if (onlyDiscount) params.set("onlyDiscount", "1");
  if (sort) params.set("sort", sort);
  if (minPrice !== undefined && minPrice !== "") params.set("minPrice", minPrice);
  if (maxPrice !== undefined && maxPrice !== "") params.set("maxPrice", maxPrice);
  const query = params.toString();
  return request(`/cars${query ? `?${query}` : ""}`, token || null);
};

export const getDeliveryCapacity = (days = 21) => request(`/delivery/capacity?days=${days}`, null);
export const deleteCar = (token, id) => request(`/cars/${id}`, token, { method: "DELETE" });
export const createCar = (token, data) => request("/cars", token, json("POST", data));
export const updateCar = (token, id, data) => request(`/cars/${id}`, token, json("PUT", data));

export const getCart = (token) => request("/cart", token);
export const addToCart = (token, carId) => request("/cart", token, json("POST", { carId }));
export const updateCartQuantity = (token, itemId, quantity) => request(`/cart/${itemId}`, token, json("PUT", { quantity }));
export const removeFromCart = (token, itemId) => request(`/cart/${itemId}`, token, { method: "DELETE" });
export const checkout = (token, address, deliveryDate, saveAddress) =>
  request("/orders", token, json("POST", { address, deliveryDate, saveAddress }));
export const getOrders = (token) => request("/orders", token);
export const payOrder = (token, id) => request(`/orders/${id}/pay`, token, { method: "POST" });

export const getAllOrders = (token, search = "") =>
  request(`/admin/orders${search ? `?search=${encodeURIComponent(search)}` : ""}`, token);
export const setOrderStatus = (token, id, status) => request(`/orders/${id}/status`, token, json("PUT", { status }));
export const setOrderPayment = (token, id, paymentStatus) =>
  request(`/orders/${id}/payment`, token, json("PUT", { paymentStatus }));

export const getCarReviews = (token, carId) => request(`/cars/${carId}/reviews`, token || null);
export const addReview = (token, carId, data) => request(`/cars/${carId}/reviews`, token, json("POST", data));
export const getAllReviews = (token, search = "") =>
  request(`/reviews${search ? `?search=${encodeURIComponent(search)}` : ""}`, token);
export const updateReview = (token, id, data) => request(`/reviews/${id}`, token, json("PUT", data));
export const deleteReview = (token, id) => request(`/reviews/${id}`, token, { method: "DELETE" });
