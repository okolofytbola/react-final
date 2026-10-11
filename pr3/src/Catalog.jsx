import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import ProductCard from "./ProductCard";
import { useDebouncedValue, useOnRecovered } from "./utils";
import * as api from "./api";

function Catalog() {
  const { user } = useAuth();
  const token = user ? user.token : null;
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") || "";
  const appliedUrlSearch = useRef(urlSearch);
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState(urlSearch);
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [sort, setSort] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const debouncedSearch = useDebouncedValue(search.trim(), 200);
  const debouncedMin = useDebouncedValue(minPrice, 400);
  const debouncedMax = useDebouncedValue(maxPrice, 400);

  useEffect(() => {
    if (urlSearch !== appliedUrlSearch.current) {
      appliedUrlSearch.current = urlSearch;
      setSearch(urlSearch);
    }
  }, [urlSearch]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  useOnRecovered(reload);

  useEffect(() => {
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  useEffect(() => {
    api
      .getCategories()
      .then((list) => {
        setCategories(list);
        setCategoriesError("");
      })
      .catch((err) => setCategoriesError(err.message));
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getCars({ token, search: debouncedSearch, categoryIds: selected, onlyDiscount, sort, minPrice: debouncedMin, maxPrice: debouncedMax })
      .then((list) => {
        if (cancelled) return;
        setCars(list);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setCars([]);
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, debouncedSearch, selected, onlyDiscount, sort, debouncedMin, debouncedMax, reloadKey]);

  function toggleCategory(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function resetFilters() {
    setSearch("");
    setSelected([]);
    setOnlyDiscount(false);
    setSort("");
    setMinPrice("");
    setMaxPrice("");
  }

  const filtersActive = Boolean(search.trim()) || selected.length > 0 || onlyDiscount || minPrice !== "" || maxPrice !== "";

  return (
    <div className="page catalog">
      <aside className="filters card">
        <h3>Категории</h3>
        {categoriesError && <p className="error small">{categoriesError}</p>}
        {!categoriesError && categories.length === 0 && <p className="muted small">Категорий пока нет</p>}
        {categories.map((category) => (
          <label key={category.id} className="check">
            <input type="checkbox" checked={selected.includes(category.id)} onChange={() => toggleCategory(category.id)} />
            <span>{category.name}</span>
          </label>
        ))}
        <h3 className="mt">Цена, ₽</h3>
        <div className="price-range">
          <input className="input" type="number" min="0" placeholder="от" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          <input className="input" type="number" min="0" placeholder="до" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        </div>
        <h3 className="mt">Фильтры</h3>
        <label className="check">
          <input type="checkbox" checked={onlyDiscount} onChange={(e) => setOnlyDiscount(e.target.checked)} />
          <span>Только со скидкой</span>
        </label>
        {filtersActive && (
          <button className="btn btn-sm btn-block mt" onClick={resetFilters}>
            Сбросить фильтры
          </button>
        )}
      </aside>

      <section className="catalog-main">
        <h1>Каталог Lada</h1>
        <div className="toolbar">
          <input
            className="input grow"
            placeholder="Поиск по названию или коду (например, Vesta или LADA-007)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="">Без сортировки</option>
            <option value="price_asc">Сначала дешёвые</option>
            <option value="price_desc">Сначала дорогие</option>
            <option value="name">По названию</option>
          </select>
        </div>

        {loading && cars.length === 0 && <p className="muted">Загрузка каталога...</p>}
        {loading && cars.length > 0 && <p className="muted small">Обновляем результаты…</p>}
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
            <button className="btn btn-sm" onClick={reload}>Повторить</button>
          </div>
        )}
        {!loading && !error && cars.length === 0 && (
          <div className="empty">
            {filtersActive ? (
              <>
                <p>
                  {search.trim() ? `По запросу «${search.trim()}» ничего не найдено.` : "С выбранными фильтрами ничего не найдено."}
                </p>
                <button className="btn" onClick={resetFilters}>Сбросить поиск и фильтры</button>
              </>
            ) : (
              <p>В каталоге пока нет товаров.</p>
            )}
          </div>
        )}
        {!error && cars.length > 0 && (
          <>
            <p className="muted small">Найдено: {cars.length}</p>
            <div className="grid-products">
              {cars.map((car) => (
                <ProductCard key={car.id} car={car} onReviewsChanged={reload} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default Catalog;
