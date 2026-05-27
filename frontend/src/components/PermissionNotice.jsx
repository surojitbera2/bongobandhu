import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PrimaryButton } from "./MobileShell";

export default function PermissionNotice() {
  // Always show on every visit to login/register — no persistence.
  const [show, setShow] = useState(true);

  const accept = () => setShow(false);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[120] backdrop-blur-2xl bg-black/80 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#151923] rounded-3xl border border-white/10 p-6 fade-up shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#9333EA]/15 border border-[#9333EA]/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#9333EA]" />
          </div>
          <h3 className="font-heading text-xl font-bold tracking-tight">Permission Notice</h3>
        </div>
        <p className="text-sm text-[#94A3B8] leading-relaxed mt-4">
          We collect your phone number to verify your identity and enable secure login. Your data is never shared without your consent.
        </p>
        <a
          href="https://doc.navyasocial.in/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-[#9333EA] hover:underline"
        >
          Read our Privacy Policy →
        </a>
        <div className="mt-6">
          <PrimaryButton data-testid="accept-terms" onClick={accept}>Accept & Continue</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export const PrivacyFooter = () => (
  <div className="text-center pt-4">
    <a
      href="https://doc.navyasocial.in/privacy-policy"
      target="_blank"
      rel="noopener noreferrer"
      data-testid="privacy-policy-link"
      className="text-xs text-[#94A3B8] hover:text-[#9333EA] hover:underline"
    >
      Privacy Policy
    </a>
  </div>
);
