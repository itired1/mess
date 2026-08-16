import { useRef, useState } from "react";
import { updateProfile } from "../api";
import { User } from "../types";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_FILE = 6 * 1024 * 1024;

type Change = { type: "set"; data: string } | { type: "remove" } | null;

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onUpdated: (u: User) => void;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Не удалось прочитать файл"));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Файл не похож на картинку"));
    img.src = src;
  });
}

async function resized(src: string, maxSide: number, square: boolean): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Рисование недоступно");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (square) {
    const s = Math.min(img.width, img.height);
    canvas.width = maxSide;
    canvas.height = maxSide;
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, maxSide, maxSide);
  } else {
    const ratio = Math.min(1, maxSide / img.width);
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL("image/jpeg", 0.88);
}

async function processAvatar(file: File): Promise<string> {
  if (file.size > MAX_FILE) throw new Error("Слишком большой файл (до 6 МБ)");
  return resized(await readFile(file), 256, true);
}

async function processBanner(file: File): Promise<string> {
  if (file.size > MAX_FILE) throw new Error("Слишком большой файл (до 6 МБ)");
  const raw = await readFile(file);
  if (file.type === "image/gif") return raw;
  return resized(raw, 1024, false);
}

export default function ProfileModal({ user, onClose, onUpdated }: ProfileModalProps) {
  const [avatarChange, setAvatarChange] = useState<Change>(null);
  const [bannerChange, setBannerChange] = useState<Change>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const bannerSrc = bannerChange?.type === "set" ? bannerChange.data : bannerChange?.type === "remove" ? null : user.banner ?? null;
  const avatarSrc = avatarChange?.type === "set" ? avatarChange.data : avatarChange?.type === "remove" ? null : user.avatar ?? null;

  const pick = async (kind: "avatar" | "banner", file: File | null | undefined) => {
    if (!file) return;
    setError("");
    try {
      const data = kind === "avatar" ? await processAvatar(file) : await processBanner(file);
      if (kind === "avatar") setAvatarChange({ type: "set", data });
      else setBannerChange({ type: "set", data });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось обработать файл");
    }
  };

  const remove = (kind: "avatar" | "banner") => {
    setError("");
    if (kind === "avatar") setAvatarChange({ type: "remove" });
    else setBannerChange({ type: "remove" });
  };

  const save = async () => {
    const payload: Record<string, string> = {};
    if (avatarChange?.type === "set") payload.avatar = avatarChange.data;
    if (avatarChange?.type === "remove") payload.avatar = "";
    if (bannerChange?.type === "set") payload.banner = bannerChange.data;
    if (bannerChange?.type === "remove") payload.banner = "";

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = await updateProfile(payload);
      onUpdated(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
      setBusy(false);
    }
  };

  const changed = avatarChange !== null || bannerChange !== null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-banner" style={{ background: user.gradient }}>
          {bannerSrc && <img src={bannerSrc} alt="баннер" draggable={false} />}
          {bannerChange?.type === "set" && <span className="profile-pending">новый баннер</span>}
        </div>

        <div className="profile-avatar">
          {avatarSrc ? (
            <img src={avatarSrc} alt={user.name} draggable={false} />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
          {avatarChange?.type === "set" && <span className="profile-pending-dot">+</span>}
        </div>

        <div className="profile-body">
          <div className="profile-name">{user.name}</div>
          <div className="profile-sub">твой профиль в lilbrumessage</div>

          {error && <div className="auth-error">{error}</div>}

          <div className="profile-controls">
            <button className="btn ghost" onClick={() => avatarInput.current?.click()} disabled={busy}>
              Сменить аватар
            </button>
            <button className="btn ghost" onClick={() => bannerInput.current?.click()} disabled={busy}>
              Сменить баннер
            </button>
            {(avatarSrc || bannerSrc) && (
              <button className="btn ghost danger" onClick={() => remove(avatarSrc ? "avatar" : "banner")} disabled={busy}>
                Убрать {(avatarSrc ? "аватар" : "баннер")}
              </button>
            )}
          </div>

          <p className="profile-hint">PNG, JPG, WebP или GIF (анимированный) — до 6 МБ. Аватар 256×256, баннер до 1024px шириной.</p>

          <div className="modal-actions">
            <button className="btn ghost" onClick={onClose} disabled={busy}>
              Отмена
            </button>
            <button className="btn primary" onClick={save} disabled={busy || !changed}>
              {busy ? "Сохраняем…" : "Сохранить"}
            </button>
          </div>
        </div>

        <input
          ref={avatarInput}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => { void pick("avatar", e.target.files?.[0]); e.target.value = ""; }}
        />
        <input
          ref={bannerInput}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => { void pick("banner", e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>
    </div>
  );
}