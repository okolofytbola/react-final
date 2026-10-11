import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useOnRecovered } from "./utils";
import * as api from "./api";

const NEUTRAL = "Без категории";

function CategoryRow({ category, others, token, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [deleting, setDeleting] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);

  const system = category.isNeutral || category.name.toLowerCase() === NEUTRAL.toLowerCase();

  async function save() {
    setBusy(true);
    onError("");
    try {
      await api.renameCategory(token, category.id, name);
      setEditing(false);
      onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    onError("");
    try {

      await api.deleteCategory(token, category.id, moveTo || null);
      onChanged();
    } catch (err) {
      onError(err.message);
      setBusy(false);
    }
  }

  if (system) {
    return (
      <div className="row-item">
        <span className="grow">
          {category.name}{" "}
          <span className="badge badge-coupon">системная</span>{" "}
          <span className="muted small">· товаров: {category.carsCount} — сюда переезжают товары удалённых категорий</span>
        </span>
      </div>
    );
  }

  return (
    <div className="row-item">
      {editing ? (
        <div className="row-edit">
          <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <button className="btn btn-sm btn-primary" onClick={save} disabled={busy}>Сохранить</button>
          <button className="btn btn-sm" onClick={() => { setEditing(false); setName(category.name); onError(""); }}>Отмена</button>
        </div>
      ) : deleting ? (
        <div className="row-edit wrap">
          <span>
            Удалить категорию «{category.name}»?
            {category.carsCount > 0
              ? ` Товаров в ней: ${category.carsCount} — они перейдут в «${NEUTRAL}».`
              : " Товаров в ней нет."}
          </span>
          {category.carsCount > 0 && others.length > 0 && (
            <>
              <span>Перенести товары в:</span>
              <select className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="">{NEUTRAL} (по умолчанию)</option>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </>
          )}
          <button className="btn btn-sm btn-danger" disabled={busy} onClick={remove}>Удалить</button>
          <button className="btn btn-sm" onClick={() => setDeleting(false)}>Отмена</button>
        </div>
      ) : (
        <>
          <span className="grow">
            {category.name} <span className="muted small">· товаров: {category.carsCount}</span>
          </span>
          <button className="btn btn-sm" onClick={() => setEditing(true)}>Переименовать</button>
          <button className="btn btn-sm btn-danger" onClick={() => setDeleting(true)}>Удалить</button>
        </>
      )}
    </div>
  );
}

function AdminCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api
      .getCategories()
      .then((list) => {
        setCategories(list);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useOnRecovered(load);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!name.trim()) {
      setError("Введите название категории");
      return;
    }
    setAdding(true);
    try {
      await api.addCategory(user.token, name);
      setName("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="card admin-card">
      <h2>Категории</h2>
      <p className="muted small">
        Название каждой категории уникально (без учёта регистра). Новые категории сразу появляются в фильтре каталога.
        При удалении категории её товары не пропадают, а переезжают в категорию «{NEUTRAL}» (или в ту, которую вы выберете).
      </p>
      <form onSubmit={handleAdd} className="toolbar" noValidate>
        <input className="input grow" placeholder="Название новой категории" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={adding}>Добавить</button>
      </form>
      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Загрузка...</p>}
      {!loading && categories.length === 0 && <p className="muted">Категорий пока нет.</p>}
      {categories.map((category) => (
        <CategoryRow
          key={category.id}
          category={category}
          others={categories.filter((c) => c.id !== category.id && !c.isNeutral)}
          token={user.token}
          onChanged={() => {
            setNotice("");
            load();
          }}
          onError={setError}
        />
      ))}
    </div>
  );
}

export default AdminCategories;
