import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router";
import { BackgroundFX } from "./BackgroundFX";
import learnBeamLogo from "../../assets/861bd4bcf410ca26cefb8d6a2c416c8933fab508.png";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const navigate = useNavigate();
  const isLogin = mode === "login";

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <BackgroundFX brand="Teach" />

      <div className="relative z-10 w-full max-w-[470px]">
        <div className="flex flex-col items-center text-center leading-none">

  <img
    src={learnBeamLogo}
    alt="LearnBeam"
    className="h-50 w-50 object-contain drop-shadow-lg mb-[-4px]"
  />

  <h1 className="text-[2.05rem] font-semibold tracking-tight text-white drop-shadow-sm leading-none">
    LearnBeam
  </h1>
          <p className="mt-2 max-w-[340px] text-sm text-white/75">
            Your AI study companion for smarter learning.
          </p>
        </div>

        <div
          className="
            blueprint-card relative overflow-hidden rounded-[30px]
            border border-white/15 bg-white/[0.045]
            px-10 pb-9 pt-9
            shadow-[0_25px_60px_rgba(0,0,0,0.22)]
            backdrop-blur-[32px] supports-[backdrop-filter]:bg-white/[0.045]
          "
        >
          <div className="pointer-events-none absolute left-3 right-3 top-2.5 h-[38%] rounded-[24px] bg-gradient-to-b from-white/20 via-white/6 to-white/0" />
          <div className="pointer-events-none absolute -left-[18%] -top-[30%] h-[180%] w-[46%] rotate-[18deg] bg-gradient-to-r from-white/0 via-white/10 to-white/0" />

          <div className="relative z-10 mb-10 overflow-hidden rounded-2xl border border-white/18 bg-white/6 p-1">
            <div className="grid grid-cols-2 gap-0">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-[12px] py-3 text-base font-semibold transition-all ${
                  isLogin
                    ? "bg-white/95 text-[#0a3d91] shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                    : "text-white/72 hover:bg-white/8"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-[12px] py-3 text-base font-semibold transition-all ${
                  !isLogin
                    ? "bg-white/95 text-[#0a3d91] shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                    : "text-white/72 hover:bg-white/8"
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="relative z-10">
            <div className="mb-8">
              <h2 className="text-[2rem] font-medium text-white">
                {isLogin ? "Welcome back" : "Create account"}
              </h2>
              <p className="mt-2 text-sm text-white/68">
                {isLogin
                  ? "Enter your details to sign in"
                  : "Fill in your details to get started"}
              </p>
            </div>

            {!isLogin && (
              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-white/82">
                  Full Name
                </label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInput}
                  type="text"
                  placeholder="Your full name"
                  className="blueprint-input w-full rounded-2xl border border-white/18 bg-white/8 px-4 py-4 text-base text-white placeholder-white/50 outline-none backdrop-blur-md transition focus:border-white/40 focus:bg-white/12"
                />
              </div>
            )}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-white/82">
                Email Address
              </label>
              <input
                name="email"
                value={formData.email}
                onChange={handleInput}
                type="email"
                placeholder="you@example.com"
                className="blueprint-input w-full rounded-2xl border border-white/18 bg-white/8 px-4 py-4 text-base text-white placeholder-white/50 outline-none backdrop-blur-md transition focus:border-white/40 focus:bg-white/12"
              />
            </div>

            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-white/82">
                  Password
                </label>
                {isLogin && (
                  <a
                    href="#"
                    className="text-sm text-white/70 underline decoration-white/30 underline-offset-4 transition hover:text-white"
                  >
                    Forgot password?
                  </a>
                )}
              </div>

              <div className="relative">
                <input
                  name="password"
                  value={formData.password}
                  onChange={handleInput}
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="blueprint-input w-full rounded-2xl border border-white/18 bg-white/8 px-4 py-4 pr-12 text-base text-white placeholder-white/50 outline-none backdrop-blur-md transition focus:border-white/40 focus:bg-white/12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/55 transition hover:text-white/90"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="mb-4 mt-5">
                <label className="mb-2 block text-sm font-medium text-white/82">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInput}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    className="blueprint-input w-full rounded-2xl border border-white/18 bg-white/8 px-4 py-4 pr-12 text-base text-white placeholder-white/50 outline-none backdrop-blur-md transition focus:border-white/40 focus:bg-white/12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/55 transition hover:text-white/90"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {isLogin && (
              <label className="mb-6 mt-5 flex cursor-pointer items-center gap-3 text-sm text-white/74">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded-md border border-white/25 bg-transparent accent-white/90"
                />
                <span>Remember me for 30 days</span>
              </label>
            )}

            <button
              type="submit"
              className="blueprint-button mt-2 w-full rounded-2xl bg-white/95 py-4 text-base font-bold text-[#0a3d91] shadow-[0_12px_24px_rgba(0,0,0,0.16)] transition hover:-translate-y-[1px] hover:bg-white"
            >
              {isLogin ? "Sign In" : "Create Account"}
            </button>

            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/18" />
              <span className="text-sm text-white/62">or continue with</span>
              <div className="h-px flex-1 bg-white/18" />
            </div>

            <button
              type="button"
              className="w-full rounded-2xl border border-white/20 bg-white/7 px-4 py-4 text-base font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md transition hover:bg-white/10"
            >
              Continue with Google
            </button>

            <p className="mt-8 text-center text-sm text-white/72">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setMode(isLogin ? "signup" : "login")}
                className="font-semibold text-white underline decoration-white/35 underline-offset-4 transition hover:text-white"
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