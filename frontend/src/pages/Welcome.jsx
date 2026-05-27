import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Video, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { MobileShell, PrimaryButton, SecondaryButton } from "../components/MobileShell";
import { getSession } from "../lib/auth";

export default function Welcome() {
  const nav = useNavigate();

  // Auto-redirect logged-in users to their dashboard.
  useEffect(() => {
    const s = getSession();
    if (!s) return;
    if (s.role === "user") nav("/app", { replace: true });
    else if (s.role === "provider") nav("/provider", { replace: true });
    else if (s.role === "admin") nav("/admin", { replace: true });
  }, [nav]);

  return (
    <MobileShell>
      <div className="grain relative min-h-screen flex flex-col px-6 pt-14 pb-10">
        <div className="absolute -top-32 -right-24 w-72 h-72 rounded-full bg-[#9333EA]/20 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-[#A855F7]/10 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-2 fade-up">
          <div className="w-9 h-9 rounded-xl bg-[#9333EA] flex items-center justify-center">
            <Video className="w-5 h-5 text-black" />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight">Bongo Bandhu</span>
        </div>

        <div className="relative z-10 mt-16 fade-up delay-1">
          <p className="text-xs tracking-[0.2em] uppercase text-[#9333EA] font-medium mb-4">Premium · Verified · Private</p>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
            Video Chat<br />
            <span className="text-[#9333EA]">Full Of Joy.</span>
          </h1>
          <p className="text-[#94A3B8] mt-5 text-base leading-relaxed max-w-sm">
            Connect over video with your favourite people, anytime.
          </p>
        </div>

        <div className="relative z-10 mt-10 space-y-3 fade-up delay-2">
          {[
            { icon: ShieldCheck, t: "Verified providers", s: "ID-checked, rated experts." },
            { icon: Video, t: "Crystal-clear video", s: "Encrypted peer-to-peer calls." },
            { icon: Sparkles, t: "Fixed-time plans", s: "5 / 10 / 15 minute packs. No surprises." },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="w-9 h-9 rounded-lg bg-[#9333EA]/10 flex items-center justify-center shrink-0">
                <f.icon className="w-4 h-4 text-[#9333EA]" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{f.t}</div>
                <div className="text-xs text-[#94A3B8]">{f.s}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 mt-auto pt-10 space-y-3 fade-up delay-3">
          <PrimaryButton data-testid="welcome-get-started" onClick={() => nav("/register")}>
            Get Started <ArrowRight className="w-4 h-4" />
          </PrimaryButton>
          <SecondaryButton data-testid="welcome-login" onClick={() => nav("/login")}>I have an account</SecondaryButton>
        </div>
      </div>
    </MobileShell>
  );
}
