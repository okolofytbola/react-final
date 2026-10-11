import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useDebouncedValue, useOnRecovered, formatDate, stars, reviewError } from "./utils";
import * as api from "./api";

function AdminReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ rating: 5, comment: "" });
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState("");
  const debounced = useDebouncedValue(search.trim());

  const load = useCallback(() => {
    api
      .getAllReviews(user.token, debounced)
      .then((list) => {
        setReviews(list);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user.token, debounced]);

  useEffect(() => {
    load();
  }, [load]);
  useOnRecovered(load);

  async function save(review) {
    setError("");
    setNotice("");
    const problem = reviewError(draft.comment);
    if (problem) return setError(problem);
    try {
      await api.updateReview(user.token, review.id, draft);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(review) {
    setError("");
    setNotice("");
    try {
      const res = await api.deleteReview(user.token, review.id);
      setDeletingId(null);
      if (res && res.deletedByAdmin) {
        setNotice("Отзыв удалён. Покупатели увидят пометку: «Отзыв удалён администратором за нарушение политики».");
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card admin-card">
      <h2>Отзывы</h2>
      <p className="muted small">
        У одного покупателя может быть только один отзыв на товар. Пустые отзывы и мат не принимаются.
        Удаление администратором не стирает отзыв бесследно: вместо текста появляется пометка о нарушении политики.
      </p>
      <input className="input search" placeholder="Поиск по автору, модели, коду или тексту" value={search} onChange={(e) => setSearch(e.target.value)} />
      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Загрузка...</p>}
      {!loading && !error && reviews.length === 0 && <p className="muted">{debounced ? `Отзывы по запросу «${debounced}» не найдены.` : "Отзывов пока нет."}</p>}
      {reviews.map((review) => (
        <div key={review.id} className={`review ${review.deletedByAdmin ? "review-deleted" : ""}`}>
          <div className="between">
            <strong className="small">{review.author} → {review.carName} ({review.carCode})</strong>
            <span className="muted small">{formatDate(review.createdAt)}</span>
          </div>
          {review.deletedByAdmin ? (
            <p className="small policy-note">
              <strong>Удалён администратором за нарушение политики</strong> {review.deletedAt ? `(${formatDate(review.deletedAt)})` : ""}.
              Текст отзыва скрыт от покупателей.
            </p>
          ) : editing === review.id ? (
            <>
              <select className="input" value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{stars(n)} ({n})</option>)}
              </select>
              <textarea className="input mt" rows={2} value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} />
              <div className="toolbar mt">
                <button className="btn btn-sm btn-primary" onClick={() => save(review)}>Сохранить</button>
                <button className="btn btn-sm" onClick={() => { setEditing(null); setError(""); }}>Отмена</button>
              </div>
            </>
          ) : (
            <>
              <div className="stars">{stars(review.rating)}</div>
              <p className="small">{review.comment}</p>
              <div className="actions-cell">
                {deletingId === review.id ? (
                  <>
                    <span className="small">Удалить отзыв как нарушение политики? Покупатели увидят пометку об удалении.</span>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(review)}>Да, удалить</button>
                    <button className="btn btn-sm" onClick={() => setDeletingId(null)}>Нет</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-sm" onClick={() => { setEditing(review.id); setDraft({ rating: review.rating, comment: review.comment }); }}>Изменить</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setDeletingId(review.id)}>Удалить</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default AdminReviews;
