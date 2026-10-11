import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";

function AccessDenied({ title = "Доступ запрещён", message, code = "403" }) {
  const { user, logout } = useAuth();

  return (
    <div className="page narrow">
      <div className="card denied">
        <div className="denied-code">{code}</div>
        <h1>{title}</h1>
        <p className="muted">
          {message ||
            (user
              ? `У вашей роли (${user.role === "employee" ? "сотрудник" : "пользователь"}) нет прав на этот раздел.`
              : "Эта страница доступна только администратору магазина. Войдите под учётной записью администратора.")}
        </p>
        <div className="actions center">
          <Link className="btn btn-primary" to="/">Перейти в каталог</Link>
          {!user ? (
            <Link className="btn" to="/login">Войти</Link>
          ) : (
            <button className="btn" onClick={logout}>Выйти из аккаунта</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccessDenied;
