import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router";
import { BackgroundFX } from "./BackgroundFX";
import { ThemeSwitcher } from "./ThemeSwitcher";
import learnBeamLogo from "../../assets/861bd4bcf410ca26cefb8d6a2c416c8933fab508.png";

export function AuthPage() {
  const [mode, setMode]                         = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword]         = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [animating, setAnimating]               = useState(false);
  const [visible, setVisible]                   = useState(false);
  const [formData, setFormData]                 = useState({
    name: "", email: "", password: "", confirmPassword: "",
  });

  const navigate = useNavigate();
  const isLogin = mode === "login";

  // Page entry animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  // Smooth mode switch with fade-through
  const switchMode = (next: "login" | "signup") => {
    if (next === mode || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setMode(next);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setTimeout(() => setAnimating(false), 20);
    }, 180);
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
      style={{ color: "var(--foreground)" }}
    >
      {/* Background is absolutely fixed — never moves */}
      <BackgroundFX brand="Learn" />

      {/* Theme switcher */}
      <div className="fixed right-5 top-5 z-50">
        <ThemeSwitcher />
      </div>

      {/* Content — fades+slides in on load */}
      <div
        className="relative z-10 w-full max-w-[440px]"
        style={{
          transform: visible ? "translateY(0)" : "translateY(22px)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.45s ease",
        }}
      >
        {/* ── LOGO + TITLE ── */}
        <div className="mb-6 flex flex-col items-center" style={{ gap: 0 }}>
          <img
            src={learnBeamLogo}
            alt="LearnBeam"
            style={{
              height: "120px",
              width:  "120px",
              objectFit: "contain",
              filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.22))",
              display: "block",
              marginBottom: "-18px",
            }}
          />
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            LearnBeam
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "6px 0 0" }}>
            Your AI study companion for smarter learning.
          </p>
        </div>

        {/* ── CARD ── */}
        <div
          className="blueprint-card"
          style={{
            borderRadius: "28px",
            padding: "32px 36px 36px",
            background: "rgba(255,255,255,0.22)",
            backdropFilter: "blur(14px) saturate(130%)",
            WebkitBackdropFilter: "blur(14px) saturate(130%)",
          }}
        >
          {/* inner gloss */}
          <div
            className="pointer-events-none absolute left-3 right-3 top-2 rounded-[22px]"
            style={{
              height: "38%",
              background: "linear-gradient(to bottom, rgba(255,255,255,0.13), rgba(255,255,255,0.03) 70%, transparent)",
            }}
          />

          {/* ── TAB SWITCHER ── */}
          <div
            style={{
              position: "relative",
              marginBottom: "28px",
              borderRadius: "16px",
              padding: "4px",
              background: "var(--input)",
              border: "1px solid var(--border)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            {/* sliding pill */}
            <div
              style={{
                position: "absolute",
                top: "4px",
                bottom: "4px",
                width: "calc(50% - 4px)",
                borderRadius: "12px",
                background: "var(--accent)",
                boxShadow: "0 4px 14px var(--accent-glow)",
                transform: isLogin ? "translateX(0)" : "translateX(calc(100% + 8px))",
                transition: "transform 0.32s cubic-bezier(0.34,1.56,0.64,1)",
                left: "4px",
              }}
            />
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                style={{
                  position: "relative",
                  zIndex: 1,
                  padding: "9px 0",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  border: "none",
                  background: "transparent",
                  color: mode === m ? "var(--primary-foreground)" : "var(--text-muted)",
                  cursor: "pointer",
                  borderRadius: "12px",
                  transition: "color 0.25s ease",
                  letterSpacing: "0.01em",
                }}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* ── FORM AREA — smooth fade/slide on mode change ── */}
          <form
            onSubmit={handleSubmit}
            style={{
              opacity: animating ? 0 : 1,
              transform: animating ? "translateY(6px)" : "translateY(0)",
              transition: "opacity 0.18s ease, transform 0.22s ease",
            }}
          >
            {/* Heading */}
            <div style={{ marginBottom: "24px" }}>
              <h2
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 600,
                  letterSpacing: "-0.015em",
                  color: "var(--text-primary)",
                  margin: "0 0 6px",
                }}
              >
                {isLogin ? "Welcome back" : "Create account"}
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                {isLogin ? "Enter your details to sign in" : "Fill in your details to get started"}
              </p>
            </div>

            {/* Full Name — signup only */}
            {!isLogin && (
              <Field label="Full Name">
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInput}
                  type="text"
                  placeholder="Your full name"
                />
              </Field>
            )}

            {/* Email */}
            <Field label="Email Address">
              <Input
                name="email"
                value={formData.email}
                onChange={handleInput}
                type="email"
                placeholder="you@example.com"
              />
            </Field>

            {/* Password */}
            <Field
              label="Password"
              right={
                isLogin ? (
                  <a
                    href="#"
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-muted)",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    Forgot password?
                  </a>
                ) : undefined
              }
            >
              <div style={{ position: "relative" }}>
                <Input
                  name="password"
                  value={formData.password}
                  onChange={handleInput}
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  style={{ paddingRight: "46px" }}
                />
                <EyeBtn show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              </div>
            </Field>

            {/* Confirm Password — signup only */}
            {!isLogin && (
              <Field label="Confirm Password">
                <div style={{ position: "relative" }}>
                  <Input
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInput}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    style={{ paddingRight: "46px" }}
                  />
                  <EyeBtn show={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)} />
                </div>
              </Field>
            )}

            {/* Remember me — login only */}
            {isLogin && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "12px",
                  marginBottom: "4px",
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  style={{ width: "16px", height: "16px", accentColor: "var(--accent)", cursor: "pointer" }}
                />
                Remember me for 30 days
              </label>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="blueprint-button"
              style={{
                marginTop: "20px",
                width: "100%",
                borderRadius: "16px",
                padding: "14px",
                fontSize: "0.9rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {isLogin ? "Sign In" : "Create Account"}
            </button>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                margin: "22px 0",
              }}
            >
              <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                or continue with
              </span>
              <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
            </div>

            {/* Google */}
            <GoogleBtn />

            {/* Switch link */}
            <p
              style={{
                marginTop: "24px",
                textAlign: "center",
                fontSize: "0.85rem",
                color: "var(--text-muted)",
              }}
            >
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => switchMode(isLogin ? "signup" : "login")}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontWeight: 600,
                  color: "var(--accent)",
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                  fontSize: "inherit",
                }}
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Field({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
        <label style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-secondary)" }}>
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  );
}

function Input({
  style,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
      style={{
        width: "100%",
        borderRadius: "14px",
        padding: "12px 16px",
        fontSize: "0.9rem",
        background: "var(--input)",
        border: focused ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
        boxShadow: focused ? "0 0 0 3px var(--accent-soft)" : "none",
        color: "var(--text-primary)",
        outline: "none",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        boxSizing: "border-box",
        ...style,
      }}
    />
  );
}

function EyeBtn({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: "absolute",
        right: "14px",
        top: "50%",
        transform: "translateY(-50%)",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        lineHeight: 1,
        transition: "color 0.15s ease",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")}
    >
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}

function GoogleBtn() {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        borderRadius: "16px",
        padding: "13px",
        fontSize: "0.88rem",
        fontWeight: 500,
        background: hovered ? "var(--accent-soft)" : "var(--input)",
        border: "1.5px solid var(--border)",
        color: "var(--text-secondary)",
        cursor: "pointer",
        transition: "background 0.2s ease, border-color 0.2s ease",
        borderColor: hovered ? "var(--accent)" : "var(--border)",
      }}
    >
      {/* Google G */}
      <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
        <path d="M17.64 9.2c0-.638-.057-1.252-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
        <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </button>
  );
}
