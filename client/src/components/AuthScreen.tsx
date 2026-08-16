import { FormEvent, useState } from "react";
import { login, register } from "../api";
import { User } from "../types";

interface AuthScreenProps {
  onAuthed: (user: User) => void;
}

export default function AuthScreen({ onAuthed }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!name.trim() || password.length === 0) {
      setError("Заполни имя и пароль");
      return;
    }
    setBusy(true);
    try {
      const user =
        mode === "register" ? await register(name, password) : await login(name, password);
      onAuthed(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="bg-aurora">
        <span className="aurora a1" />
        <span className="aurora a2" />
        <span className="aurora a3" />
      </div>

      <div className="auth-card glass">
        <div className="auth-brand">
          <span className="auth-logo">💌</span>
          <div>
            <div className="auth-title">lilbru<em>message</em></div>
            <div className="auth-sub">твой уютный мессенджер</div>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "on" : ""}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Вход
          </button>
          <button
            className={mode === "register" ? "on" : ""}
            onClick={() => { setMode("register"); setError(""); }}
          >
            Регистрация
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <input
            autoFocus
            type="text"
            value={name}
            placeholder="Имя"
            autoComplete="username"
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="password"
            value={password}
            placeholder="Пароль (от 4 символов)"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "Подожди..." : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        <div className="auth-note">
          {mode === "login"
            ? "Нет аккаунта? Зарегистрируйся — это займёт пару секунд."
            : "Имя должно быть уникальным, пароль — минимум 4 символа."}
        </div>
      </div>
    </div>
  );
}