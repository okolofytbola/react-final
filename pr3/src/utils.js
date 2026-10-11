import { useEffect, useRef, useState } from "react";

export const rub = (n) => `${Math.round(Number(n) || 0).toLocaleString("ru-RU")} ₽`;

export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const ROLE_NAMES = { admin: "Администратор", employee: "Сотрудник", user: "Пользователь" };

export const ORDER_STATUSES = {
  new: "Новый",
  processing: "В обработке",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

export const PAYMENT_STATUSES = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
};

export const MAX_QTY_PER_ITEM = 10;

export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export const PHONE_PLACEHOLDER = "+7 (900) 123-45-67";
export const PHONE_RE = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;

export function formatPhone(value) {
  let digits = String(value === undefined || value === null ? "" : value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits[0] === "8") digits = `7${digits.slice(1)}`;
  if (digits[0] !== "7") digits = `7${digits}`;
  digits = digits.slice(0, 11);
  const rest = digits.slice(1);
  let out = "+7";
  if (rest.length) out += ` (${rest.slice(0, 3)}`;
  if (rest.length >= 3) out += ")";
  if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`;
  return out;
}

export const validPhone = (v) => PHONE_RE.test(String(v || "").trim());
export const PHONE_ERROR = `Введите телефон в формате ${PHONE_PLACEHOLDER}`;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAME_VOWELS = /[аеёиоуыэюяaeiouy]/i;
const KEYBOARD_MASH = ["йцук", "цуке", "фыва", "ывап", "ячсм", "чсми", "asdf", "sdfg", "dfgh", "qwer", "wert", "erty", "zxcv", "xcvb"];

export function personNameError(value, what = "ФИО") {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (!name) return `Укажите ${what.toLowerCase()}`;
  if (name.length > 100) return `${what}: максимум 100 символов`;
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return `${what}: укажите фамилию и имя, например «Иванов Иван»`;
  for (const part of parts) {
    if (!/^[А-Яа-яЁёA-Za-z-]{2,}$/.test(part)) return `${what}: каждое слово — только буквы, минимум 2 символа (например, Иванов Иван)`;
    if (!NAME_VOWELS.test(part)) return `${what}: «${part}» не похоже на настоящее имя`;
    if (/(.)\1\1/i.test(part)) return `${what}: «${part}» не похоже на настоящее имя`;
    if (KEYBOARD_MASH.some((m) => part.toLowerCase().includes(m))) return `${what}: «${part}» похоже на случайный набор букв — введите настоящее имя`;
  }
  return "";
}
export const validPersonName = (value) => personNameError(value) === "";

const MAT_ROOTS = ["хуй", "хуя", "хую", "хуё", "хуе", "хуи", "пизд", "бляд", "блят", "блядь", "бля", "пидор", "пидар", "педик", "ебал", "ебат", "ебет", "ебуч", "ебан", "еби", "ебн", "заеб", "наеб", "уеб", "выеб", "охуе", "охуи", "долбо", "мудак", "мудил", "гандон", "гондон", "дроч", "залуп", "шлюх", "сучк", "мраз"];
const MAT_WORDS = ["сука", "суки", "манда", "срак", "срать", "хер", "гнида", "тварь", "мразь"];
const HOMOGLYPHS = { a: "а", b: "б", c: "с", e: "е", h: "н", k: "к", m: "м", o: "о", p: "р", t: "т", x: "х", y: "у", u: "и" };

export function normalizeForProfanity(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[abcehkmopxyu]/g, (ch) => HOMOGLYPHS[ch] || ch)
    .replace(/[^а-яё]+/g, " ")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasProfanity(text) {
  const normalized = normalizeForProfanity(text);
  if (!normalized) return false;
  if (MAT_ROOTS.some((root) => normalized.includes(root))) return true;
  return normalized.split(" ").some((w) => MAT_WORDS.includes(w));
}

export function reviewError(comment) {
  const text = String(comment || "").trim();
  if (!text) return "Отзыв не может быть пустым — напишите несколько слов";
  const letters = text.replace(/[^A-Za-zА-Яа-яЁё]/g, "");
  if (letters.length < 3) return "Отзыв не может быть пустым: напишите хотя бы несколько слов (минимум 3 буквы)";
  if (hasProfanity(text)) return "В отзыве есть нецензурная лексика. Пожалуйста, перепишите отзыв без мата — такой отзыв не публикуется.";
  return "";
}

export const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

export const isStaff = (user) => Boolean(user) && (user.role === "admin" || user.role === "employee");

export function discountText({ discount, discountSource, couponCode }) {
  if (!discount) return "";
  if (discountSource === "coupon") return `Ваша скидка по купону ${couponCode}: −${discount}%`;
  return `Скидка на товар: −${discount}%`;
}

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useOnRecovered(callback) {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener("server-recovered", handler);
    return () => window.removeEventListener("server-recovered", handler);
  }, []);
}

const COOKIE_NAME = "lada_session";

export function saveSessionCookie(token) {
  if (typeof document === "undefined") return;
  const base = `${COOKIE_NAME}=${encodeURIComponent(token || "")}; path=/; SameSite=Lax`;
  document.cookie = token ? `${base}; max-age=${60 * 60 * 24 * 30}` : `${base}; max-age=0`;
}

export function readSessionCookie() {
  if (typeof document === "undefined") return "";
  const found = document.cookie.split("; ").find((row) => row.startsWith(`${COOKIE_NAME}=`));
  return found ? decodeURIComponent(found.slice(COOKIE_NAME.length + 1)) : "";
}
