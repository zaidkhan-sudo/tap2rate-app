import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import RealismButton from "@/components/ui/shiny-borders-button";
import { ApiError, apiPost } from "@/lib/api";

const inputCls =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[15px] text-white placeholder:text-neutral-500 outline-none transition focus:border-violet-500/70 focus:bg-white/[0.06]";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      await apiPost("/api/auth/verify-email", { email: email.trim(), otp: otp.trim() });
      navigate(`/login?verified=1&email=${encodeURIComponent(email.trim())}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setOtp("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resending || cooldown > 0) return;

    setError(null);
    setResending(true);

    try {
      await apiPost("/api/auth/resend-otp", { email: email.trim() });
      setNotice("If your account needs verification, a new code is on its way.");
      startCooldown();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.statusCode === 429) startCooldown();
      }
    } finally {
      setResending(false);
    }
  }

  const canVerify = email.includes("@") && /^\d{6}$/.test(otp.trim());

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
        <h1 className="text-3xl font-bold tracking-tight">Verify your email</h1>
        <p className="mt-1.5 text-[14.5px] text-neutral-400">
          Enter the 6-digit code we emailed you.
        </p>

        {notice && (
          <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[13.5px] text-emerald-300">
            {notice}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13.5px] text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="mt-6 space-y-4" noValidate>
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
            <label htmlFor="otp" className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-wider text-neutral-400">
              Verification code
            </label>
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className={`${inputCls} text-center font-mono text-xl tracking-[0.55em] placeholder:tracking-[0.55em]`}
            />
          </div>

          <div className="flex justify-center pt-3">
            <RealismButton
              type="submit"
              text={loading ? "Verifying…" : "Verify"}
              disabled={loading || !canVerify}
            />
          </div>
        </form>

        <p className="mt-6 text-center text-[13.5px] text-neutral-400">
          Didn't get a code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            className="font-medium text-violet-400 hover:text-violet-300 disabled:text-neutral-600 disabled:no-underline"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Resend code"}
          </button>
        </p>

        <p className="mt-2 text-center text-[13px] text-neutral-500">
          The code expires in 10 minutes.
        </p>
      </main>
    </div>
  );
}
