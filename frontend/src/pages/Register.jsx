import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { MobileShell, GlassHeader, PrimaryButton, Input, Label } from "../components/MobileShell";
import PermissionNotice, { PrivacyFooter } from "../components/PermissionNotice";
import { api } from "../lib/store";
import { getSession, setSession } from "../lib/auth";
import { toast, Toaster } from "sonner";

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({ mobile: "", password: "" });
  const [busy, setBusy] = useState(false);

  // If already logged in as a user, skip register and go to app.
  useEffect(() => {
    const s = getSession();
    if (s?.role === "user") nav("/app", { replace: true });
  }, [nav]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token, user } = await api.registerUser(form);
      setSession({ role: "user", id: user.id, token });
      toast.success("Account created — ₹50 welcome bonus added!");
      setTimeout(() => nav("/app"), 600);
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <MobileShell>
      <Toaster theme="dark" position="top-center" />
      <PermissionNotice />
      <GlassHeader
        title="Create account"
        left={
          <button data-testid="register-back" onClick={() => nav("/")} className="mr-1 -ml-2 p-2 rounded-lg hover:bg-white/5">
            <ChevronLeft className="w-5 h-5" />
          </button>
        }
      />
      <form onSubmit={submit} className="px-6 pt-8 pb-10 space-y-5 fade-up">
        <div>
          <p className="font-heading text-3xl font-bold tracking-tight">Join Bongo Bandhu</p>
          <p className="text-[#94A3B8] text-sm mt-1">Get ₹50 free to try your first call.</p>
        </div>
        <div>
          <Label>Mobile number</Label>
          <Input data-testid="register-mobile" inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="10-digit mobile" />
        </div>
        <div>
          <Label>Password</Label>
          <Input data-testid="register-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
        </div>
        <PrimaryButton data-testid="register-submit" disabled={busy || form.mobile.length !== 10 || form.password.length < 6}>
          {busy ? "Creating..." : "Create account"}
        </PrimaryButton>
        <p className="text-center text-sm text-[#94A3B8]">
          Already a member?{" "}
          <button type="button" data-testid="register-go-login" onClick={() => nav("/login")} className="text-[#9333EA] font-medium">Sign in</button>
        </p>
        <PrivacyFooter />
      </form>
    </MobileShell>
  );
}
