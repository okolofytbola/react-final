import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { formatDate, stars, reviewError, isStaff } from "./utils";
import * as api from "./api";

const LIMIT_HINT = "На один товар можно оставить только один отзыв — свой отзыв можно изменить или удалить.";

function Reviews({ carId, onChanged }) {
  const { user } = useAuth();
  const token = user ? user.token : null;
  const staff = isStaff(user);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getCarReviews(token, carId)
      .then((list) => {
        setReviews(list);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, carId]);

  useEffect(() => {
    load();
  }, [load]);

  const myReview = reviews.find((r) => r.isMine && !r.deletedByAdmin);
  const canWrite = Boolean(user) && !staff && !myReview;

  function resetForm() {
    setComment("");
    setRating(5);
    setEditingId(null);
    setFormError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    const problem = reviewError(comment);
    if (problem) {
      setFormError(problem);
      return;
    }
    setSending(true);
    try {
      if (editingId) await api.updateReview(token, editingId, { rating, comment });
      else await api.addReview(token, carId, { rating, comment });
      resetForm();
      load();
      if (onChanged) onChanged();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(review) {
    setError("");
    try {
      await api.deleteReview(token, review.id);
      setConfirmDelete(null);
      if (editingId === review.id) resetForm();
      load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="reviews">
      <h4>Отзывы</h4>
      {loading && <p className="muted small">Загрузка отзывов...</p>}
      {error && <p className="error small">{error}</p>}
      {!loading && !error && reviews.length === 0 && <p className="muted small">Отзывов пока нет. Будьте первым!</p>}
      {reviews.map((review) => (
        <div key={review.id} className={`review ${review.deletedByAdmin ? "review-deleted" : ""}`}>
          <div className="between">
            <strong className="small">{review.author}</strong>
            <span className="muted small">{formatDate(review.createdAt)}</span>
          </div>
          {review.deletedByAdmin ? (
            <p className="small policy-note">
              <strong>Отзыв удалён администратором за нарушение политики.</strong> Текст отзыва скрыт.
            </p>
          ) : (
            <>
              <div className="stars" aria-label={`Оценка ${review.rating} из 5`}>{stars(review.rating)}</div>
              <p className="small">{review.comment}</p>
            </>
          )}
          {review.canDelete && !review.deletedByAdmin && (
            <div className="actions-cell">
              {confirmDelete === review.id ? (
                <>
                  <span className="small">
                    {staff ? "Удалить отзыв с пометкой о нарушении политики?" : "Удалить свой отзыв?"}
                  </span>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(review)}>Да</button>
                  <button className="btn btn-sm" onClick={() => setConfirmDelete(null)}>Нет</button>
                </>
              ) : (
                <>
                  {review.canEdit && (
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setEditingId(review.id);
                        setRating(review.rating);
                        setComment(review.comment);
                      }}
                    >
                      Изменить
                    </button>
                  )}
                  <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(review.id)}>Удалить</button>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {!user && <p className="muted small">Чтобы оставить отзыв, войдите в аккаунт.</p>}
      {user && staff && <p className="muted small">Отзывы оставляют только покупатели.</p>}
      {user && !staff && myReview && editingId !== myReview.id && (
        <p className="muted small">{LIMIT_HINT}</p>
      )}

      {canWrite || (editingId && myReview && editingId === myReview.id) ? (
        <form className="review-form" onSubmit={handleSubmit} noValidate>
          <h5 className="mt">{editingId ? "Изменение отзыва" : "Оставить отзыв"}</h5>
          <label className="field">
            <span>Ваша оценка</span>
            <select className="input" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{stars(n)} ({n})</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Комментарий</span>
            <textarea
              className="input"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Что вы думаете об этом автомобиле?"
            />
            <small className="muted">Пустые отзывы и нецензурная лексика не принимаются — такой отзыв не отправится.</small>
          </label>
          {formError && <p className="error small">{formError}</p>}
          <div className="toolbar">
            <button className="btn btn-primary" disabled={sending}>
              {sending ? "Отправляем..." : editingId ? "Сохранить отзыв" : "Оставить отзыв"}
            </button>
            {editingId && (
              <button type="button" className="btn" onClick={resetForm}>Отмена</button>
            )}
          </div>
        </form>
      ) : null}
    </div>
  );
}

export default Reviews;
