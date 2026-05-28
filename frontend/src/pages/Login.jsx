import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { MobileShell, GlassHeader, PrimaryButton, Input, Label } from "../components/MobileShell";
import PermissionNotice, { PrivacyFooter } from "../components/PermissionNotice";
import { api } from "../lib/store";
import { getSession, setSession } from "../lib/auth";
import { toast, Toaster } from "sonner";

export default function Login({ role = "user" }) {
  const nav = useNavigate();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // If already logged in for this role, skip the form.
  useEffect(() => {
    const s = getSession();
    if (!s) return;
    if (role === "provider" && s.role === "provider") nav("/provider", { replace: true });
    else if (role === "user" && s.role === "user") nav("/app", { replace: true });
  }, [nav, role]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (role === "provider") {
        const { token, provider } = await api.loginProvider({ mobile, password });
        setSession({ role: "provider", id: provider.id, token });
        nav("/provider");
      } else {
        const { token, user } = await api.loginUser({ mobile, password });
        setSession({ role: "user", id: user.id, token });
        nav("/app");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileShell>
      <Toaster theme="dark" position="top-center" />
      <PermissionNotice />
      <GlassHeader
        title={role === "provider" ? "Provider Login" : "Welcome back"}
        left={
          <button data-testid="login-back" onClick={() => nav("/")} className="mr-1 -ml-2 p-2 rounded-lg hover:bg-white/5">
            <ChevronLeft className="w-5 h-5" />
          </button>
        }
      />
      <form onSubmit={submit} className="px-6 pt-8 pb-10 space-y-5 fade-up">
        <div>
          <p className="font-heading text-3xl font-bold tracking-tight">Sign in</p>
          <p className="text-[#94A3B8] text-sm mt-1">
            {role === "provider" ? "Access your dashboard and earnings." : "Find the right expert in seconds."}
          </p>
        </div>

        <div>
          <Label>Mobile number</Label>
          <Input data-testid="login-mobile" inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="10-digit mobile" />
        </div>
        <div>
          <Label>Password</Label>
          <Input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
        </div>

        <PrimaryButton data-testid="login-submit" disabled={busy || !mobile || !password}>{busy ? "Signing in..." : "Continue"}</PrimaryButton>

        {role !== "provider" && (
          <p className="text-center text-sm text-[#94A3B8]">
            New here?{" "}
            <button type="button" data-testid="login-go-register" onClick={() => nav("/register")} className="text-[#9333EA] font-medium">Create an account</button>
          </p>
        )}
        <PrivacyFooter />
      </form>
    </MobileShell>
  );
}
