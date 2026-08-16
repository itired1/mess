export interface PasswordRule {
  label: string;
  ok: boolean;
}

export interface CheckPassword {
  ok: boolean;
  score: number;
  rules: PasswordRule[];
}

export function checkPassword(password: string): CheckPassword {
  const rules: PasswordRule[] = [
    { label: "минимум 6 символов", ok: password.length >= 6 },
    { label: "буквы и цифры", ok: /[a-zа-яё]/i.test(password) && /\d/.test(password) },
    { label: "есть заглавная буква", ok: /[A-ZА-ЯЁ]/.test(password) },
    { label: "спецсимвол или 12+", ok: /[^a-z0-9а-яё]/i.test(password) || password.length >= 12 },
  ];
  const score = rules.filter((r) => r.ok).length;
  return { ok: rules[0].ok && rules[1].ok, score, rules };
}

export const STRENGTH_LABELS = ["", "Очень слабый", "Слабый", "Неплохо", "Крепкий"];

export function strengthColor(score: number): string {
  if (score <= 1) return "#e5484d";
  if (score === 2) return "#ff9f43";
  if (score === 3) return "#46c98a";
  return "#2ad1c0";
}