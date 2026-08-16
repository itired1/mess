interface AvatarProps {
  gradient: string;
  name: string;
  online?: boolean;
  size?: number;
}

export default function Avatar({ gradient, name, online, size = 48 }: AvatarProps) {
  return (
    <span className="avatar" style={{ background: gradient, width: size, height: size, fontSize: size * 0.38 }}>
      {name.trim().charAt(0).toUpperCase()}
      {online !== undefined && (
        <i className={`status-dot ${online ? "on" : ""}`} title={online ? "в сети" : "не в сети"} />
      )}
    </span>
  );
}