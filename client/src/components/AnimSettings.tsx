import { LoaderMode } from "./Loader";

const OPTIONS: { value: LoaderMode; label: string; hint: string }[] = [
  { value: "full", label: "Полные", hint: "все эффекты, пузыри и звёзды" },
  { value: "calm", label: "Лёгкие", hint: "зеркальный минимализм, без украшений" },
  { value: "off", label: "Выключены", hint: "интерфейс без анимаций" },
];

interface AnimSettingsProps {
  mode: LoaderMode;
  onChange: (m: LoaderMode) => void;
  sound: boolean;
  onSoundChange: (v: boolean) => void;
  onClose: () => void;
}

export default function AnimSettings({ mode, onChange, sound, onSoundChange, onClose }: AnimSettingsProps) {
  return (
    <div className="setting-pop" role="dialog" aria-label="Настройки анимаций">
      <div className="setting-pop-head">Анимации загрузки</div>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          className={`setting-opt${mode === o.value ? " active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          <span className="setting-radio">
            {mode === o.value && <i />}
          </span>
          <span className="setting-text">
            <span className="setting-label">{o.label}</span>
            <span className="setting-hint">{o.hint}</span>
          </span>
        </button>
      ))}
      <div className="setting-divider" />
      <button
        className="setting-opt"
        onClick={() => onSoundChange(!sound)}
        role="checkbox"
        aria-checked={sound}
      >
        <span className="setting-radio">
          {sound && <i />}
        </span>
        <span className="setting-text">
          <span className="setting-label">Звук уведомлений</span>
          <span className="setting-hint">короткий сигнал на новое сообщение в другом чате</span>
        </span>
      </button>
      <button className="setting-pop-close" onClick={onClose}>
        Готово
      </button>
    </div>
  );
}