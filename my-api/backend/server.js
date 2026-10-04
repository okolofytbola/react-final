const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on("connect", () => {
  console.log("Подключение к PostgreSQL установлено");
});

pool.on("error", (err) => {
  console.error("Ошибка подключения к PostgreSQL:", err);
});

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return candidate === hash;
}

async function seedIfEmpty() {
  const rolesCount = await pool.query("SELECT COUNT(*) FROM roles");
  if (Number(rolesCount.rows[0].count) === 0) {
    await pool.query("INSERT INTO roles (name) VALUES ('admin'), ('user')");
  }

  const usersCount = await pool.query("SELECT COUNT(*) FROM users");
  if (Number(usersCount.rows[0].count) === 0) {
    const gold = await pool.query("SELECT id FROM coupons WHERE code = 'GOLD'");
    const goldId = gold.rows[0] ? gold.rows[0].id : null;
    await pool.query(
      "INSERT INTO users (email, password_hash, full_name, address, role_id, coupon_id) VALUES ($1, $2, $3, $4, $5, $6)",
      ["admin@lada.shop", hashPassword("admin123"), "Администратор", "", 1, null]
    );
    await pool.query(
      "INSERT INTO users (email, password_hash, full_name, address, role_id, coupon_id) VALUES ($1, $2, $3, $4, $5, $6)",
      ["user@lada.shop", hashPassword("user123"), "Иван Петров", "г. Тольятти, ул. Южное шоссе, 36", 2, goldId]
    );
  }
}

const sessions = new Map();

function createSession(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, userId);
  return token;
}

async function userById(userId) {
  const result = await pool.query(
    "SELECT users.*, roles.name AS role FROM users JOIN roles ON roles.id = users.role_id WHERE users.id = $1",
    [userId]
  );
  return result.rows[0];
}

function publicUser(user, token) {
  return { token, id: user.id, email: user.email, fullName: user.full_name, address: user.address, role: user.role };
}

const app = express();
app.use(cors());
app.use(express.json());

async function requireAuth(req, res, next) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const userId = sessions.get(token);
  const user = userId ? await userById(userId) : null;
  if (!user) {
    res.status(401).json({ error: "Сессия истекла, войдите заново" });
    return;
  }
  req.currentUser = user;
  next();
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.currentUser.role !== "admin") {
      res.status(403).json({ error: "Доступно только администратору" });
      return;
    }
    next();
  });
}

app.get("/api/test", (req, res) => {
  res.json({ message: "API работает!", timestamp: new Date() });
});

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");
    res.json({ message: "Подключение к БД работает!", current_time: result.rows[0].current_time });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/register", async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Укажите email и пароль" });
    return;
  }
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows[0]) {
    res.status(409).json({ error: "Такой email уже зарегистрирован" });
    return;
  }
  const info = await pool.query(
    "INSERT INTO users (email, password_hash, full_name, role_id) VALUES ($1, $2, $3, 2) RETURNING id",
    [email, hashPassword(password), fullName || email]
  );
  const user = await userById(info.rows[0].id);
  const token = createSession(user.id);
  res.json(publicUser(user, token));
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query(
    "SELECT users.*, roles.name AS role FROM users JOIN roles ON roles.id = users.role_id WHERE email = $1",
    [email]
  );
  const user = result.rows[0];
  if (!user || !checkPassword(password, user.password_hash)) {
    res.status(401).json({ error: "Неверный email или пароль" });
    return;
  }
  const token = createSession(user.id);
  res.json(publicUser(user, token));
});

app.post("/api/logout", requireAuth, (req, res) => {
  const header = req.header("authorization") || "";
  sessions.delete(header.slice(7));
  res.json({ ok: true });
});

app.put("/api/profile", requireAuth, async (req, res) => {
  const { currentPassword, email, password, address } = req.body;
  const user = req.currentUser;
  if (!currentPassword || !checkPassword(currentPassword, user.password_hash)) {
    res.status(401).json({ error: "Текущий пароль указан неверно" });
    return;
  }
  const newEmail = email || user.email;
  const newHash = password ? hashPassword(password) : user.password_hash;
  const newAddress = address === undefined ? user.address : address;
  try {
    await pool.query("UPDATE users SET email = $1, password_hash = $2, address = $3 WHERE id = $4", [
      newEmail,
      newHash,
      newAddress,
      user.id,
    ]);
  } catch {
    res.status(409).json({ error: "Такой email уже занят" });
    return;
  }
  res.json({ email: newEmail, address: newAddress });
});

app.get("/api/categories", async (req, res) => {
  const result = await pool.query("SELECT * FROM categories ORDER BY name");
  res.json(result.rows);
});

app.post("/api/categories", requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: "Название категории не может быть пустым" });
    return;
  }
  try {
    const result = await pool.query("INSERT INTO categories (name) VALUES ($1) RETURNING id, name", [name.trim()]);
    res.json(result.rows[0]);
  } catch {
    res.status(409).json({ error: "Такая категория уже существует" });
  }
});

app.get("/api/coupons", requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT coupons.*, (
       SELECT STRING_AGG(email, ', ') FROM users WHERE users.coupon_id = coupons.id
     ) AS assigned_emails FROM coupons`
  );
  res.json(result.rows);
});

app.post("/api/coupons", requireAdmin, async (req, res) => {
  const { code, name, discountPercent } = req.body;
  if (!code || !name || !discountPercent) {
    res.status(400).json({ error: "Заполните все поля купона" });
    return;
  }
  if (discountPercent < 1 || discountPercent > 99) {
    res.status(400).json({ error: "Скидка должна быть от 1 до 99%" });
    return;
  }
  try {
    const result = await pool.query(
      "INSERT INTO coupons (code, name, discount_percent) VALUES ($1, $2, $3) RETURNING id",
      [code.trim().toUpperCase(), name.trim(), discountPercent]
    );
    res.json({ id: result.rows[0].id });
  } catch {
    res.status(409).json({ error: "Купон с таким кодом уже существует" });
  }
});

app.put("/api/coupons/:id/assign", requireAdmin, async (req, res) => {
  const couponId = Number(req.params.id);
  const { userId } = req.body;
  await pool.query("UPDATE users SET coupon_id = $1 WHERE id = $2", [couponId, userId]);
  res.json({ ok: true });
});

app.get("/api/users", requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT users.id, users.email, users.full_name, roles.name AS role, coupons.name AS coupon_name
     FROM users JOIN roles ON roles.id = users.role_id
     LEFT JOIN coupons ON coupons.id = users.coupon_id`
  );
  res.json(result.rows);
});

app.get("/api/cars", async (req, res) => {
  const { search, categoryIds } = req.query;
  let sql =
    "SELECT id, code, name, description, price::float8 AS price, image_url, category_id, discount_percent, owned_years, mileage_km FROM cars WHERE 1=1";
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length})`;
  }
  if (categoryIds) {
    const ids = categoryIds.split(",").map(Number);
    params.push(ids);
    sql += ` AND category_id = ANY($${params.length})`;
  }
  sql += " ORDER BY id";
  const result = await pool.query(sql, params);
  res.json(result.rows);
});

app.put("/api/cars/:id/discount", requireAdmin, async (req, res) => {
  const { discountPercent } = req.body;
  if (discountPercent < 0 || discountPercent > 99) {
    res.status(400).json({ error: "Скидка должна быть от 0 до 99%" });
    return;
  }
  await pool.query("UPDATE cars SET discount_percent = $1 WHERE id = $2", [discountPercent, Number(req.params.id)]);
  res.json({ ok: true });
});

function effectiveDiscount(user, car) {
  if (user && user.coupon_discount) return user.coupon_discount;
  return car.discount_percent;
}

app.get("/api/cart", requireAuth, async (req, res) => {
  const userId = req.currentUser.id;
  const userResult = await pool.query(
    `SELECT users.id, coupons.discount_percent AS coupon_discount
     FROM users LEFT JOIN coupons ON coupons.id = users.coupon_id WHERE users.id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  const rows = await pool.query(
    `SELECT cart_items.id, cart_items.quantity, cars.id AS car_id, cars.name, cars.price::float8 AS price,
            cars.image_url, cars.discount_percent, cars.owned_years, cars.mileage_km FROM cart_items
     JOIN cars ON cars.id = cart_items.car_id WHERE cart_items.user_id = $1`,
    [userId]
  );
  const items = rows.rows.map((row) => {
    const discount = effectiveDiscount(user, row);
    const priceBefore = row.price * row.quantity;
    const priceAfter = priceBefore * (1 - discount / 100);
    return { ...row, discount, priceBefore, priceAfter };
  });
  res.json(items);
});

app.post("/api/cart", requireAuth, async (req, res) => {
  const userId = req.currentUser.id;
  const { carId } = req.body;
  if (req.currentUser.role === "admin") {
    res.status(403).json({ error: "Администратору корзина недоступна" });
    return;
  }
  const existing = await pool.query("SELECT * FROM cart_items WHERE user_id = $1 AND car_id = $2", [userId, carId]);
  if (existing.rows[0]) {
    await pool.query("UPDATE cart_items SET quantity = quantity + 1 WHERE id = $1", [existing.rows[0].id]);
  } else {
    await pool.query("INSERT INTO cart_items (user_id, car_id, quantity) VALUES ($1, $2, 1)", [userId, carId]);
  }
  res.json({ ok: true });
});

app.put("/api/cart/:id", requireAuth, async (req, res) => {
  const { quantity } = req.body;
  if (quantity <= 0) {
    await pool.query("DELETE FROM cart_items WHERE id = $1 AND user_id = $2", [Number(req.params.id), req.currentUser.id]);
  } else {
    await pool.query("UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3", [
      quantity,
      Number(req.params.id),
      req.currentUser.id,
    ]);
  }
  res.json({ ok: true });
});

app.delete("/api/cart/:id", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM cart_items WHERE id = $1 AND user_id = $2", [Number(req.params.id), req.currentUser.id]);
  res.json({ ok: true });
});

app.post("/api/orders", requireAuth, async (req, res) => {
  const userId = req.currentUser.id;
  const { address } = req.body;
  const userResult = await pool.query(
    `SELECT users.id, coupons.discount_percent AS coupon_discount
     FROM users LEFT JOIN coupons ON coupons.id = users.coupon_id WHERE users.id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  const rows = await pool.query(
    `SELECT cart_items.id, cart_items.quantity, cars.name, cars.price::float8 AS price, cars.discount_percent,
            cars.owned_years, cars.mileage_km
     FROM cart_items JOIN cars ON cars.id = cart_items.car_id WHERE cart_items.user_id = $1`,
    [userId]
  );
  if (rows.rows.length === 0) {
    res.status(400).json({ error: "Корзина пуста" });
    return;
  }
  const finalAddress = address && address.trim() ? address.trim() : req.currentUser.address;
  if (!finalAddress) {
    res.status(400).json({ error: "Укажите адрес доставки" });
    return;
  }
  let totalBefore = 0;
  let totalAfter = 0;
  const items = rows.rows.map((row) => {
    const discount = effectiveDiscount(user, row);
    const priceBefore = row.price * row.quantity;
    const priceAfter = priceBefore * (1 - discount / 100);
    totalBefore += priceBefore;
    totalAfter += priceAfter;
    const details = `${row.owned_years} г. владения · ${row.mileage_km.toLocaleString("ru-RU")} км`;
    return { carName: row.name, details, discount, priceBefore, priceAfter, quantity: row.quantity };
  });
  const orderInfo = await pool.query(
    "INSERT INTO orders (user_id, address, total_before, total_after) VALUES ($1, $2, $3, $4) RETURNING id",
    [userId, finalAddress, totalBefore, totalAfter]
  );
  const orderId = orderInfo.rows[0].id;
  for (const item of items) {
    await pool.query(
      `INSERT INTO order_items (order_id, car_name, car_details, discount_percent, price_before, price_after, quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orderId, item.carName, item.details, item.discount, item.priceBefore, item.priceAfter, item.quantity]
    );
  }
  await pool.query("DELETE FROM cart_items WHERE user_id = $1", [userId]);
  res.json({ orderId, address: finalAddress, totalBefore, totalAfter, items });
});

app.get("/api/orders", requireAuth, async (req, res) => {
  const orders = await pool.query(
    "SELECT id, address, total_before::float8 AS total_before, total_after::float8 AS total_after, created_at FROM orders WHERE user_id = $1 ORDER BY id DESC",
    [req.currentUser.id]
  );
  const result = [];
  for (const order of orders.rows) {
    const items = await pool.query(
      `SELECT car_name, car_details, discount_percent, price_before::float8 AS price_before,
              price_after::float8 AS price_after, quantity FROM order_items WHERE order_id = $1`,
      [order.id]
    );
    result.push({ ...order, items: items.rows });
  }
  res.json(result);
});

app.use((req, res) => {
  res.status(404).json({ error: "Такого адреса на сервере нет" });
});

const PORT = process.env.PORT || 3001;

seedIfEmpty().then(() => {
  app.listen(PORT, () => console.log(`Сервер запущен на http://localhost:${PORT}`));
});