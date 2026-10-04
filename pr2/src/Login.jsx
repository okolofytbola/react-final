import { useNavigate } from "react-router-dom";
import { useTheme } from "./ThemeContext";

function Login() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const textColor = theme === "light" ? "#000000" : "#ffffff";
  const btnStyle = {
    backgroundColor: theme === "light" ? "#eeeeee" : "#444444",
    color: textColor,
  };

  function handleLogin() {
    navigate("/dashboard");
  }

  return (
    <div style={{ padding: "10px" }}>
      <h1 style={{ color: textColor }}>Вход</h1>
      <button onClick={handleLogin} style={btnStyle}>Войти</button>
    </div>
  );
}

export default Login;