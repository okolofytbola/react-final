import { NavLink, Outlet, Link } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";

function AdminLayout() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="admin-title">{user.role === "admin" ? "Админ-панель" : "Панель сотрудника"}</div>
        <div className="muted small admin-user">{user.fullName}</div>
        <nav className="admin-nav">
          <NavLink to="/admin/categories">Категории</NavLink>
          {user.role === "admin" && <NavLink to="/admin/coupons">Купоны</NavLink>}
          <NavLink to="/admin/cars">Товары и скидки</NavLink>
          <NavLink to="/admin/orders">Заказы</NavLink>
          <NavLink to="/admin/reviews">Отзывы</NavLink>
          {user.role === "admin" && <NavLink to="/admin/users">Пользователи</NavLink>}
        </nav>
        <div className="admin-bottom">
          <Link className="btn btn-sm btn-block" to="/">Открыть каталог</Link>
          <button className="btn btn-sm btn-block" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "Тёмная тема" : "Светлая тема"}
          </button>
          <button className="btn btn-sm btn-danger btn-block" onClick={logout}>Выйти</button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
