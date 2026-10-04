import { Routes, Route } from "react-router-dom";
import Navbar from "./Navbar";
import Catalog from "./Catalog";
import Cart from "./Cart";
import Login from "./Login";
import Dashboard from "./Dashboard";
import { useTheme } from "./ThemeContext";

function App() {
  const { theme } = useTheme();

  const style = {
    backgroundColor: theme === "light" ? "#ffffff" : "#222222",
    color: theme === "light" ? "#000000" : "#ffffff",
    minHeight: "100vh",
  };

  return (
    <div style={style}>
      <Navbar />
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </div>
  );
}

export default App;