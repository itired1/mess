import { CSSProperties, useEffect, useRef, useState } from "react";

export type LoaderMode = "full" | "calm" | "off";

const DUR = 2300;
const CHIPS = ["💛", "🎧", "⭐", "💬", "📨"];

interface LoaderProps {
  ready: boolean;
  onDone: () => void;
  mode: LoaderMode;
}

const BUBBLES = [
  { id: 0, own: false, text: "привет! 👋" },
  { id: 1, own: false, text: "как настроение? 🌈" },
  { id: 2, own: true, text: "погнали ✨" },
];

export default function Loader({ ready, onDone, mode }: LoaderProps) {
  const [step, setStep] = useState(0);
  const stars = useRef(
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: 10 + Math.random() * 80,
      top: 8 + Math.random() * 84,
      delay: (Math.random() * 3).toFixed(2),
      dur: (4 + Math.random() * 4).toFixed(2),
    }))
  ).current;

  const doneRef = useRef(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const fillRef = useRef<HTMLSpanElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (modeRef.current === "off") {
      finishSoon();
      return;
    }

    const stepsTotal = BUBBLES.length;
    let cur = 0;
    if (modeRef.current === "full") {
      const si = setInterval(() => {
        cur = Math.min(cur + 1, stepsTotal);
        setStep(cur);
        if (cur >= stepsTotal) clearInterval(si);
      }, 620);
      siRef.current = si;
    } else {
      setStep(stepsTotal);
    }

    const t0 = performance.now();
    let raf = 0;
    const stepFn = (now: number) => {
      let p = Math.min(1, (now - t0) / DUR);
      if (p >= 1 && !readyRef.current) p = 0.97;
      const pct = Math.round(p * 100);
      if (fillRef.current) fillRef.current.style.width = `${pct}%`;
      if (pctRef.current) pctRef.current.textContent = `${pct}%`;
      if (p < 1) raf = requestAnimationFrame(stepFn);
      else finish();
    };
    raf = requestAnimationFrame(stepFn);

    const hard = setTimeout(finish, DUR + 6000);
    const el = document.getElementById("loader");
    el?.addEventListener("click", finish, { once: true });

    return () => {
      if (siRef.current) clearInterval(siRef.current);
      cancelAnimationFrame(raf);
      clearTimeout(hard);
      el?.removeEventListener("click", finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const siRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function finishSoon() {
    setTimeout(() => {
      fillRef.current && (fillRef.current.style.width = "100%");
      pctRef.current && (pctRef.current.textContent = "100%");
      const el = document.getElementById("loader");
      el?.classList.add("done");
      setTimeout(() => onDoneRef.current(), 600);
    }, 500);
  }

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    if (siRef.current) clearInterval(siRef.current);
    fillRef.current && (fillRef.current.style.width = "100%");
    pctRef.current && (pctRef.current.textContent = "100%");
    const el = document.getElementById("loader");
    el?.classList.add("done");
    setTimeout(() => onDoneRef.current(), 700);
  }

  const showOwnBubbles = step >= 2;
  const typingLive = mode !== "calm";

  return (
    <div id="loader" className={`ld mode-${mode}`} role="status" aria-label="Загрузка lilbrumessage">
      <div className="ld-bg" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>

      {mode === "full" && (
        <div className="ld-stars" aria-hidden="true">
          {stars.map((s) => (
            <i
              key={s.id}
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.dur}s`,
              }}
            />
          ))}
        </div>
      )}

      {mode === "full" && (
        <div className="ld-chips" aria-hidden="true">
          {CHIPS.map((c, i) => (
            <span key={c} style={{ "--i": i } as CSSProperties}>
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="ld-card glass">
        <div className="ld-head">
          <div className="ld-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span className="ld-alpha">
            {mode === "full" && <i className="ld-shimmer" />}
            lilbrumessage
          </span>
          <span className="ld-lock" aria-hidden="true">🔒</span>
        </div>

        <div className="ld-body">
          {BUBBLES.filter((b) => step >= b.id + 1).map((b) => (
            <div key={b.id} className={`ld-bubble ${b.own ? "own" : ""}`}>
              <span className="ld-bubble-text">{b.text}</span>
            </div>
          ))}

          {typingLive && !showOwnBubbles && (
            <div className="ld-bubble">
              <span className="ld-typing live" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
          )}
        </div>

        <div className="ld-progress">
          <div className="ld-bar">
            <span ref={fillRef} />
          </div>
          <span className="ld-percent" ref={pctRef}>0%</span>
        </div>
      </div>

      <div className="ld-brand">
        <span className="ld-title">lilbrumessage</span>
        <span className="ld-tag">твой уютный мессенджер</span>
      </div>

      <div className="ld-skip" aria-hidden="true">нажми, чтобы пропустить</div>
    </div>
  );
}