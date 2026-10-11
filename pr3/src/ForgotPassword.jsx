import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EMAIL_RE } from "./utils";
import * as api from "./api";

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [devCode, setDevCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e) {
    if (e) e.preventDefault();
    setError("");
    setNotice("");
    if (!EMAIL_RE.test(email.trim())) {
      setError("Введите корректный email, например name@mail.ru");
      return;
    }
    setBusy(true);
    try {
      const res = await api.requestPasswordCode(email.trim());
      setDevCode(res.devCode || "");
      setNotice(res.message || `Код отправлен на ${email.trim()}`);
      setStep("reset");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Код подтверждения — 6 цифр из письма");
      return;
    }
    if (password.length < 6) {
      setError("Новый пароль не короче 6 символов");
      return;
    }
    if (password !== repeat) {
      setError("Пароли не совпадают");
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(email.trim(), code.trim(), password);
      setStep("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <div className="page narrow">
        <div className="card form">
          <div className="success-mark">✓</div>
          <h1>Пароль изменён</h1>
          <p className="muted center">Теперь войдите в аккаунт с новым паролем.</p>
          <button className="btn btn-primary btn-block" onClick={() => navigate("/login")}>Перейти ко входу</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <form className="card form" onSubmit={step === "email" ? sendCode : resetPassword} noValidate>
        <h1>Забыли пароль?</h1>
        <p className="muted small">
          Укажите email, на который зарегистрирован аккаунт. Мы отправим <strong>письмо с кодом подтверждения</strong> —
          с его помощью можно задать новый пароль. Код создаётся заново при каждом запросе, действует 15 минут и
          нигде на сайте не показывается: его видно только в письме.
        </p>

        <label className="field">
          <span>Email</span>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@mail.ru"
            readOnly={step === "reset"}
          />
        </label>

        {step === "reset" && (
          <>
            {notice && !devCode && (
              <div className="alert alert-success">
                <span>
                  {notice}
                  <br />
                  Введите код из письма ниже.
                </span>
              </div>
            )}
            {devCode && (
              <div className="alert alert-warn">
                <span>
                  <strong>Почта не настроена</strong> — письмо отправить некуда. Код показан на странице
                  только в этом режиме (MAIL_SHOW_CODE_IN_BROWSER=true):
                  <br />
                  Код для сброса пароля: <strong className="dev-code">{devCode}</strong>
                </span>
              </div>
            )}
            <label className="field">
              <span>Код из письма</span>
              <input
                className="input code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
              />
            </label>
            <label className="field">
              <span>Новый пароль</span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="field">
              <span>Повторите новый пароль</span>
              <input className="input" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </label>
            <button type="button" className="link-btn" onClick={sendCode} disabled={busy}>
              Отправить код заново (создастся новый код)
            </button>
          </>
        )}

        {step === "email" && notice && <div className="alert alert-success">{notice}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Отправляем…" : step === "email" ? "Отправить код на почту" : "Сбросить пароль"}
        </button>
        <p className="muted center small">Вспомнили пароль? <Link to="/login">Войти</Link></p>
      </form>
    </div>
  );
}

export default ForgotPassword;
