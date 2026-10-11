import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { isStaff, rub, useDebouncedValue, stars } from "./utils";
import * as api from "./api";

function QuickSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef(null);
  const debounced = useDebouncedValue(query.trim(), 200);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getCars({ search: debounced })
      .then((list) => {
        if (cancelled) return;
        setResults(list.slice(0, 6));
        setOpen(true);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setResults([]);
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function goToCatalog(term) {
    setOpen(false);
    navigate(`/?search=${encodeURIComponent(term)}`);
  }

  return (
    <div className="quick-search" ref={boxRef}>
      <input
        className="input"
        placeholder="Поиск: модель или код (Vesta)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => (results.length || error) && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && query.trim()) goToCatalog(query.trim());
          if (e.key === "Escape") setOpen(false);
        }}
        aria-label="Быстрый поиск товаров"
      />
      {open && (
        <div className="search-dropdown">
          {loading && <div className="search-empty small muted">Ищем…</div>}
          {!loading && error && <div className="search-empty small error">{error}</div>}
          {!loading && !error && results.length === 0 && (
            <div className="search-empty small muted">По запросу «{debounced}» ничего не найдено</div>
          )}
          {!loading &&
            results.map((car) => (
              <button key={car.id} type="button" className="search-row" onClick={() => goToCatalog(car.name)}>
                <img src={car.imageUrl} alt="" className="search-img" />
                <span className="grow">
                  <span className="search-name">{car.name}</span>
                  <span className="muted small">
                    {car.code}
                    {car.reviewsCount > 0 ? ` · ${stars(Math.round(car.ratingAvg))}` : ""}
                  </span>
                </span>
                <span className="search-price">
                  {car.discount > 0 && <span className="old-price">{rub(car.price)}</span>}
                  <strong>{rub(car.finalPrice)}</strong>
                </span>
              </button>
            ))}
          {!loading && results.length > 0 && (
            <button type="button" className="search-all" onClick={() => goToCatalog(query.trim())}>
              Показать все результаты по «{query.trim()}»
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { totals } = useCart();
  const staff = isStaff(user);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">Lada Shop</Link>
        <QuickSearch />
        <nav className="nav-links">
          <NavLink to="/" end>Каталог</NavLink>
          {user && !staff && (
            <NavLink to="/cart">
              Корзина {totals.itemsCount > 0 && <span className="count">{totals.itemsCount}</span>}
            </NavLink>
          )}
          {user && !staff && <NavLink to="/profile">Профиль</NavLink>}
          {staff && <NavLink to="/admin">{user.role === "admin" ? "Админ-панель" : "Панель сотрудника"}</NavLink>}
          {!user && <NavLink to="/login">Вход</NavLink>}
          {!user && <NavLink to="/register">Регистрация</NavLink>}
        </nav>
        <div className="nav-right">
          {user && <span className="user-name">{user.fullName}</span>}
          {user && <button className="btn btn-sm" onClick={logout}>Выйти</button>}
          <button className="btn btn-sm" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "Тёмная тема" : "Светлая тема"}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
