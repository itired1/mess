interface AvatarProps {
  gradient: string;
  name: string;
  online?: boolean;
  size?: number;
  src?: string | null;
}

export default function Avatar({ gradient, name, online, size = 48, src }: AvatarProps) {
  return (
    <span
      className="avatar"
      style={{ background: gradient, width: size, height: size, fontSize: size * 0.38 }}
    >
      {src ? (
        <img src={src} alt={name} draggable={false} />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
      {online !== undefined && (
        <i className={`status-dot ${online ? "on" : ""}`} title={online ? "в сети" : "не в сети"} />
      )}
    </span>
  );
}