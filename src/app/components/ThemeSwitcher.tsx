import { Sun, Moon, BookOpen } from "lucide-react";
import { useTheme, type Theme } from "../ThemeContext";

const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "default", label: "Default", icon: <Sun size={11} /> },
  { value: "dark",    label: "Dark",    icon: <Moon size={11} /> },
  { value: "study",   label: "Study",   icon: <BookOpen size={11} /> },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-switcher">
      {THEMES.map((t) => (
        <button
          key={t.value}
          onClick={() => setTheme(t.value)}
          className={`theme-btn ${theme === t.value ? "active" : ""}`}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
