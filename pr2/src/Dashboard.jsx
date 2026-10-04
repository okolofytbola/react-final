import { useTheme } from "./ThemeContext";

function Dashboard() {
  const { theme } = useTheme();
  const textColor = theme === "light" ? "#000000" : "#ffffff";

  return (
    <div style={{ padding: "10px" }}>
      <h1 style={{ color: textColor }}>Личный кабинет</h1>
      <p style={{ color: textColor }}>Вы вошли в систему.</p>
    </div>
  );
}

export default Dashboard;