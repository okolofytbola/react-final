import { useEffect, useRef, useState } from "react";
import * as api from "./api";

function StatusBanner() {
  const [problem, setProblem] = useState(null);
  const wasDown = useRef(false);

  useEffect(() => {
    let stopped = false;

    async function check() {
      try {
        await api.checkHealth();
        if (stopped) return;
        setProblem(null);
        if (wasDown.current) {
          wasDown.current = false;
          window.dispatchEvent(new Event("server-recovered"));
        }
      } catch (err) {
        if (stopped) return;
        wasDown.current = true;
        const offline = err.kind === "network";
        setProblem({
          title: offline ? "Сайт закрыт на технические работы" : "Технические работы с базой данных",
          message: offline
            ? "Сервер магазина временно недоступен, поэтому каталог, корзина и заказы сейчас не работают. Мы уже чиним — попробуйте зайти через пару минут."
            : "Сервер работает, но база данных временно недоступна. Мы уже чиним — попробуйте зайти через пару минут.",
        });
      }
    }

    check();
    const timer = setInterval(check, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  if (!problem) return null;

  return (
    <div className="maintenance" role="alertdialog" aria-live="assertive">
      <div className="card maintenance-card">
        <h1>Технические работы</h1>
        <p>{problem.title}</p>
        <p className="muted">{problem.message}</p>
      </div>
    </div>
  );
}

export default StatusBanner;
