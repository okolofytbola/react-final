const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 3000,
});
pool.on("error", (err) => console.error("Ошибка соединения с PostgreSQL:", err.message || err.code));
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));

const q = (sql, params) => pool.query(sql, params);
const STARTED_AT = new Date().toISOString();

const SMTP_HOST = String(process.env.SMTP_HOST || process.env.MAIL_HOST || "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 587);
const SMTP_USER = String(process.env.SMTP_USER || process.env.SMTP_LOGIN || process.env.MAIL_USER || "").trim();

const SMTP_PASS = String(
  process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.MAIL_PASS || process.env.SMTP_PASSWD || ""
).trim();
const SMTP_SECURE = String(process.env.SMTP_SECURE || "") === "true" || SMTP_PORT === 465;

const MAIL_FROM =
  String(process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.MAIL_SENDER || "")
    .trim()
    .replace(/^["']|["']$/g, "") || (SMTP_USER ? `Lada Shop <${SMTP_USER}>` : "Lada Shop <no-reply@lada.shop>");

const MAIL_PLACEHOLDER = /ВАШ|ЗАМЕНИ|ваш_логин|логин@gmail|пароль_приложения|abcdefghijklmnop|example\.com/i;
const hasPlaceholder = (value) => MAIL_PLACEHOLDER.test(String(value || ""));
const MAIL_CONFIGURED =
  Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS) && !hasPlaceholder(SMTP_HOST) && !hasPlaceholder(SMTP_USER) && !hasPlaceholder(SMTP_PASS);
const MAIL_PLACEHOLDER_FOUND = Boolean(SMTP_HOST || SMTP_USER || SMTP_PASS) && !MAIL_CONFIGURED;

const SHOW_CODE_IN_BROWSER = String(process.env.MAIL_SHOW_CODE_IN_BROWSER || "").toLowerCase() === "true";

const SMTP_REQUIRE_TLS =
  process.env.SMTP_REQUIRE_TLS === undefined ? !SMTP_SECURE : String(process.env.SMTP_REQUIRE_TLS).toLowerCase() === "true";

let transporter = null;
function getTransporter() {
  if (!MAIL_CONFIGURED) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,

      requireTLS: SMTP_REQUIRE_TLS,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

function mailErrorHint(err) {
  const text = String((err && (err.response || err.message || err.code)) || "");
  if (/535|Username and Password not accepted|Invalid login|BadCredentials/i.test(text)) {
    return "Gmail отклонил логин или пароль. Для Gmail нужен «пароль приложения» из 16 символов (обычный пароль аккаунта не подходит). Включите двухэтапную аутентификацию и создайте пароль: https://myaccount.google.com/apppasswords";
  }
  if (/EAUTH/i.test(text)) return "Сервер почты не принял логин/пароль — проверьте SMTP_USER и SMTP_PASS в my-api/backend/.env";
  if (/ENOTFOUND|ETIMEDOUT|ECONNECTION|ESOCKET|ECONNREFUSED/i.test(text)) {
    return "Не удалось подключиться к SMTP-серверу — проверьте SMTP_HOST (smtp.gmail.com) и SMTP_PORT (465 или 587) и доступ в интернет";
  }
  if (/self signed|SSL|wrong version number/i.test(text)) {
    return "Проблема с шифрованием: для порта 465 нужен SMTP_SECURE=true, для порта 587 — наоборот без него";
  }
  return "";
}

async function sendResetCodeMail(email, code) {
  const text = [
    "Lada Shop — сброс пароля",
    "",
    `Ваш код подтверждения: ${code}`,
    "",
    "Код действует 15 минут и подходит только для одного сброса пароля.",
    "Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.",
  ].join("\n");
  const mail = getTransporter();
  if (!mail) {
    console.log(`\n=== ДЕМО-РЕЖИМ ПОЧТЫ (SMTP не настроен в my-api/backend/.env) ===`);
    console.log(`Кому: ${email}`);
    console.log(`Тема: Сброс пароля Lada Shop`);
    console.log(`Код подтверждения: ${code}`);
    console.log(`Настроить Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465,`);
    console.log(`                 SMTP_USER=ваш_логин@gmail.com, SMTP_PASS=пароль_приложения`);
    console.log(`=================================================================\n`);
    return { sent: false };
  }
  try {
    await mail.sendMail({ from: MAIL_FROM, to: email, subject: "Lada Shop — код для сброса пароля", text });
    return { sent: true };
  } catch (err) {
    console.error("Не удалось отправить письмо с кодом:", err.message);
    const hint = mailErrorHint(err);
    if (hint) console.error("Подсказка:", hint);
    return { sent: false, error: err.message, hint };
  }
}

function mailStatus() {
  return {
    configured: MAIL_CONFIGURED,
    devMode: !MAIL_CONFIGURED,
    showCodeInBrowser: SHOW_CODE_IN_BROWSER,
    requireTls: SMTP_REQUIRE_TLS,
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    user: SMTP_USER,
    from: MAIL_FROM,
    provider: /gmail/i.test(SMTP_HOST) ? "Gmail" : /mail\.ru|yandex|inbox/i.test(SMTP_HOST) ? "Mail.ru / Яндекс" : SMTP_HOST ? "Свой SMTP" : "не задан",
  };
}

const PHONE_EXAMPLE = "+7 (900) 123-45-67";

function normalizePhone(value) {
  const raw = String(value === undefined || value === null ? "" : value).trim();
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "8") digits = `7${digits.slice(1)}`;
  if (digits.length === 10 && digits[0] === "9") digits = `7${digits}`;
  if (digits.length !== 11 || digits[0] !== "7") {
    bad(`Телефон должен быть в формате ${PHONE_EXAMPLE}`);
  }
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}
const validPhone = (v) => {
  try {
    normalizePhone(v);
    return true;
  } catch {
    return false;
  }
};

const NAME_VOWELS = /[аеёиоуыэюяaeiouy]/i;
const KEYBOARD_MASH = ["йцук", "цуке", "фыва", "ывап", "ячсм", "чсми", "asdf", "sdfg", "dfgh", "qwer", "wert", "erty", "zxcv", "xcvb"];

function personName(raw, what = "ФИО") {
  const name = normName(raw);
  if (!name) bad(`Укажите ${what.toLowerCase()}`);
  maxLen(name, 100, what);
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 3) bad(`${what}: укажите фамилию и имя, например «Иванов Иван»`);
  for (const part of parts) {
    if (!/^[А-Яа-яЁёA-Za-z-]{2,}$/.test(part)) bad(`${what}: каждое слово — только буквы, минимум 2 символа (например, Иванов Иван Иванович)`);
    if (!NAME_VOWELS.test(part)) bad(`${what}: «${part}» не похоже на имя — введите настоящие фамилию и имя`);
    if (/(.)\1\1/i.test(part)) bad(`${what}: «${part}» не похоже на имя — введите настоящие фамилию и имя`);
    if (KEYBOARD_MASH.some((m) => part.toLowerCase().includes(m))) bad(`${what}: «${part}» похоже на случайный набор букв — введите настоящее имя`);
  }
  return parts
    .map((part) =>
      part
        .split("-")
        .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase())
        .join("-")
    )
    .join(" ");
}

const MAT_ROOTS = [
  "хуй", "хуя", "хую", "хуё", "хуе", "хуи", "херн", "херов",
  "пизд", "бляд", "блят", "блядь", "бля", "педр", "пидор", "пидар", "педик",
  "ебал", "ебат", "ебет", "ебуч", "ебен", "ебан", "ебис", "еби", "ебн", "ебл", "ебу",
  "заеб", "наеб", "отъеб", "подъеб", "разъеб", "уеб", "выеб", "въеб",
  "охуе", "охуи", "ахуе", "долбо", "мудак", "мудил", "мудоз", "гандон", "гондон",
  "дроч", "залуп", "шлюх", "сучк", "мандав", "мокрощел", "шалав", "мраз",
];
const MAT_WORDS = ["сука", "суки", "манда", "манду", "манды", "срак", "срать", "сру", "хер", "гнида", "тварь", "мразь"];

const HOMOGLYPHS = { a: "а", b: "б", c: "с", e: "е", h: "н", k: "к", m: "м", o: "о", p: "р", t: "т", x: "х", y: "у", u: "и" };

function normalizeForProfanity(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[abcehkmopxyu]/g, (ch) => HOMOGLYPHS[ch] || ch)
    .replace(/[^а-яё]+/g, " ")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

function hasProfanity(text) {
  const normalized = normalizeForProfanity(text);
  if (!normalized) return false;
  const words = normalized.split(" ");
  if (MAT_ROOTS.some((root) => normalized.includes(root))) return true;
  return words.some((w) => MAT_WORDS.includes(w));
}
const PROFANITY_ERROR = "В отзыве есть нецензурная лексика. Пожалуйста, перепишите отзыв без мата.";

const MAX_QTY_PER_ITEM = 10;
const MAX_CART_POSITIONS = 10;

const NEUTRAL_CATEGORY = "Без категории";

const RESERVE_MINUTES = Math.max(5, Number(process.env.CART_RESERVE_MINUTES || 60));

const DAY_CAPACITY = Math.max(1, Number(process.env.DELIVERY_CAPACITY_PER_DAY || 10));
const RESET_CODE_TTL_MINUTES = 15;
const RESET_CODE_MAX_ATTEMPTS = 5;

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const bad = (message, code = "VALIDATION", status = 400) => {
  throw new HttpError(status, message, code);
};

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const onUnique = async (promise, message) => {
  try {
    return await promise;
  } catch (err) {
    if (err.code === "23505") bad(message, "CONFLICT", 409);
    throw err;
  }
};

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) =>
  `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;

function checkPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(hash, "hex");
  return candidate.length === original.length && crypto.timingSafeEqual(candidate, original);
}

const DB_DOWN_CODES = new Set([
  "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN",
  "57P01", "57P02", "57P03", "08000", "08001", "08003", "08004", "08006", "28P01", "28000", "3D000",
]);
const dbErrorCode = (err) => (err && (err.code || (Array.isArray(err.errors) && err.errors[0] && err.errors[0].code))) || "";
const isDbDown = (err) =>
  DB_DOWN_CODES.has(dbErrorCode(err)) ||
  /timeout exceeded when trying to connect|Connection terminated|ECONNREFUSED/i.test((err && err.message) || "");

function dbErrorText(err) {
  const code = dbErrorCode(err);
  const where = `${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}`;
  const texts = {
    ECONNREFUSED: `PostgreSQL не запущен или не принимает подключения на ${where}`,
    ENOTFOUND: `не найден сервер БД «${process.env.DB_HOST}» (проверьте DB_HOST в .env)`,
    EAI_AGAIN: `не найден сервер БД «${process.env.DB_HOST}» (проверьте DB_HOST в .env)`,
    ETIMEDOUT: `PostgreSQL не отвечает на ${where} (таймаут)`,
    "28P01": "PostgreSQL отклонил логин/пароль (проверьте DB_USER и DB_PASSWORD в .env)",
    "28000": "PostgreSQL отклонил логин/пароль (проверьте DB_USER и DB_PASSWORD в .env)",
    "3D000": `база данных «${process.env.DB_NAME}» не существует (проверьте DB_NAME в .env)`,
  };
  texts["57P01"] = texts["57P02"] = texts["57P03"] = "сервер PostgreSQL остановлен или перезапускается";
  return texts[code] || err.message || `код ошибки ${code || "неизвестен"}`;
}

const FOREIGN_KEYS = [
  ["cart_items", "cart_items_user_id_fkey", "user_id", "users(id)", "CASCADE"],
  ["cart_items", "cart_items_car_id_fkey", "car_id", "cars(id)", "CASCADE"],
  ["orders", "orders_user_id_fkey", "user_id", "users(id)", "CASCADE"],
  ["order_items", "order_items_order_id_fkey", "order_id", "orders(id)", "CASCADE"],
  ["users", "users_coupon_id_fkey", "coupon_id", "coupons(id)", "SET NULL"],
  ["cars", "cars_category_id_fkey", "category_id", "categories(id)", "SET NULL"],
];

async function migrate() {
  await q("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_source TEXT");
  await q("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS car_id INTEGER");

  await q("ALTER TABLE cars ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 10");
  await q("UPDATE cars SET stock = 10 WHERE stock IS NULL OR stock < 1");

  await q("UPDATE cars SET stock = 10 WHERE stock = 5").catch(() => {});
  await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT ''");
  await q("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE");
  await q("ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'");
  await q("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'");
  await q("ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP");
  await q("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS first_order_only BOOLEAN NOT NULL DEFAULT TRUE");
  await q(`CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await q("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS deleted_by_admin BOOLEAN NOT NULL DEFAULT FALSE");
  await q("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP");
  await q(`CREATE TABLE IF NOT EXISTS password_resets (
    email TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
  )`);

  await q(`DELETE FROM reviews a USING reviews b WHERE a.id > b.id AND a.user_id = b.user_id AND a.car_id = b.car_id`).catch(() => {});
  await q("CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_car_idx ON reviews (user_id, car_id)").catch((err) =>
    console.warn("Не удалось создать уникальный индекс отзывов:", err.message)
  );

  await q("ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS added_at TIMESTAMP NOT NULL DEFAULT NOW()").catch(() => {});
  await q(`UPDATE cart_items c SET quantity = LEAST(${MAX_QTY_PER_ITEM}, s.total)
           FROM (SELECT user_id, car_id, SUM(quantity)::int AS total, MIN(id) AS keep_id
                 FROM cart_items GROUP BY user_id, car_id) s
           WHERE c.id = s.keep_id AND s.total <> c.quantity`).catch(() => {});
  await q(`DELETE FROM cart_items c WHERE c.id <> (SELECT MIN(x.id) FROM cart_items x
           WHERE x.user_id = c.user_id AND x.car_id = c.car_id)`).catch(() => {});
  await q("CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_car_idx ON cart_items (user_id, car_id)").catch((err) =>
    console.warn("Не удалось создать уникальный индекс корзины:", err.message)
  );

  await q("UPDATE cars SET price = 1 WHERE price IS NULL OR price < 1").catch(() => {});

  await q("UPDATE coupons SET first_order_only = TRUE WHERE code IN ('GOLD', 'SILVER', 'VIP')").catch(() => {});
  await q("UPDATE coupons SET name = 'Приветственный (только 1-й заказ)' WHERE code = 'GOLD'").catch(() => {});

  await q(
    `UPDATE users SET coupon_id = NULL
     WHERE coupon_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM coupons c WHERE c.id = users.coupon_id AND c.first_order_only)
       AND EXISTS (SELECT 1 FROM orders o WHERE o.user_id = users.id)`
  ).catch(() => {});

  const badPhones = (await q("SELECT id, phone FROM users")).rows;
  for (const row of badPhones) {
    if (!String(row.phone || "").trim()) continue;
    try {
      const normalized = normalizePhone(row.phone);
      if (normalized && normalized !== row.phone) await q("UPDATE users SET phone = $1 WHERE id = $2", [normalized, row.id]);
    } catch {

    }
  }
  await q(
    "INSERT INTO roles (name) SELECT v.n FROM (VALUES ('admin'), ('user'), ('employee')) AS v(n) WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = v.n)"
  );

  await q("ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_car_id_fkey").catch(() => {});
  await q("ALTER TABLE order_items ADD CONSTRAINT order_items_car_id_fkey FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE SET NULL").catch((err) =>
    console.warn("Не удалось добавить связь order_items.car_id:", err.message)
  );
  await tx(async (c) => {
    for (const [table, name, column, ref, action] of FOREIGN_KEYS) {
      await c.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${name}`);
      await c.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} FOREIGN KEY (${column}) REFERENCES ${ref} ON DELETE ${action}`);
    }
  });
  await q("CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_idx ON categories (LOWER(name))").catch((err) =>
    console.warn("Не удалось создать уникальный индекс категорий:", err.message)
  );

  await q("INSERT INTO categories (name) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE LOWER(name) = LOWER($1))", [NEUTRAL_CATEGORY]);
  await q(
    `UPDATE cars SET category_id = (SELECT id FROM categories WHERE LOWER(name) = LOWER($1)) WHERE category_id IS NULL`,
    [NEUTRAL_CATEGORY]
  );
}

async function seed() {
  const insertUser = (email, password, name, address, role, couponId = null, phone = "+7 (900) 000-00-00") =>
    q(
      "INSERT INTO users (email, password_hash, full_name, address, role_id, coupon_id, phone) VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = $5), $6, $7)",
      [email, hashPassword(password), name, address, role, couponId, phone]
    );
  if (Number((await q("SELECT COUNT(*) FROM users")).rows[0].count) === 0) {
    const gold = (await q("SELECT id FROM coupons WHERE code = 'GOLD'")).rows[0];
    await insertUser("admin@lada.shop", "admin123", "Администратор Системы", "", "admin");
    await insertUser("user@lada.shop", "user123", "Иван Петров", "г. Тольятти, ул. Южное шоссе, 36", "user", gold ? gold.id : null);
  }
  if (!(await q("SELECT id FROM users WHERE email = 'employee@lada.shop'")).rows[0]) {
    await insertUser("employee@lada.shop", "staff123", "Пётр Смирнов", "", "employee");
  }
}

async function initDb() {
  try {
    await migrate();
    await seed();
    console.log("Подключение к PostgreSQL установлено, БД готова");
  } catch (err) {
    console.error(`БД недоступна (${dbErrorText(err)}). Повтор через 5 секунд...`);
    setTimeout(initDb, 5000);
  }
}

const sessions = new Map();
const createSession = (userId) => {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, userId);
  return token;
};
const tokenFrom = (req) => ((req.header("authorization") || "").startsWith("Bearer ") ? req.header("authorization").slice(7) : "");

const USER_SELECT = `
  SELECT users.*, roles.name AS role,
         coupons.code AS coupon_code, coupons.name AS coupon_name, coupons.discount_percent AS coupon_percent,
         coupons.first_order_only AS coupon_first_order_only,
         (SELECT COUNT(*)::int FROM orders WHERE orders.user_id = users.id) AS orders_count
  FROM users JOIN roles ON roles.id = users.role_id LEFT JOIN coupons ON coupons.id = users.coupon_id`;
const userById = async (id) => (await q(`${USER_SELECT} WHERE users.id = $1`, [id])).rows[0];

const publicUser = (u, token) => ({
  token,
  id: u.id,
  email: u.email,
  fullName: u.full_name,
  phone: u.phone || "",
  address: u.address || "",
  role: u.role,
  ordersCount: u.orders_count || 0,
  coupon: u.coupon_id
    ? {
        code: u.coupon_code,
        name: u.coupon_name,
        percent: u.coupon_percent,
        firstOrderOnly: Boolean(u.coupon_first_order_only),
        active: !(u.coupon_first_order_only && Number(u.orders_count) > 0),
      }
    : null,
});

const app = express();
app.disable("etag");
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const requireAuth = ah(async (req, res, next) => {
  const userId = sessions.get(tokenFrom(req));
  const user = userId ? await userById(userId) : null;
  if (!user) bad("Сессия истекла, войдите заново", "SESSION_EXPIRED", 401);
  req.currentUser = user;
  next();
});

const optionalAuth = ah(async (req, res, next) => {
  const userId = sessions.get(tokenFrom(req));
  req.currentUser = userId ? (await userById(userId)) || null : null;
  next();
});
const guard = (message, ...roles) => [
  requireAuth,
  (req, res, next) => (roles.includes(req.currentUser.role) ? next() : next(new HttpError(403, message, "FORBIDDEN"))),
];
const requireStaff = guard("Доступно только сотрудникам и администраторам", "admin", "employee");
const requireAdmin = guard("Доступно только администратору", "admin");
const requireUser = guard("Сотрудникам и администраторам корзина и заказы недоступны", "user");

const parseId = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const idParam = (req, what = "объекта") => parseId(req.params.id) || bad(`Некорректный номер ${what}`);
const validEmail = (e) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const normName = (v) => String(v || "").trim().replace(/\s+/g, " ");
const lower = (v) => String(v || "").toLocaleLowerCase("ru");
const matches = (search, ...fields) => {
  const s = lower(search).trim();
  return !s || fields.some((f) => lower(f).includes(s));
};
const ORDER_STATUSES = ["new", "processing", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["pending", "paid"];
const PAYMENT_STATUS_NAMES = { pending: "Ожидает оплаты", paid: "Оплачен" };
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function parseDeliveryDate(value) {
  const v = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) bad("Укажите корректную дату доставки");
  if (v < todayStr()) bad("Дата доставки не может быть раньше сегодняшнего дня");
  return v;
}
const maxLen = (value, n, what) => value.length > n && bad(`${what} слишком длинное(ый) (максимум ${n} символов)`);

function applyDiscount(price, productPercent, user) {
  const couponUsable =
    user &&
    user.role === "user" &&
    user.coupon_percent &&
    !(user.coupon_first_order_only && Number(user.orders_count || 0) > 0);
  const couponPercent = couponUsable ? user.coupon_percent : 0;
  let discount = 0;
  let source = null;
  if (couponPercent > 0 && couponPercent >= productPercent) [discount, source] = [couponPercent, "coupon"];
  else if (productPercent > 0) [discount, source] = [productPercent, "product"];
  return {
    discount,
    source,
    couponCode: source === "coupon" ? user.coupon_code : null,
    unitFinal: Math.round((price * (100 - discount)) / 100),
  };
}

function carDto(r, user) {
  const d = applyDiscount(r.price, r.discount_percent, user);
  const stock = Number(r.stock || 0);

  const reserved = Number(r.reserved_others || 0);
  const available = Math.max(0, stock - reserved);
  return {
    id: r.id, code: r.code, name: r.name, description: r.description || "", price: r.price, imageUrl: r.image_url,
    categoryId: r.category_id, categoryName: r.category_name || null, ownedYears: r.owned_years, mileageKm: r.mileage_km,
    ratingAvg: r.rating_avg || 0, reviewsCount: r.reviews_count || 0,
    productDiscount: r.discount_percent, discount: d.discount, discountSource: d.source, couponCode: d.couponCode, finalPrice: d.unitFinal,

    stock, reserved, available,
    inStock: available > 0, outOfStock: available === 0, soldOut: stock === 0,
    purchasable: d.unitFinal > 0 && available > 0, maxQty: Math.min(MAX_QTY_PER_ITEM, available),
  };
}

function lineDto(r, user) {
  const d = applyDiscount(r.price, r.discount_percent, user);
  const priceBefore = r.price * r.quantity;
  const priceAfter = d.unitFinal * r.quantity;
  const stock = Number(r.stock || 0);
  const reservedUntil = r.added_at ? new Date(new Date(r.added_at).getTime() + RESERVE_MINUTES * 60000).toISOString() : null;
  return {
    id: r.id, carId: r.car_id, code: r.code, name: r.name, imageUrl: r.image_url, ownedYears: r.owned_years, mileageKm: r.mileage_km,
    quantity: r.quantity, unitPrice: r.price, unitFinal: d.unitFinal, discount: d.discount, discountSource: d.source,
    couponCode: d.couponCode, priceBefore, priceAfter, saved: priceBefore - priceAfter,

    stock, reservedUntil, reserveMinutes: RESERVE_MINUTES,
    outOfStock: stock === 0, stockShortage: r.quantity > stock, maxQty: Math.min(MAX_QTY_PER_ITEM, stock),
  };
}

function totalsOf(items) {
  const totalBefore = items.reduce((s, i) => s + i.priceBefore, 0);
  const totalAfter = items.reduce((s, i) => s + i.priceAfter, 0);
  return { totalBefore, totalAfter, totalSaved: totalBefore - totalAfter, itemsCount: items.reduce((s, i) => s + i.quantity, 0) };
}

function orderItemDto(r) {
  const [source, couponCode] = String(r.discount_source || "").split(":");
  return {
    carName: r.car_name, details: r.car_details, discount: r.discount_percent, discountSource: source || null,
    couponCode: couponCode || null, quantity: r.quantity, unitPrice: r.price_before / r.quantity,
    priceBefore: r.price_before, priceAfter: r.price_after,
  };
}

app.get("/api/test", (req, res) =>
  res.json({
    message: "API работает!",
    timestamp: new Date(),
    startedAt: STARTED_AT,
    mail: MAIL_CONFIGURED ? `настроена (${SMTP_HOST}:${SMTP_PORT}, ${SMTP_USER})` : "не настроена",
  })
);
app.get("/api/test-db", ah(async (req, res) => {
  const r = await q("SELECT NOW() AS current_time");
  res.json({ message: "Подключение к БД работает!", current_time: r.rows[0].current_time });
}));

app.post("/api/register", ah(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const fullName = personName(req.body.fullName);
  if (!email || !password) bad("Укажите email и пароль");
  if (!validEmail(email)) bad("Введите корректный email");
  if (password.length < 6) bad("Пароль должен быть не короче 6 символов");
  if (!String(req.body.phone || "").trim()) bad("Укажите телефон");
  const phone = normalizePhone(req.body.phone);
  if ((await q("SELECT id FROM users WHERE LOWER(email) = $1", [email])).rows[0]) bad("Такой email уже зарегистрирован", "CONFLICT", 409);
  const created = await onUnique(
    q("INSERT INTO users (email, password_hash, full_name, phone, role_id) VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = 'user')) RETURNING id",
      [email, hashPassword(password), fullName, phone]),
    "Такой email уже зарегистрирован"
  );
  const user = await userById(created.rows[0].id);
  res.json(publicUser(user, createSession(user.id)));
}));

app.post("/api/password/forgot", ah(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!validEmail(email)) bad("Введите корректный email");
  const target = (await q("SELECT id, email FROM users WHERE LOWER(email) = $1", [email])).rows[0];
  if (!target) bad("Пользователь с таким email не зарегистрирован. Проверьте адрес или зарегистрируйтесь.", "EMAIL_NOT_FOUND", 404);

  const code = String(crypto.randomInt(100000, 1000000));
  await q(
    `INSERT INTO password_resets (email, user_id, code_hash, attempts, created_at, expires_at)
     VALUES ($1, $2, $3, 0, NOW(), NOW() + INTERVAL '${RESET_CODE_TTL_MINUTES} minutes')
     ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, code_hash = EXCLUDED.code_hash,
       attempts = 0, created_at = NOW(), expires_at = EXCLUDED.expires_at`,
    [email, target.id, hashPassword(code)]
  );

  if (!MAIL_CONFIGURED) {
    if (SHOW_CODE_IN_BROWSER) {
      console.log(`\n=== ПОЧТА НЕ НАСТРОЕНА (MAIL_SHOW_CODE_IN_BROWSER=true) ===\nКому: ${email}\nКод: ${code}\n=============================================\n`);
      return res.json({
        ok: true,
        emailSent: false,
        devCode: code,
        minutes: RESET_CODE_TTL_MINUTES,
        message: "Почта не настроена, письмо не отправлено. Код показан ниже (режим показа без интернета).",
      });
    }
    bad(
      "Почта на сайте ещё не настроена, поэтому код отправить некуда. Администратору: заполните SMTP в файле my-api/backend/.env (пошаговая инструкция — админ-панель → «Почта (SMTP)»)",
      "SMTP_NOT_CONFIGURED",
      503
    );
  }

  const mail = await sendResetCodeMail(email, code);
  if (!mail.sent) {
    bad(`Письмо с кодом отправить не удалось. ${mail.hint || mail.error || "Проверьте настройки SMTP"}`, "SMTP_ERROR", 502);
  }
  res.json({
    ok: true,
    emailSent: true,
    devCode: null,
    minutes: RESET_CODE_TTL_MINUTES,
    message: `Код подтверждения отправлен на ${email}. Проверьте входящие и папку «Спам». Код действует ${RESET_CODE_TTL_MINUTES} минут.`,
  });
}));

app.get("/api/mail/status", requireAdmin, (req, res) => res.json(mailStatus()));

app.post("/api/mail/test", requireAdmin, ah(async (req, res) => {
  if (!MAIL_CONFIGURED) {
    bad(
      "SMTP не настроен. Откройте my-api/backend/.env и укажите SMTP_HOST, SMTP_USER и SMTP_PASS (для Gmail — smtp.gmail.com, порт 465 и пароль приложения), затем сохраните файл — сервер перезапустится сам (nodemon)",
      "SMTP_NOT_CONFIGURED",
      400
    );
  }
  const to = String(req.body.to || req.currentUser.email || "").trim();
  if (!validEmail(to)) bad("Укажите корректный email для тестового письма");
  const mail = getTransporter();
  const probe = String(crypto.randomInt(100000, 1000000));
  try {
    await mail.verify();
    await mail.sendMail({
      from: MAIL_FROM,
      to,
      subject: "Lada Shop — проверка почты",
      text: `Почта настроена правильно.\n\nТестовый код: ${probe}\n\nЭто письмо отправлено со страницы «Почта (SMTP)» в админ-панели.`,
    });
  } catch (err) {
    const hint = mailErrorHint(err);
    bad(`Письмо отправить не удалось. ${hint || err.message}`, "SMTP_ERROR", 502);
  }
  res.json({ ok: true, to, message: `Тестовое письмо отправлено на ${to}. Проверьте входящие и папку «Спам».` });
}));

app.post("/api/password/reset", ah(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const code = String(req.body.code || "").trim();
  const password = String(req.body.password || "");
  if (!validEmail(email)) bad("Введите корректный email");
  if (!/^\d{6}$/.test(code)) bad("Код подтверждения — 6 цифр");
  if (password.length < 6) bad("Новый пароль должен быть не короче 6 символов");
  const row = (await q("SELECT * FROM password_resets WHERE email = $1", [email])).rows[0];
  if (!row) bad("Код не найден. Запросите новый код на почту", "CODE_NOT_FOUND", 400);
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await q("DELETE FROM password_resets WHERE email = $1", [email]);
    bad("Срок действия кода истёк. Запросите новый код", "CODE_EXPIRED", 400);
  }
  if (row.attempts >= RESET_CODE_MAX_ATTEMPTS) bad("Слишком много неверных попыток. Запросите новый код", "TOO_MANY_ATTEMPTS", 429);
  if (!checkPassword(code, row.code_hash)) {
    await q("UPDATE password_resets SET attempts = attempts + 1 WHERE email = $1", [email]);
    bad("Неверный код подтверждения", "WRONG_CODE", 400);
  }
  await q("UPDATE users SET password_hash = $1 WHERE id = $2", [hashPassword(password), row.user_id]);

  await q("DELETE FROM password_resets WHERE email = $1", [email]);

  for (const [sessionToken, userId] of sessions) if (userId === row.user_id) sessions.delete(sessionToken);
  res.json({ ok: true, message: "Пароль изменён. Войдите с новым паролем." });
}));

app.post("/api/login", ah(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !password) bad("Укажите email и пароль");
  const user = (await q(`${USER_SELECT} WHERE LOWER(users.email) = $1`, [email])).rows[0];
  if (!user || !checkPassword(password, user.password_hash)) bad("Неверный email или пароль", "INVALID_CREDENTIALS", 401);
  res.json(publicUser(user, createSession(user.id)));
}));

app.post("/api/logout", requireAuth, (req, res) => {
  sessions.delete(tokenFrom(req));
  res.json({ ok: true });
});

app.get("/api/profile", requireAuth, (req, res) => res.json(publicUser(req.currentUser)));

app.put("/api/profile", requireAuth, ah(async (req, res) => {
  const user = req.currentUser;
  const { fullName, email, phone, address, password, currentPassword } = req.body;
  const sets = [];
  const params = [];
  const add = (column, value) => sets.push(`${column} = $${params.push(value)}`);

  if (fullName !== undefined) {
    add("full_name", personName(fullName));
  }
  if (phone !== undefined) {
    add("phone", normalizePhone(phone));
  }
  if (address !== undefined) {
    const value = String(address).trim();
    maxLen(value, 300, "Адрес");
    add("address", value);
  }

  const newEmail = email !== undefined ? String(email).trim().toLowerCase() : null;
  const emailChanged = newEmail !== null && newEmail !== String(user.email).toLowerCase();
  const passwordChanged = password !== undefined && password !== "";
  if (passwordChanged) {
    if (!currentPassword) bad("Введите текущий пароль для подтверждения");
    if (!checkPassword(currentPassword, user.password_hash)) bad("Текущий пароль указан неверно", "WRONG_PASSWORD");
  }
  if (emailChanged) {
    if (!validEmail(newEmail)) bad("Введите корректный email");
    if ((await q("SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2", [newEmail, user.id])).rows[0]) bad("Такой email уже занят", "CONFLICT", 409);
    add("email", newEmail);
  }
  if (passwordChanged) {
    if (String(password).length < 6) bad("Новый пароль должен быть не короче 6 символов");
    add("password_hash", hashPassword(String(password)));
  }
  if (!sets.length) bad("Нет данных для сохранения");

  params.push(user.id);
  await onUnique(q(`UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length}`, params), "Такой email уже занят");
  res.json(publicUser(await userById(user.id)));
}));

const categoryNameTaken = async (name, exceptId) =>
  (await q("SELECT id, name FROM categories")).rows.some((c) => c.id !== exceptId && lower(c.name) === lower(name));

function categoryName(raw) {
  const name = normName(raw);
  if (!name) bad("Название категории не может быть пустым");
  maxLen(name, 50, "Название категории");
  return name;
}

const isNeutralCategory = (name) => lower(name) === lower(NEUTRAL_CATEGORY);
const neutralCategoryId = async (client = null) => {
  const run = client ? (sql, params) => client.query(sql, params) : q;
  const found = await run("SELECT id FROM categories WHERE LOWER(name) = LOWER($1)", [NEUTRAL_CATEGORY]);
  if (found.rows[0]) return found.rows[0].id;
  const created = await run("INSERT INTO categories (name) VALUES ($1) RETURNING id", [NEUTRAL_CATEGORY]);
  return created.rows[0].id;
};

app.get("/api/categories", ah(async (req, res) => {
  const r = await q(
    `SELECT categories.id, categories.name, COUNT(cars.id)::int AS cars_count
     FROM categories LEFT JOIN cars ON cars.category_id = categories.id GROUP BY categories.id ORDER BY categories.name`
  );
  res.json(r.rows.map((c) => ({ id: c.id, name: c.name, carsCount: c.cars_count, isNeutral: isNeutralCategory(c.name) })));
}));

app.post("/api/categories", requireStaff, ah(async (req, res) => {
  const name = categoryName(req.body.name);
  if (isNeutralCategory(name)) bad(`Категория «${NEUTRAL_CATEGORY}» уже есть — это системная категория`, "CONFLICT", 409);
  if (await categoryNameTaken(name, null)) bad("Такая категория уже существует", "CONFLICT", 409);
  const r = await onUnique(q("INSERT INTO categories (name) VALUES ($1) RETURNING id, name", [name]), "Такая категория уже существует");
  res.json({ ...r.rows[0], carsCount: 0, isNeutral: false });
}));

app.put("/api/categories/:id", requireStaff, ah(async (req, res) => {
  const id = idParam(req, "категории");
  const current = (await q("SELECT id, name FROM categories WHERE id = $1", [id])).rows[0];
  if (!current) bad("Категория не найдена", "NOT_FOUND", 404);
  if (isNeutralCategory(current.name)) bad(`Системную категорию «${NEUTRAL_CATEGORY}» нельзя переименовать — в неё попадают товары удалённых категорий`, "FORBIDDEN", 403);
  const name = categoryName(req.body.name);
  if (isNeutralCategory(name)) bad(`Такое название занято системной категорией`, "CONFLICT", 409);
  if (await categoryNameTaken(name, id)) bad("Такая категория уже существует", "CONFLICT", 409);
  const r = await onUnique(q("UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name", [name, id]), "Такая категория уже существует");
  res.json(r.rows[0]);
}));

app.delete("/api/categories/:id", requireStaff, ah(async (req, res) => {
  const id = idParam(req, "категории");
  const requested = req.query.moveTo ? parseId(req.query.moveTo) : null;
  const result = await tx(async (c) => {
    const category = (await c.query("SELECT id, name FROM categories WHERE id = $1", [id])).rows[0];
    if (!category) bad("Категория не найдена", "NOT_FOUND", 404);
    if (isNeutralCategory(category.name)) bad(`Системную категорию «${NEUTRAL_CATEGORY}» удалить нельзя`, "FORBIDDEN", 403);

    const count = Number((await c.query("SELECT COUNT(*) FROM cars WHERE category_id = $1", [id])).rows[0].count);
    const targetId = requested && requested !== id ? requested : await neutralCategoryId(c);
    if (targetId !== id) {
      const target = (await c.query("SELECT id, name FROM categories WHERE id = $1", [targetId])).rows[0];
      if (!target) bad("Категория для переноса не найдена", "NOT_FOUND", 404);
      if (count > 0) await c.query("UPDATE cars SET category_id = $1 WHERE category_id = $2", [targetId, id]);
      await c.query("DELETE FROM categories WHERE id = $1", [id]);
      return { moved: count, targetName: target.name };
    }
    await c.query("DELETE FROM categories WHERE id = $1", [id]);
    return { moved: 0, targetName: NEUTRAL_CATEGORY };
  });
  res.json({ ok: true, ...result });
}));

function validateCoupon(body) {
  const code = String(body.code || "").trim().toUpperCase();
  const name = normName(body.name);
  const percent = Number(body.discountPercent);
  const empty = body.discountPercent === "" || body.discountPercent === undefined || body.discountPercent === null;
  if (!code || !name || empty) bad("Заполните все поля купона");
  if (!/^[A-Z0-9_-]{2,20}$/.test(code)) bad("Код купона: 2–20 символов, только латинские буквы, цифры, «-» и «_»");
  maxLen(name, 60, "Название купона");
  if (!Number.isInteger(percent) || percent < 1 || percent > 99) bad("Скидка должна быть целым числом от 1 до 99%");

  const firstOrderOnly = body.firstOrderOnly === undefined ? true : Boolean(body.firstOrderOnly);
  return { code, name, percent, firstOrderOnly };
}

app.get("/api/coupons", requireAdmin, ah(async (req, res) => {
  const r = await q(
    `SELECT coupons.id, coupons.code, coupons.name, coupons.discount_percent, coupons.first_order_only,
            (SELECT STRING_AGG(email, ', ' ORDER BY email) FROM users WHERE users.coupon_id = coupons.id) AS assigned_emails,
            (SELECT COUNT(*)::int FROM users WHERE users.coupon_id = coupons.id) AS users_count
     FROM coupons ORDER BY coupons.discount_percent, coupons.code`
  );
  res.json(
    r.rows
      .map((c) => ({
        id: c.id, code: c.code, name: c.name, discountPercent: c.discount_percent,
        firstOrderOnly: Boolean(c.first_order_only), assignedEmails: c.assigned_emails || "", usersCount: c.users_count,
      }))
      .filter((c) => matches(req.query.search, c.code, c.name, c.assignedEmails))
  );
}));

app.post("/api/coupons", requireAdmin, ah(async (req, res) => {
  const v = validateCoupon(req.body);
  const r = await onUnique(
    q("INSERT INTO coupons (code, name, discount_percent, first_order_only) VALUES ($1, $2, $3, $4) RETURNING id", [v.code, v.name, v.percent, v.firstOrderOnly]),
    "Купон с таким кодом уже существует"
  );
  res.json({ id: r.rows[0].id });
}));

app.put("/api/coupons/:id", requireAdmin, ah(async (req, res) => {
  const id = idParam(req, "купона");
  const v = validateCoupon(req.body);
  const r = await onUnique(
    q("UPDATE coupons SET code = $1, name = $2, discount_percent = $3, first_order_only = $4 WHERE id = $5 RETURNING id", [v.code, v.name, v.percent, v.firstOrderOnly, id]),
    "Купон с таким кодом уже существует"
  );
  if (!r.rows[0]) bad("Купон не найден", "NOT_FOUND", 404);
  res.json({ ok: true });
}));

app.delete("/api/coupons/:id", requireAdmin, ah(async (req, res) => {
  const id = idParam(req, "купона");
  await tx(async (c) => {
    await c.query("UPDATE users SET coupon_id = NULL WHERE coupon_id = $1", [id]);
    if (!(await c.query("DELETE FROM coupons WHERE id = $1 RETURNING id", [id])).rows[0]) bad("Купон не найден", "NOT_FOUND", 404);
  });
  res.json({ ok: true });
}));

app.get("/api/users", requireAdmin, ah(async (req, res) => {
  const r = await q(`SELECT u.* FROM (${USER_SELECT}) AS u ORDER BY u.id`);
  res.json(
    r.rows
      .map((u) => ({
        id: u.id, email: u.email, fullName: u.full_name, phone: u.phone || "", address: u.address || "", role: u.role,
        ordersCount: u.orders_count || 0,
        couponId: u.coupon_id, couponName: u.coupon_name, couponCode: u.coupon_code, couponPercent: u.coupon_percent,
        couponFirstOrderOnly: Boolean(u.coupon_first_order_only),

        editable: false,
      }))
      .filter((u) => matches(req.query.search, u.email, u.fullName, u.couponCode, u.couponName))
  );
}));

app.post("/api/users", requireAdmin, ah(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const fullName = personName(req.body.fullName);
  const phone = normalizePhone(req.body.phone);
  const role = req.body.role || "user";
  if (role === "admin") bad("Администраторов нельзя добавлять через сайт — только напрямую в базе данных", "FORBIDDEN", 403);
  if (role !== "user" && role !== "employee") bad("Допустимые роли: пользователь или сотрудник");
  if (!validEmail(email)) bad("Введите корректный email");
  if (password.length < 6) bad("Пароль должен быть не короче 6 символов");
  if ((await q("SELECT id FROM users WHERE LOWER(email) = $1", [email])).rows[0]) bad("Такой email уже зарегистрирован", "CONFLICT", 409);
  await onUnique(
    q("INSERT INTO users (email, password_hash, full_name, phone, role_id) VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = $5))",
      [email, hashPassword(password), fullName, phone, role]),
    "Такой email уже зарегистрирован"
  );
  res.json({ ok: true });
}));

app.put("/api/users/:id", requireAdmin, ah(async (req, res) => {
  const userId = idParam(req, "пользователя");
  if (!(await userById(userId))) bad("Пользователь не найден", "NOT_FOUND", 404);
  bad("Администратор не может изменять данные пользователей — это делает сам пользователь в своём профиле", "FORBIDDEN", 403);
}));

app.put("/api/users/:id/coupon", requireAdmin, ah(async (req, res) => {
  const userId = idParam(req, "пользователя");
  const raw = req.body.couponId;
  const couponId = raw === null || raw === "" ? null : parseId(raw) || bad("Некорректный номер купона");
  const target = (await userById(userId)) || bad("Пользователь не найден", "NOT_FOUND", 404);
  if (target.role !== "user") bad("Купон можно выдать только пользователю");
  if (couponId && !(await q("SELECT id FROM coupons WHERE id = $1", [couponId])).rows[0]) bad("Купон не найден", "NOT_FOUND", 404);
  await q("UPDATE users SET coupon_id = $1 WHERE id = $2", [couponId, userId]);
  res.json({ ok: true });
}));

app.put("/api/users/:id/role", requireAdmin, ah(async (req, res) => {
  const userId = idParam(req, "пользователя");
  const role = req.body.role;
  if (role === "admin") bad("Администраторов нельзя назначать через сайт — только напрямую в базе данных", "FORBIDDEN", 403);
  if (role !== "user" && role !== "employee") bad("Допустимые роли: пользователь или сотрудник");
  const target = (await userById(userId)) || bad("Пользователь не найден", "NOT_FOUND", 404);
  if (target.role === "admin") bad("Роль администратора нельзя изменить через сайт", "FORBIDDEN", 403);
  await q("UPDATE users SET role_id = (SELECT id FROM roles WHERE name = $1), coupon_id = NULL WHERE id = $2", [role, userId]);
  res.json({ ok: true });
}));

app.delete("/api/users/:id", requireAdmin, ah(async (req, res) => {
  const userId = idParam(req, "пользователя");
  if (!(await userById(userId))) bad("Пользователь не найден", "NOT_FOUND", 404);
  bad("Администратор не может удалять пользователей", "FORBIDDEN", 403);
}));

app.get("/api/cars", optionalAuth, ah(async (req, res) => {
  const { search, sort, onlyDiscount } = req.query;
  const meId = req.currentUser ? req.currentUser.id : null;
  const params = [meId];
  let sql = `SELECT cars.id, cars.code, cars.name, cars.description, cars.price::float8 AS price, cars.image_url,
                    cars.category_id, categories.name AS category_name, cars.discount_percent, cars.owned_years, cars.mileage_km,
                    cars.stock, COALESCE(rsv.reserved, 0)::int AS reserved_others,
                    COALESCE(ROUND(AVG(reviews.rating), 1), 0)::float8 AS rating_avg, COUNT(reviews.id)::int AS reviews_count
             FROM cars
                  LEFT JOIN categories ON categories.id = cars.category_id
                  LEFT JOIN reviews ON reviews.car_id = cars.id AND reviews.deleted_by_admin = FALSE
                  LEFT JOIN (
                    SELECT car_id, SUM(quantity)::int AS reserved
                    FROM cart_items
                    WHERE added_at > NOW() - INTERVAL '${RESERVE_MINUTES} minutes'
                      AND ($1::int IS NULL OR user_id <> $1::int)
                    GROUP BY car_id
                  ) rsv ON rsv.car_id = cars.id
             WHERE 1=1`;
  if (req.query.categoryIds) {
    const ids = String(req.query.categoryIds).split(",").map(Number).filter(Number.isInteger);
    sql += ` AND cars.category_id = ANY($${params.push(ids)}::int[])`;
  }
  const rows = (await q(`${sql} GROUP BY cars.id, categories.name, rsv.reserved ORDER BY cars.id`, params)).rows;
  let list = rows.filter((r) => matches(search, r.name, r.code)).map((r) => carDto(r, req.currentUser));
  const minPrice = req.query.minPrice === undefined || req.query.minPrice === "" ? null : Number(req.query.minPrice);
  const maxPrice = req.query.maxPrice === undefined || req.query.maxPrice === "" ? null : Number(req.query.maxPrice);
  if ((minPrice !== null && Number.isNaN(minPrice)) || (maxPrice !== null && Number.isNaN(maxPrice))) bad("Цена в фильтре должна быть числом");
  if (minPrice !== null) list = list.filter((c) => c.finalPrice >= minPrice);
  if (maxPrice !== null) list = list.filter((c) => c.finalPrice <= maxPrice);
  if (onlyDiscount === "1") list = list.filter((c) => c.discount > 0);
  if (sort === "price_asc") list.sort((a, b) => a.finalPrice - b.finalPrice);
  if (sort === "price_desc") list.sort((a, b) => b.finalPrice - a.finalPrice);
  if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  res.json(list);
}));

function carFields(body, partial) {
  const fields = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has("code")) {
    const code = String(body.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) bad("Код: 2–30 символов, латинские буквы, цифры, «-» и «_»");
    fields.code = code;
  }
  if (!partial || has("name")) {
    const name = normName(body.name);
    if (!name) bad("Укажите название");
    maxLen(name, 100, "Название");
    fields.name = name;
  }
  if (has("description")) {
    const description = String(body.description || "").trim();
    maxLen(description, 1000, "Описание");
    fields.description = description;
  }
  if (!partial || has("price")) {
    const price = Number(body.price);
    if (body.price === "" || body.price === null || !Number.isFinite(price)) bad("Цена должна быть числом");
    if (price < 1) bad("Цена не может быть нулевой: товар нельзя продавать за 0 ₽");
    if (price > 1e9) bad("Цена не может быть больше 1 000 000 000 ₽");
    fields.price = Math.round(price);
  }
  if (has("imageUrl")) {
    const url = String(body.imageUrl || "").trim();
    if (url && !/^https?:\/\/\S+$/.test(url)) bad("Ссылка на фото должна начинаться с http:// или https://");
    maxLen(url, 1000, "Ссылка на фото");
    fields.image_url = url || null;
  }
  if (!partial || has("categoryId")) fields.category_id = parseId(body.categoryId) || bad("Выберите категорию");
  if (has("discountPercent")) {
    const percent = Number(body.discountPercent);
    if (body.discountPercent === "" || !Number.isInteger(percent) || percent < 0 || percent > 99) bad("Скидка должна быть целым числом от 0 до 99%");
    fields.discount_percent = percent;
  }
  if (has("ownedYears")) {
    const years = Number(body.ownedYears);
    if (body.ownedYears === "" || !Number.isInteger(years) || years < 0 || years > 100) bad("Срок владения: целое число лет от 0 до 100");
    fields.owned_years = years;
  }
  if (has("mileageKm")) {
    const km = Number(body.mileageKm);
    if (body.mileageKm === "" || !Number.isInteger(km) || km < 0 || km > 10000000) bad("Пробег: целое число км от 0 до 10 000 000");
    fields.mileage_km = km;
  }
  if (!partial || has("stock")) {
    const stock = Number(body.stock);
    if (body.stock === "" || body.stock === undefined || !Number.isInteger(stock) || stock < 0 || stock > 1000) {
      bad("Количество в наличии: целое число от 0 до 1000 (0 — товара нет)");
    }
    fields.stock = stock;
  }
  if (fields.price !== undefined && fields.discount_percent !== undefined) {
    const final = Math.round((fields.price * (100 - fields.discount_percent)) / 100);
    if (final < 1) bad("С такой скидкой цена становится нулевой — уменьшите скидку");
  }
  return fields;
}

async function checkCategoryExists(id) {
  if (id && !(await q("SELECT id FROM categories WHERE id = $1", [id])).rows[0]) bad("Категория не найдена", "NOT_FOUND", 404);
}

app.post("/api/cars", requireStaff, ah(async (req, res) => {
  const f = carFields(req.body, false);
  await checkCategoryExists(f.category_id);
  const columns = Object.keys(f);
  const r = await onUnique(
    q(`INSERT INTO cars (${columns.join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`, columns.map((c) => f[c])),
    "Товар с таким кодом уже существует"
  );
  res.json({ id: r.rows[0].id });
}));

app.put("/api/cars/:id", requireStaff, ah(async (req, res) => {
  const id = idParam(req, "товара");
  const f = carFields(req.body, true);
  const columns = Object.keys(f);
  if (!columns.length) bad("Нет данных для сохранения");
  await checkCategoryExists(f.category_id);
  const r = await onUnique(
    q(`UPDATE cars SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE id = $${columns.length + 1} RETURNING id`, [...columns.map((c) => f[c]), id]),
    "Товар с таким кодом уже существует"
  );
  if (!r.rows[0]) bad("Товар не найден", "NOT_FOUND", 404);
  res.json({ ok: true });
}));

app.delete("/api/cars/:id", requireStaff, ah(async (req, res) => {
  const r = await q("DELETE FROM cars WHERE id = $1 RETURNING id", [idParam(req, "товара")]);
  if (!r.rows[0]) bad("Товар не найден", "NOT_FOUND", 404);
  res.json({ ok: true });
}));

const CART_SELECT = `
  SELECT cart_items.id, cart_items.quantity, cart_items.added_at, cars.id AS car_id, cars.code, cars.name, cars.price::float8 AS price,
         cars.image_url, cars.discount_percent, cars.owned_years, cars.mileage_km, cars.stock
  FROM cart_items JOIN cars ON cars.id = cart_items.car_id
  WHERE cart_items.user_id = $1 ORDER BY cart_items.id`;

async function reservedQuantity(carId, exceptUserId = null, client = null) {
  const run = client ? (sql, params) => client.query(sql, params) : q;
  const r = await run(
    `SELECT COALESCE(SUM(quantity), 0)::int AS reserved
     FROM cart_items
     WHERE car_id = $1
       AND added_at > NOW() - INTERVAL '${RESERVE_MINUTES} minutes'
       AND ($2::int IS NULL OR user_id <> $2::int)`,
    [carId, exceptUserId || null]
  );
  return Number(r.rows[0].reserved || 0);
}

const freeForUser = (stock, reservedByOthers) => Math.max(0, Number(stock || 0) - Number(reservedByOthers || 0));

async function bookedForDate(date, client = null) {
  const run = client ? (sql, params) => client.query(sql, params) : q;
  const r = await run(
    `SELECT COALESCE(SUM(order_items.quantity), 0)::int AS booked
     FROM orders JOIN order_items ON order_items.order_id = orders.id
     WHERE orders.delivery_date = $1::date AND orders.status <> 'cancelled'`,
    [date]
  );
  return Number(r.rows[0].booked || 0);
}

async function cartQuantity(userId) {
  const r = await q("SELECT COALESCE(SUM(quantity), 0)::int AS total FROM cart_items WHERE user_id = $1", [userId]);
  return Number(r.rows[0].total || 0);
}

app.get("/api/delivery/capacity", ah(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 21, 1), 60);
  const booked = new Map(
    (
      await q(
        `SELECT orders.delivery_date::text AS date, COALESCE(SUM(order_items.quantity), 0)::int AS booked
         FROM orders JOIN order_items ON order_items.order_id = orders.id
         WHERE orders.delivery_date >= CURRENT_DATE AND orders.status <> 'cancelled'
         GROUP BY orders.delivery_date`
      )
    ).rows.map((r) => [r.date, Number(r.booked)])
  );
  const list = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const bookedCount = booked.get(date) || 0;
    const available = Math.max(0, DAY_CAPACITY - bookedCount);
    list.push({ date, booked: bookedCount, capacity: DAY_CAPACITY, available, full: available === 0 });
  }
  res.json({ capacity: DAY_CAPACITY, days: list });
}));

app.get("/api/cart", requireUser, ah(async (req, res) => {
  const items = (await q(CART_SELECT, [req.currentUser.id])).rows.map((r) => lineDto(r, req.currentUser));
  res.json({
    items,
    totals: totalsOf(items),
    maxQty: MAX_QTY_PER_ITEM,
    maxPositions: MAX_CART_POSITIONS,
    dayCapacity: DAY_CAPACITY,
    reserveMinutes: RESERVE_MINUTES,
  });
}));

app.post("/api/cart", requireUser, ah(async (req, res) => {
  const userId = req.currentUser.id;
  const carId = parseId(req.body.carId) || bad("Некорректный товар");
  const car = (await q("SELECT id, name, price::float8 AS price, discount_percent, stock FROM cars WHERE id = $1", [carId])).rows[0];
  if (!car) bad("Товар не найден", "NOT_FOUND", 404);
  const stock = Number(car.stock || 0);

  const free = freeForUser(stock, await reservedQuantity(carId, userId));

  if (free === 0) {
    bad(
      stock === 0
        ? `Товар «${car.name}» закончился — все машины этой модели выкуплены`
        : `Все свободные машины «${car.name}» уже в корзинах других покупателей — товар закончился. Попробуйте позже`,
      "OUT_OF_STOCK",
      409
    );
  }

  if (applyDiscount(car.price, car.discount_percent, req.currentUser).unitFinal < 1) {
    bad(`Товар «${car.name}» нельзя купить за 0 ₽ — у него нулевая цена`, "ZERO_PRICE", 400);
  }
  const existing = (await q("SELECT id, quantity FROM cart_items WHERE user_id = $1 AND car_id = $2", [userId, carId])).rows[0];
  const maxForCar = Math.min(MAX_QTY_PER_ITEM, free);
  if (!existing) {
    const positions = Number((await q("SELECT COUNT(*) FROM cart_items WHERE user_id = $1", [userId])).rows[0].count);
    if (positions >= MAX_CART_POSITIONS) bad(`В корзине не может быть больше ${MAX_CART_POSITIONS} разных товаров`);

    await q(
      `INSERT INTO cart_items (user_id, car_id, quantity, added_at) VALUES ($1, $2, 1, NOW())
       ON CONFLICT (user_id, car_id) DO UPDATE SET quantity = cart_items.quantity + 1, added_at = NOW()`,
      [userId, carId]
    );
  } else if (existing.quantity >= MAX_QTY_PER_ITEM) {
    bad(`Максимум ${MAX_QTY_PER_ITEM} шт. одного товара — больше добавить нельзя. Другие товары по-прежнему доступны`, "QTY_LIMIT", 409);
  } else if (existing.quantity >= free) {
    bad(
      `Свободных машин «${car.name}» осталось ${free} шт. — больше в корзину не добавить`,
      "OUT_OF_STOCK",
      409
    );
  } else {
    await q("UPDATE cart_items SET quantity = quantity + 1, added_at = NOW() WHERE id = $1", [existing.id]);
  }

  await q(
    "UPDATE cart_items SET quantity = $1 WHERE user_id = $2 AND car_id = $3 AND quantity > $1",
    [Math.max(1, maxForCar), userId, carId]
  );
  res.json({ ok: true, maxQty: MAX_QTY_PER_ITEM, dayCapacity: DAY_CAPACITY, cartQuantity: await cartQuantity(userId) });
}));

app.put("/api/cart/:id", requireUser, ah(async (req, res) => {
  const id = parseId(req.params.id);
  const quantity = Number(req.body.quantity);
  if (!id || !Number.isInteger(quantity)) bad("Некорректное количество");
  if (quantity > MAX_QTY_PER_ITEM) bad(`Максимум ${MAX_QTY_PER_ITEM} шт. одного товара`, "QTY_LIMIT", 409);
  const current = (await q(
    `SELECT cart_items.car_id, cart_items.quantity, cars.stock, cars.name
     FROM cart_items JOIN cars ON cars.id = cart_items.car_id
     WHERE cart_items.id = $1 AND cart_items.user_id = $2`,
    [id, req.currentUser.id]
  )).rows[0];
  if (current) {
    const free = freeForUser(current.stock, await reservedQuantity(current.car_id, req.currentUser.id));
    if (quantity > free) {
      bad(
        Number(current.stock) === 0
          ? `Товар «${current.name}» закончился — все машины выкуплены`
          : `Свободных машин «${current.name}» осталось ${free} шт. — больше не добавить`,
        "OUT_OF_STOCK",
        409
      );
    }
  }
  const r =
    quantity <= 0
      ? await q("DELETE FROM cart_items WHERE id = $1 AND user_id = $2", [id, req.currentUser.id])
      : await q("UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3", [quantity, id, req.currentUser.id]);
  if (r.rowCount === 0) bad("Позиция не найдена в корзине", "NOT_FOUND", 404);
  res.json({ ok: true });
}));

app.delete("/api/cart/:id", requireUser, ah(async (req, res) => {
  await q("DELETE FROM cart_items WHERE id = $1 AND user_id = $2", [idParam(req, "позиции"), req.currentUser.id]);
  res.json({ ok: true });
}));

app.post("/api/orders", requireUser, ah(async (req, res) => {
  const user = req.currentUser;
  const rawAddress = typeof req.body.address === "string" ? req.body.address.trim() : "";
  const address = rawAddress || String(user.address || "").trim();
  if (!address) bad("Укажите адрес доставки");
  maxLen(address, 300, "Адрес");
  const deliveryDate = parseDeliveryDate(req.body.deliveryDate);

  const result = await tx(async (c) => {
    const lines = (await c.query(CART_SELECT, [user.id])).rows.map((r) => lineDto(r, user));
    if (!lines.length) bad("Корзина пуста");
    const zeroLine = lines.find((l) => l.unitFinal < 1 || l.priceAfter < 1);
    if (zeroLine) bad(`Товар «${zeroLine.name}» с нулевой ценой нельзя купить — исправьте цену товара`, "ZERO_PRICE", 400);

    const locked = (await c.query(
      "SELECT id, name, stock FROM cars WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE",
      [lines.map((l) => l.carId)]
    )).rows;
    const stocks = new Map(locked.map((row) => [row.id, row]));
    for (const line of lines) {
      const car = stocks.get(line.carId);
      const stock = car ? Number(car.stock) : 0;
      if (!car || stock <= 0) {
        bad(`Товар «${line.name}» закончился — все машины этой модели выкуплены. Уберите его из корзины`, "OUT_OF_STOCK", 409);
      }
      if (line.quantity > stock) {
        bad(
          `Модели «${line.name}» осталось всего ${stock} шт., а в корзине ${line.quantity} шт. Уменьшите количество до ${stock} — остальное раскупили`,
          "OUT_OF_STOCK",
          409
        );
      }
    }
    const totals = totalsOf(lines);
    if (totals.totalAfter < 1) bad("Сумма заказа не может быть нулевой", "ZERO_PRICE", 400);

    if (totals.itemsCount > DAY_CAPACITY) {
      bad(
        `В корзине ${totals.itemsCount} шт., а на один день доставки магазин отдаёт не больше ${DAY_CAPACITY} шт. (столько машин и сотрудников). Уменьшите количество или оформите заказ в два приёма — на разные даты`,
        "DAY_LIMIT",
        409
      );
    }
    const booked = await bookedForDate(deliveryDate, c);
    if (booked + totals.itemsCount > DAY_CAPACITY) {
      const dateText = deliveryDate.split("-").reverse().join(".");
      bad(
        `На ${dateText} мест больше нет: уже оформлено ${booked} из ${DAY_CAPACITY} шт., поэтому все товары и категории на этот день закрыты. Выберите другую дату доставки — в один день магазин может отдать только ${DAY_CAPACITY} шт.`,
        "DAY_FULL",
        409
      );
    }
    const order = (await c.query(
      "INSERT INTO orders (user_id, address, delivery_date, total_before, total_after, payment_status) VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id, created_at",
      [user.id, address, deliveryDate, totals.totalBefore, totals.totalAfter]
    )).rows[0];

    const items = [];
    for (const l of lines) {
      const row = {
        car_id: l.carId,
        car_name: l.name,
        car_details: `${l.ownedYears} г. владения · ${Number(l.mileageKm).toLocaleString("ru-RU")} км`,
        discount_percent: l.discount,
        discount_source: l.discountSource === "coupon" ? `coupon:${l.couponCode}` : l.discountSource,
        price_before: l.priceBefore,
        price_after: l.priceAfter,
        quantity: l.quantity,
      };
      await c.query(
        `INSERT INTO order_items (order_id, car_id, car_name, car_details, discount_percent, discount_source, price_before, price_after, quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [order.id, row.car_id, row.car_name, row.car_details, row.discount_percent, row.discount_source, row.price_before, row.price_after, row.quantity]
      );

      await c.query("UPDATE cars SET stock = stock - $1 WHERE id = $2", [l.quantity, l.carId]);
      items.push(orderItemDto(row));
    }
    await c.query("DELETE FROM cart_items WHERE user_id = $1", [user.id]);
    if (req.body.saveAddress === true || !String(user.address || "").trim()) {
      await c.query("UPDATE users SET address = $1 WHERE id = $2", [address, user.id]);
    }

    const couponUsed = lines.some((l) => l.discountSource === "coupon");
    if (couponUsed && user.coupon_first_order_only) {
      await c.query("UPDATE users SET coupon_id = NULL WHERE id = $1", [user.id]);
    }
    return {
      orderId: order.id, createdAt: order.created_at, address, deliveryDate, status: "new",
      paymentStatus: "pending", paymentLabel: PAYMENT_STATUS_NAMES.pending,
      couponUsed, couponBurned: Boolean(couponUsed && user.coupon_first_order_only),
      ...totals, items,
    };
  });
  res.json(result);
}));

const ORDERS_SELECT = `
  SELECT orders.id, orders.address, orders.delivery_date::text AS delivery_date, orders.status,
         orders.payment_status, orders.paid_at,
         orders.total_before::float8 AS total_before, orders.total_after::float8 AS total_after, orders.created_at,
         users.email AS user_email, users.full_name AS user_name, users.phone AS user_phone
  FROM orders JOIN users ON users.id = orders.user_id`;

async function ordersWithItems(rows) {
  const items = rows.length
    ? (await q(
        `SELECT order_id, car_name, car_details, discount_percent, discount_source,
                price_before::float8 AS price_before, price_after::float8 AS price_after, quantity
         FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id`,
        [rows.map((o) => o.id)]
      )).rows
    : [];
  return rows.map((o) => {
    const list = items.filter((i) => i.order_id === o.id).map(orderItemDto);
    return {
      id: o.id, address: o.address, deliveryDate: o.delivery_date, status: o.status, createdAt: o.created_at,
      paymentStatus: o.payment_status || "pending", paymentLabel: PAYMENT_STATUS_NAMES[o.payment_status || "pending"] || "Ожидает оплаты",
      paidAt: o.paid_at, isPaid: o.payment_status === "paid",
      totalBefore: o.total_before, totalAfter: o.total_after, itemsCount: list.reduce((s, i) => s + i.quantity, 0), items: list,
      userEmail: o.user_email, userName: o.user_name, userPhone: o.user_phone,
    };
  });
}

app.get("/api/orders", requireUser, ah(async (req, res) => {
  const rows = (await q(`${ORDERS_SELECT} WHERE orders.user_id = $1 ORDER BY orders.id DESC`, [req.currentUser.id])).rows;
  res.json(await ordersWithItems(rows));
}));

app.get("/api/admin/orders", requireStaff, ah(async (req, res) => {
  const rows = (await q(`${ORDERS_SELECT} ORDER BY orders.id DESC`)).rows;
  const list = await ordersWithItems(rows);
  res.json(list.filter((o) => matches(req.query.search, String(o.id), o.userEmail, o.userName, o.status, o.paymentLabel, o.address)));
}));

app.post("/api/orders/:id/pay", requireUser, ah(async (req, res) => {
  const id = idParam(req, "заказа");
  const order = (await q("SELECT id, user_id, status, payment_status FROM orders WHERE id = $1", [id])).rows[0];
  if (!order || order.user_id !== req.currentUser.id) bad("Заказ не найден", "NOT_FOUND", 404);
  if (order.status === "cancelled") bad("Отменённый заказ нельзя оплатить");
  if (order.payment_status === "paid") bad("Заказ уже оплачен");
  await q("UPDATE orders SET payment_status = 'paid', paid_at = NOW() WHERE id = $1", [id]);
  res.json({ ok: true, paymentStatus: "paid", paymentLabel: PAYMENT_STATUS_NAMES.paid, message: "Заказ оплачен" });
}));

app.put("/api/orders/:id/payment", requireStaff, ah(async (req, res) => {
  const id = idParam(req, "заказа");
  const next = String(req.body.paymentStatus || "");
  if (!PAYMENT_STATUSES.includes(next)) bad("Недопустимый статус оплаты");
  const order = (await q("SELECT id, payment_status FROM orders WHERE id = $1", [id])).rows[0];
  if (!order) bad("Заказ не найден", "NOT_FOUND", 404);
  if (order.payment_status === "paid" && next === "pending") {
    bad("Заказ уже оплачен — вернуть статус «Ожидает оплаты» нельзя", "PAID_LOCKED", 403);
  }
  await q("UPDATE orders SET payment_status = $1, paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE NULL END WHERE id = $2", [next, id]);
  res.json({ ok: true, paymentStatus: next, paymentLabel: PAYMENT_STATUS_NAMES[next] });
}));

app.put("/api/orders/:id/status", requireStaff, ah(async (req, res) => {
  const id = idParam(req, "заказа");
  const status = req.body.status;
  if (!ORDER_STATUSES.includes(status)) bad("Недопустимый статус заказа");
  const result = await tx(async (c) => {
    const order = (await c.query("SELECT id, status FROM orders WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!order) bad("Заказ не найден", "NOT_FOUND", 404);
    if (order.status === status) return { status, returnedToStock: 0 };
    const items = (await c.query("SELECT car_id, car_name, quantity FROM order_items WHERE order_id = $1", [id])).rows;
    let returnedToStock = 0;
    if (status === "cancelled") {

      for (const item of items) {
        if (!item.car_id) continue;
        await c.query("UPDATE cars SET stock = stock + $1 WHERE id = $2", [item.quantity, item.car_id]);
        returnedToStock += item.quantity;
      }
    } else if (order.status === "cancelled") {

      const ids = items.filter((i) => i.car_id).map((i) => i.car_id);
      const cars = ids.length ? (await c.query("SELECT id, stock FROM cars WHERE id = ANY($1::int[]) FOR UPDATE", [ids])).rows : [];
      const byId = new Map(cars.map((car) => [car.id, Number(car.stock)]));
      for (const item of items) {
        if (!item.car_id) continue;
        const left = byId.get(item.car_id) ?? 0;
        if (left < item.quantity) {
          bad(`Нельзя вернуть заказ из отмены: модели «${item.car_name}» осталось ${left} шт., а в заказе ${item.quantity}`, "OUT_OF_STOCK", 409);
        }
      }
      for (const item of items) {
        if (!item.car_id) continue;
        await c.query("UPDATE cars SET stock = stock - $1 WHERE id = $2", [item.quantity, item.car_id]);
      }
    }
    await c.query("UPDATE orders SET status = $1 WHERE id = $2", [status, id]);
    return { status, returnedToStock };
  });
  res.json({ ok: true, ...result });
}));

app.delete("/api/orders/:id", requireStaff, ah(async (req, res) => {
  const id = idParam(req, "заказа");
  if (!(await q("SELECT id FROM orders WHERE id = $1", [id])).rows[0]) bad("Заказ не найден", "NOT_FOUND", 404);
  bad("Чек (заказ) удалять нельзя — он хранится как документ продажи", "FORBIDDEN", 403);
}));

const REVIEWS_SELECT = `
  SELECT reviews.id, reviews.rating, reviews.comment, reviews.created_at, reviews.user_id,
         reviews.deleted_by_admin, reviews.deleted_at,
         users.full_name AS author, cars.name AS car_name, cars.code AS car_code
  FROM reviews JOIN users ON users.id = reviews.user_id JOIN cars ON cars.id = reviews.car_id`;

const isStaffRole = (u) => Boolean(u) && (u.role === "admin" || u.role === "employee");

const REVIEW_DELETED_NOTICE = "Отзыв удалён администратором за нарушение политики сайта";

function reviewDto(r, viewer) {
  const deleted = Boolean(r.deleted_by_admin);
  return {
    id: r.id, rating: r.rating,
    comment: deleted ? "" : r.comment,
    deletedByAdmin: deleted,
    notice: deleted ? REVIEW_DELETED_NOTICE : null,
    createdAt: r.created_at, deletedAt: r.deleted_at, author: r.author,
    carName: r.car_name, carCode: r.car_code,
    isMine: Boolean(viewer && viewer.id === r.user_id),
    canDelete: Boolean(viewer && (isStaffRole(viewer) || viewer.id === r.user_id)),
    canEdit: Boolean(viewer && !deleted && (isStaffRole(viewer) || viewer.id === r.user_id)),
  };
}

function reviewFields(body) {
  const rating = Number(body.rating);
  const comment = String(body.comment || "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) bad("Оценка должна быть от 1 до 5");

  if (!comment) bad("Отзыв не может быть пустым — напишите несколько слов");
  const letters = comment.replace(/[^A-Za-zА-Яа-яЁё]/g, "");
  if (letters.length < 3) bad("Отзыв не может быть пустым: напишите хотя бы несколько слов (минимум 3 буквы)");
  if (comment.length < 3) bad("Напишите комментарий (минимум 3 символа)");
  maxLen(comment, 1000, "Комментарий");

  if (hasProfanity(comment)) bad(PROFANITY_ERROR, "PROFANITY", 400);
  return { rating, comment };
}

app.get("/api/cars/:id/reviews", optionalAuth, ah(async (req, res) => {
  const rows = (await q(`${REVIEWS_SELECT} WHERE reviews.car_id = $1 ORDER BY reviews.id DESC`, [idParam(req, "товара")])).rows;
  res.json(rows.map((r) => reviewDto(r, req.currentUser)));
}));

app.post("/api/cars/:id/reviews", requireUser, ah(async (req, res) => {
  const carId = idParam(req, "товара");
  const { rating, comment } = reviewFields(req.body);
  if (!(await q("SELECT id FROM cars WHERE id = $1", [carId])).rows[0]) bad("Товар не найден", "NOT_FOUND", 404);

  const existing = (await q("SELECT id FROM reviews WHERE user_id = $1 AND car_id = $2", [req.currentUser.id, carId])).rows[0];
  if (existing) {
    bad("Вы уже оставили отзыв на этот товар — его можно только изменить или удалить", "ALREADY_REVIEWED", 409);
  }
  await q("INSERT INTO reviews (user_id, car_id, rating, comment) VALUES ($1, $2, $3, $4)", [req.currentUser.id, carId, rating, comment]);
  res.json({ ok: true });
}));

app.get("/api/reviews", requireStaff, ah(async (req, res) => {
  const rows = (await q(`${REVIEWS_SELECT} ORDER BY reviews.id DESC`)).rows;
  res.json(
    rows
      .map((r) => reviewDto(r, req.currentUser))
      .filter((r) => matches(req.query.search, r.author, r.carName, r.carCode, r.comment, r.notice))
  );
}));

app.put("/api/reviews/:id", requireAuth, ah(async (req, res) => {
  const id = idParam(req, "отзыва");
  const current = (await q("SELECT user_id, deleted_by_admin FROM reviews WHERE id = $1", [id])).rows[0];
  if (!current) bad("Отзыв не найден", "NOT_FOUND", 404);
  if (!isStaffRole(req.currentUser) && current.user_id !== req.currentUser.id) bad("Можно изменять только свои отзывы", "FORBIDDEN", 403);
  if (current.deleted_by_admin && !isStaffRole(req.currentUser)) {
    bad("Отзыв удалён администратором за нарушение политики — изменить его нельзя", "REVIEW_REMOVED", 403);
  }
  const { rating, comment } = reviewFields(req.body);
  await q("UPDATE reviews SET rating = $1, comment = $2, deleted_by_admin = FALSE, deleted_at = NULL WHERE id = $3", [rating, comment, id]);
  res.json({ ok: true });
}));

app.delete("/api/reviews/:id", requireAuth, ah(async (req, res) => {
  const id = idParam(req, "отзыва");
  const review = (await q("SELECT user_id FROM reviews WHERE id = $1", [id])).rows[0];
  if (!review) bad("Отзыв не найден", "NOT_FOUND", 404);
  const staff = isStaffRole(req.currentUser);
  if (!staff && review.user_id !== req.currentUser.id) bad("Можно удалять только свои отзывы", "FORBIDDEN", 403);
  if (staff) {

    await q("UPDATE reviews SET deleted_by_admin = TRUE, deleted_at = NOW() WHERE id = $1", [id]);
    return res.json({ ok: true, deletedByAdmin: true, notice: REVIEW_DELETED_NOTICE });
  }
  await q("DELETE FROM reviews WHERE id = $1", [id]);
  res.json({ ok: true, deletedByAdmin: false });
}));

app.use((req, res, next) => next(new HttpError(404, "Такого адреса на сервере нет", "NOT_FOUND")));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const send = (status, error, code) => res.status(status).json({ error, code });
  if (err instanceof HttpError) return send(err.status, err.message, err.code);
  if (err.type === "entity.parse.failed") return send(400, "Некорректный JSON в запросе", "BAD_JSON");
  console.error(`${req.method} ${req.originalUrl}:`, err.message || err.code || err);
  if (isDbDown(err)) {
    return send(503, `Сервис временно недоступен: ведутся технические работы (база данных недоступна: ${dbErrorText(err)})`, "DB_UNAVAILABLE");
  }
  send(500, `Внутренняя ошибка сервера: ${err.message || "неизвестная ошибка"}`, "SERVER_ERROR");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  if (MAIL_CONFIGURED) {
    console.log(`Почта: НАСТРОЕНА — ${SMTP_HOST}:${SMTP_PORT}, логин ${SMTP_USER}. Коды сброса уходят письмами.`);
  } else if (MAIL_PLACEHOLDER_FOUND) {
    console.log("Почта: НЕ настроена — в .env остались заглушки вместо SMTP_USER / SMTP_PASS.");
    console.log("Замените ВАШ_ЛОГИН@gmail.com и ВАШ_ПАРОЛЬ_ПРИЛОЖЕНИЯ на свои данные и сохраните файл.");
  } else {
    console.log("Почта: НЕ настроена — заполните SMTP_HOST, SMTP_USER и SMTP_PASS в my-api/backend/.env.");
  }
  initDb();
});
