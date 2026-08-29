import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import RealismButton from "@/components/ui/shiny-borders-button";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const inputCls =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[15px] text-white placeholder:text-neutral-500 outline-none transition focus:border-violet-500/70 focus:bg-white/[0.06]";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const justVerified = searchParams.get("verified") === "1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 403 && /not verified/i.test(err.message)) {
        navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`, { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <header className="mx-auto flex w-full max-w-3xl items-center px-5 pt-4">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <img src="/logo-symbol.svg" alt="Logo" className="h-8 w-8" />
          <span className="font-['Michroma'] font-bold text-[17px] tracking-wide">
            <span className="text-violet-400">TΛP</span>
            <span className="text-white">2RΛTE</span>
          </span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 pb-16">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-[14.5px] text-neutral-400">Sign in to manage your QR codes.</p>

        {justVerified && (
          <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[13.5px] text-emerald-300">
            Email verified. You can sign in now.
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13.5px] text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-wider text-neutral-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-wider text-neutral-400">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputCls} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-center pt-3">
            <RealismButton type="submit" text={loading ? "Signing in…" : "Sign in"} disabled={loading} />
          </div>
        </form>
      </main>
    </div>
  );
}
