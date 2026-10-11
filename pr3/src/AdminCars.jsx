import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useDebouncedValue, useOnRecovered, rub } from "./utils";
import * as api from "./api";

const EMPTY = { code: "", name: "", description: "", price: "", imageUrl: "", categoryId: "", discountPercent: 0, ownedYears: 1, mileageKm: 0, stock: 5 };

function CarForm({ initial, categories, onSubmit, onCancel, submitText }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.code.trim() || !form.name.trim()) return setError("Заполните код и название");
    if (form.price === "" || Number(form.price) < 1) return setError("Цена должна быть больше нуля — товар нельзя продавать за 0 ₽");
    if (Number(form.price) > 1e9) return setError("Цена не может быть больше 1 000 000 000 ₽");
    if (!form.categoryId) return setError("Выберите категорию");
    const discount = Number(form.discountPercent);
    if (!Number.isInteger(discount) || discount < 0 || discount > 99) return setError("Скидка — целое число от 0 до 99%");
    if (Math.round((Number(form.price) * (100 - discount)) / 100) < 1) return setError("С такой скидкой цена становится нулевой — уменьшите скидку");
    const stock = Number(form.stock);
    if (form.stock === "" || !Number.isInteger(stock) || stock < 0 || stock > 1000) {
      return setError("Количество в наличии: целое число от 0 до 1000 (0 — машины закончились)");
    }
    setBusy(true);
    try {
      await onSubmit({
        code: form.code,
        name: form.name,
        description: form.description,
        price: Number(form.price),
        imageUrl: form.imageUrl,
        categoryId: Number(form.categoryId),
        discountPercent: discount,
        ownedYears: Number(form.ownedYears),
        mileageKm: Number(form.mileageKm),
        stock,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <label className="field"><span>Код товара</span><input className="input" value={form.code} onChange={set("code")} placeholder="LADA-011" /></label>
        <label className="field"><span>Название</span><input className="input" value={form.name} onChange={set("name")} /></label>
        <label className="field">
          <span>Категория</span>
          <select className="input" value={form.categoryId} onChange={set("categoryId")}>
            <option value="">— выберите —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Цена, ₽ (не может быть 0)</span><input className="input" type="number" min="1" value={form.price} onChange={set("price")} /></label>
        <label className="field"><span>Скидка на товар, %</span><input className="input" type="number" min="0" max="99" value={form.discountPercent} onChange={set("discountPercent")} /></label>
        <label className="field"><span>В наличии, шт.</span><input className="input" type="number" min="0" max="1000" value={form.stock} onChange={set("stock")} /></label>
        <label className="field"><span>Срок владения, лет</span><input className="input" type="number" min="0" value={form.ownedYears} onChange={set("ownedYears")} /></label>
        <label className="field"><span>Пробег, км</span><input className="input" type="number" min="0" value={form.mileageKm} onChange={set("mileageKm")} /></label>
        <label className="field"><span>Ссылка на фото</span><input className="input" value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://..." /></label>
      </div>
      <label className="field"><span>Описание</span><textarea className="input" rows={2} value={form.description} onChange={set("description")} /></label>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="toolbar">
        <button className="btn btn-primary" disabled={busy}>{submitText}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Отмена</button>}
      </div>
    </form>
  );
}

function AdminCars() {
  const { user } = useAuth();
  const [cars, setCars] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [deletingCode, setDeletingCode] = useState(null);
  const debounced = useDebouncedValue(search.trim());

  const load = useCallback(() => {
    Promise.all([api.getCars({ search: debounced }), api.getCategories()])
      .then(([carList, categoryList]) => {
        setCars(carList);
        setCategories(categoryList);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [debounced]);

  useEffect(() => {
    load();
  }, [load]);
  useOnRecovered(load);

  async function remove(car) {
    setError("");
    try {
      await api.deleteCar(user.token, car.id);
      setDeletingCode(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card admin-card">
      <h2>Товары и скидки</h2>
      <p className="muted small">
        Добавление, изменение и удаление автомобилей. Цена товара не может быть нулевой — товар за 0 ₽ купить нельзя.
        Скидка на товар — от 0 до 99%; если у клиента есть купон, применяется более выгодная скидка.
        «В наличии» — сколько машин этой модели на складе: когда остаток станет 0, покупатели увидят «Нет в наличии»
        и купить не смогут. При отмене заказа машины возвращаются на склад автоматически.
      </p>
      <div className="toolbar">
        <input className="input grow" placeholder="Поиск по названию или коду (LADA-007)" value={search} onChange={(e) => setSearch(e.target.value)} />
        {!adding && <button className="btn btn-primary" onClick={() => { setAdding(true); setEditing(null); }}>+ Добавить товар</button>}
      </div>
      {adding && (
        <div className="panel">
          <h3>Новый товар</h3>
          <CarForm
            initial={EMPTY}
            categories={categories}
            submitText="Создать"
            onCancel={() => setAdding(false)}
            onSubmit={async (data) => {
              await api.createCar(user.token, data);
              setAdding(false);
              load();
            }}
          />
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Загрузка...</p>}
      {!loading && !error && cars.length === 0 && (
        <p className="muted">{debounced ? `Товары по запросу «${debounced}» не найдены.` : "Товаров пока нет."}</p>
      )}
      {cars.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Код</th><th>Модель</th><th>Категория</th><th>Цена</th><th>Скидка</th><th>В наличии</th><th>Отзывов</th><th></th></tr>
            </thead>
            <tbody>
              {cars.map((car) =>
                editing === car.code ? (
                  <tr key={car.code}>
                    <td colSpan={8}>
                      <h3>Изменение: {car.name}</h3>
                      <CarForm
                        initial={{
                          code: car.code, name: car.name, description: car.description, price: car.price, imageUrl: car.imageUrl || "",
                          categoryId: car.categoryId || "", discountPercent: car.productDiscount, ownedYears: car.ownedYears,
                          mileageKm: car.mileageKm, stock: car.stock,
                        }}
                        categories={categories}
                        submitText="Сохранить"
                        onCancel={() => setEditing(null)}
                        onSubmit={async (data) => {
                          await api.updateCar(user.token, car.id, data);
                          setEditing(null);
                          load();
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={car.code}>
                    <td className="small">{car.code}</td>
                    <td>{car.name}</td>
                    <td>{car.categoryName || <span className="muted">—</span>}</td>
                    <td>{rub(car.price)}</td>
                    <td>{car.productDiscount}%</td>
                    <td className={car.stock === 0 ? "error" : ""}>
                      {car.stock === 0 ? "нет в наличии" : `${car.stock} шт.`}
                    </td>
                    <td>{car.reviewsCount}</td>
                    <td className="actions-cell">
                      {deletingCode === car.code ? (
                        <>
                          <span className="small">Товар исчезнет и из корзин. Удалить?</span>
                          <button className="btn btn-sm btn-danger" onClick={() => remove(car)}>Да</button>
                          <button className="btn btn-sm" onClick={() => setDeletingCode(null)}>Нет</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-sm" onClick={() => { setEditing(car.code); setAdding(false); }}>Изменить</button>
                          <button className="btn btn-sm btn-danger" onClick={() => setDeletingCode(car.code)}>Удалить</button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminCars;
