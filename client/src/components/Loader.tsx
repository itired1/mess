import { useEffect, useRef, useState } from "react";

export type LoaderMode = "full" | "calm" | "off";

export interface LoaderFriend {
  name: string;
  gradient: string;
  avatar?: string;
}

const STATUSES = ["Подключаемся…", "Загружаем сообщения…", "Раскладываем уют…", "Почти готово…"];
const DUR = 3200;
const STATUS_STEP = 1100;

interface LoaderProps {
  ready: boolean;
  onDone: () => void;
  mode: LoaderMode;
  friendAvatars?: LoaderFriend[];
}

export default function Loader({ ready, onDone, mode, friendAvatars }: LoaderProps) {
  const [status, setStatus] = useState(STATUSES[0]);
  const [statusKey, setStatusKey] = useState(0);

  const doneRef = useRef(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const numRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (modeRef.current === "off") {
      finishSoon();
      return;
    }

    const statusInt = setInterval(() => {
      setStatus((cur) => {
        setStatusKey((k) => k + 1);
        return STATUSES[(STATUSES.indexOf(cur) + 1) % STATUSES.length];
      });
    }, STATUS_STEP);

    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      let x = Math.min(1, (now - t0) / DUR);
      let p = 1 - Math.pow(1 - x, 4); // притормаживаем к концу
      const pct = Math.round(p * 100);
      const shown = !readyRef.current && pct >= 100 ? 97 : pct;
      if (numRef.current) numRef.current.textContent = String(shown);
      if (fillRef.current) fillRef.current.style.width = `${shown}%`;
      if (p < 1 || (p >= 1 && !readyRef.current)) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);

    const hard = setTimeout(finish, DUR + 5000);
    const el = document.getElementById("loader");
    el?.addEventListener("click", finish, { once: true });

    return () => {
      clearInterval(statusInt);
      cancelAnimationFrame(raf);
      clearTimeout(hard);
      el?.removeEventListener("click", finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finishSoon() {
    setTimeout(() => {
      if (numRef.current) numRef.current.textContent = "100";
      if (fillRef.current) fillRef.current.style.width = "100%";
      const el = document.getElementById("loader");
      el?.classList.add("done");
      setTimeout(() => onDoneRef.current(), 500);
    }, 400);
  }

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    if (numRef.current) numRef.current.textContent = "100";
    if (fillRef.current) fillRef.current.style.width = "100%";
    const el = document.getElementById("loader");
    el?.classList.add("done");
    setTimeout(() => onDoneRef.current(), 600);
  }

  const ringFriends = (friendAvatars ?? []).slice(0, 10);
  const RING_N = ringFriends.length;
  const ringStep = RING_N > 0 ? 360 / RING_N : 0;

  return (
    <div id="loader" className={`l2 mode-${mode}`} role="status" aria-label="Загрузка lilbrumessage">
      <div className="l2-bg" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
      </div>{RING_N > 0 && mode === "full" && (
        <div className="l2-orbit" aria-hidden="true">
          {ringFriends.map((f, i) => (
            <div
              key={i}
              className="l2-orbit-tile"
              style={{ transform: `rotate(${i * ringStep}deg) translateY(var(--l2r, -150px))` }}
              title={f.name}
            >
              <span className="l2-orbit-fold" style={{ transform: `rotate(${-i * ringStep}deg)` }}>
                <span className="l2-orbit-avatar" style={{ background: f.gradient }}>
                  {f.avatar ? <img src={f.avatar} alt={f.name} draggable={false} /> : f.name.charAt(0)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="l2-box">
        <div className="l2-title">lilbru<em>message</em></div>
        <div className="l2-tag">твой уютный мессенджер</div>

        <div className="l2-num">
          <span ref={numRef}>0</span>%
        </div>

        {mode !== "off" && (
          <div className="l2-bar">
            <span ref={fillRef} />
          </div>
        )}

        {mode === "full" && (
          <div className="l2-msg" key={statusKey}>{status}</div>
        )}
        {mode === "calm" && (
          <div className="l2-msg l2-msg-static">Загружаем…</div>
        )}
      </div>

      <div className="l2-skip" aria-hidden="true">нажми, чтобы пропустить</div>
    </div>
  );
}