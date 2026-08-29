import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import RealismButton from "@/components/ui/shiny-borders-button";
import { useAuth } from "@/lib/auth";

export function BrandMark() {
  return (
    <img src="/logo-symbol.svg" alt="Logo" className="h-8 w-8" />
  );
}

export default function PageHeader({ showAuth = false }: { showAuth?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await logout();
    setSigningOut(false);
    navigate("/", { replace: true });
  }

  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 pt-4">
      <Link to="/" className="inline-flex items-center gap-2.5">
        <BrandMark />
        <span className="font-['Michroma'] font-bold text-[17px] tracking-wide">
          <span className="text-violet-400">TΛP</span>
          <span className="text-white">2RΛTE</span>
        </span>
      </Link>

      {showAuth &&
        (user ? (
          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] text-neutral-400 sm:inline">{user.email}</span>
            <RealismButton
              text={signingOut ? "…" : "Sign out"}
              onClick={handleSignOut}
              disabled={signingOut}
            />
          </div>
        ) : (
          <RealismButton text="Sign in" onClick={() => navigate("/login")} />
        ))}
    </header>
  );
}
