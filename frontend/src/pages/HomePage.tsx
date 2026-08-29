import { useNavigate } from "react-router-dom";
import { GlobeCdn } from "@/components/ui/cobe-globe-cdn";
import RealismButton from "@/components/ui/shiny-borders-button";
import { CursorDrivenParticleTypography } from "@/components/ui/cursor-driven-particles-typography";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  function handleViewCodes() {
    navigate(user ? "/qrs" : "/login");
  }

  function handleNewQr() {
    navigate(user ? "/generate" : "/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <PageHeader showAuth />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-5 pb-6 pt-1 text-center">
        <div className="h-[118px] w-full sm:h-[176px]">
          <CursorDrivenParticleTypography
            text={user ? `Hey ${user.username || user.email.split("@")[0]}!!` : "Hey Aaquib!!"}
            fontSize={120}
            particleDensity={5}
            dispersionStrength={18}
            color="#ffffff"
          />
        </div>
        <p className="-mt-2 text-[15px] text-neutral-400">Ready to collect some reviews?</p>

        <div className="my-6 w-full max-w-sm sm:my-8 sm:max-w-md">
          <GlobeCdn />
        </div>

        <div className="flex w-full flex-row flex-wrap items-center justify-center gap-3 sm:gap-5">
          <RealismButton text="New QR code" onClick={handleNewQr} />
          <RealismButton text="View QR codes" onClick={handleViewCodes} />
        </div>
      </main>

      <footer className="mt-auto px-5 pb-8 pt-4 text-center text-xs text-neutral-500">
        Every scan goes straight to Google Reviews.
      </footer>
    </div>
  );
}
