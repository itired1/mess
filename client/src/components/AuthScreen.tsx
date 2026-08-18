import { FormEvent, useEffect, useState } from "react";
import { checkName, login, register } from "../api";
import { checkPassword, STRENGTH_LABELS, strengthColor } from "../lib/password";
import { User } from "../types";

interface AuthScreenProps {
  onAuthed: (user: User) => void;
}

type NameState = { status: "idle" | "checking" | "ok" | "taken" | "too_long"; note?: string };

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function AuthScreen({ onAuthed }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" || localStorage.getItem("theme") === "dark" ? "dark" : "light"
  );

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  };

  const debouncedName = useDebounce(name.trim(), 380);
  const [nameState, setNameState] = useState<NameState>({ status: "idle" });

  useEffect(() => {
    if (mode !== "register") {
      setNameState({ status: "idle" });
      return;
    }
    if (!debouncedName) {
      setNameState({ status: "idle" });
      return;
    }
    let alive = true;
    setNameState({ status: "checking" });
    checkName(debouncedName)
      .then((r) => {
        if (!alive) return;
        if (r.reason === "too_long") setNameState({ status: "too_long" });
        else if (r.available) setNameState({ status: "ok" });
        else setNameState({ status: "taken" });
      })
      .catch(() => alive && setNameState({ status: "idle" }));
    return () => {
      alive = false;
    };
  }, [debouncedName, mode]);

  const pw = checkPassword(password);
  const canSubmit =
    name.trim().length > 0 &&
    (mode === "login" || (nameState.status === "ok" && typeof password === "string" && pw.ok)) &&
    !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!name.trim() || password.length === 0) {
      setError("Заполни имя и пароль");
      return;
    }
    if (mode === "register") {
      if (nameState.status !== "ok") {
        setError(nameState.status === "taken" ? "Этот ник уже занят" : "Сначала подтверди, что ник свободен");
        return;
      }
      if (!pw.ok) {
        setError("Пароль слишком простой — следуй подсказкам ниже");
        return;
      }
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

  const nameHint =
    nameState.status === "ok"
      ? { cls: "ok", txt: "свободен — можно брать ✓" }
      : nameState.status === "taken"
        ? { cls: "taken", txt: "уже занят ✗" }
        : nameState.status === "too_long"
          ? { cls: "taken", txt: "слишком длинное (до 24 символов)" }
          : nameState.status === "checking"
            ? { cls: "checking", txt: "проверяем…" }
            : null;

  return (
    <div className="auth-screen">
      <div className="bg-aurora">
        <span className="aurora a1" />
        <span className="aurora a2" />
        <span className="aurora a3" />
      </div>

      <button className="auth-theme-btn" onClick={toggleTheme} title={theme === "dark" ? "Светлая тема" : "Тёмная тема"} aria-label="Переключить тему">
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <div className="auth-card glass">
        <div className="auth-brand">
          <span className="auth-logo">💌</span>
          <div>
            <div className="auth-title">lilbru<em>message</em></div>
            <div className="auth-sub">твой уютный мессенджер</div>
          </div>
        </div>

        <div className="auth-tabs">
          <span className={`pill ${mode === "register" ? "right" : ""}`} aria-hidden="true" />
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

        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-field">
            <input
              autoFocus
              type="text"
              value={name}
              placeholder={mode === "register" ? "Твой ник (уникальный)" : "Имя"}
              autoComplete="username"
              maxLength={24}
              className={mode === "register" && (nameState.status === "taken" || nameState.status === "too_long") ? "err" : ""}
              onChange={(e) => setName(e.target.value)}
            />
            {mode === "register" && nameHint && (
              <span className={`name-status ${nameHint.cls}`}>{nameHint.txt}</span>
            )}
          </div>

          <div className="auth-field password">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              placeholder="Пароль"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="eye"
              onClick={() => setShowPass((v) => !v)}
              title={showPass ? "Скрыть пароль" : "Показать пароль"}
              aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPass ? "🙈" : "👁"}
            </button>
          </div>

          {mode === "register" && password && (
            <>
              <div className="pw-meter" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <i key={i} className={i < pw.score ? "on" : ""}
                    style={i < pw.score ? { background: strengthColor(pw.score) } : undefined} />
                ))}
              </div>
              <div className="pw-label" style={{ color: pw.ok ? strengthColor(pw.score) : "var(--text-2)" }}>
                {STRENGTH_LABELS[pw.score]}
              </div>
              <div className="pw-rules">
                {pw.rules.map((r) => (
                  <span key={r.label} className={r.ok ? "on" : ""}>
                    {r.ok ? "✓" : "•"} {r.label}
                  </span>
                ))}
              </div>
            </>
          )}

          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" type="submit" disabled={!canSubmit}>
            {busy ? "Подожди..." : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        <div className="auth-note">
          {mode === "login"
            ? "Нет аккаунта? Зарегистрируйся — это займёт пару секунд."
            : "Ник должен быть уникальным, пароль — не «пароль»."}
        </div>
      </div>
    </div>
  );
}