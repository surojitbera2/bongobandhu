import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Copy, CheckCircle2, QrCode } from "lucide-react";
import { MobileShell, GlassHeader, PrimaryButton, SecondaryButton, Input, Label } from "../components/MobileShell";
import { api } from "../lib/store";
import { getSession } from "../lib/auth";
import { inr } from "../lib/format";
import { toast, Toaster } from "sonner";

const presets = [300, 400, 500, 1000];

export default function Recharge() {
  const nav = useNavigate();
  const [amount, setAmount] = useState(300);
  const [step, setStep] = useState(1); // 1: Amount, 2: Payment, 3: Success
  const [upiSettings, setUpiSettings] = useState({ upiId: "", upiName: "Bongo Bandhu", qrCodeUrl: "" });
  const [transactionId, setTransactionId] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState(null);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "user") { nav("/login"); return; }
    (async () => {
      try {
        const [upi, u] = await Promise.all([api.getUpiSettings(), api.getMe()]);
        setUpiSettings(upi);
        setMe(u);
      } catch {}
    })();
    // eslint-disable-next-line
  }, []);

  const proceedToPayment = async () => {
    if (amount < 10) {
      toast.error("Minimum recharge amount is ₹10");
      return;
    }
    
    if (!upiSettings.upiId) {
      toast.error("Payment not configured. Contact admin.");
      return;
    }
    
    // Generate a local reference ID — do NOT hit backend yet.
    // Recharge request is created only after user submits their UPI txn ref.
    const localRef = `RCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    setTransactionId(localRef);
    setStep(2);
  };

  const submitPayment = async () => {
    if (!transactionRef.trim()) {
      toast.error("Please enter UPI transaction ID / reference number");
      return;
    }
    
    setBusy(true);
    try {
      await api.requestRecharge({ amount, refNote: `${transactionId}:${transactionRef}` });
      setStep(3);
      toast.success("Payment submitted for verification");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileShell>
      <Toaster theme="dark" position="top-center" />
      <GlassHeader title="Recharge Wallet" left={
        <button data-testid="recharge-back" onClick={() => nav(-1)} className="mr-1 -ml-2 p-2 rounded-lg hover:bg-white/5"><ChevronLeft className="w-5 h-5" /></button>
      } />
      <div className="px-5 pt-6 pb-10">
        {/* Step 1: Choose Amount */}
        {step === 1 && (
          <div className="space-y-6 fade-up">
            <div>
              <Label>Choose amount to recharge</Label>
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                {presets.map((a) => (
                  <button 
                    key={a} 
                    data-testid={`preset-${a}`} 
                    onClick={() => setAmount(a)} 
                    className={`py-4 rounded-xl font-heading font-semibold border transition-all ${
                      amount === a 
                        ? "bg-[#9333EA] text-white border-[#9333EA] shadow-lg shadow-[#9333EA]/30" 
                        : "bg-[#151923] text-white border-white/10 hover:border-[#9333EA]/50"
                    }`}
                  >
                    {inr(a)}
                  </button>
                ))}
              </div>
              <Input 
                data-testid="custom-amount" 
                inputMode="numeric" 
                value={amount} 
                onChange={(e) => setAmount(Number(e.target.value) || 0)} 
                placeholder="Custom amount (min ₹10)" 
              />
            </div>

            <div className="p-4 bg-[#9333EA]/10 border border-[#9333EA]/20 rounded-xl">
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                <strong className="text-[#9333EA]">How it works:</strong> Choose amount → Scan QR code or use UPI ID to pay → Submit payment reference → Admin verifies and credits your wallet.
              </p>
            </div>

            <PrimaryButton 
              data-testid="proceed-to-payment" 
              disabled={amount < 10 || !upiSettings.upiId || busy} 
              onClick={proceedToPayment}
            >
              <QrCode className="w-4 h-4" />
              {busy ? "Loading..." : "Proceed to Payment"}
            </PrimaryButton>

            {!upiSettings.upiId && (
              <p className="text-xs text-[#EF4444] text-center">UPI payment not configured. Please contact admin.</p>
            )}
          </div>
        )}

        {/* Step 2: Show QR Code & Payment Details */}
        {step === 2 && (
          <div className="space-y-5 fade-up">
            <div className="text-center">
              <p className="text-xl font-heading font-bold text-white">Pay {inr(amount)}</p>
              <p className="text-sm text-[#94A3B8] mt-1">Scan QR code or use UPI ID</p>
            </div>

            {/* QR Code Display */}
            {upiSettings.qrCodeUrl && (
              <div className="bg-[#151923] border border-white/10 rounded-2xl p-6">
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-xl">
                    <img 
                      src={upiSettings.qrCodeUrl} 
                      alt="Payment QR Code" 
                      className="w-64 h-64 object-contain"
                    />
                  </div>
                </div>
                <p className="text-center text-xs text-[#94A3B8] mt-4">Scan with any UPI app to pay</p>
              </div>
            )}

            {/* UPI ID Display */}
            <div className="bg-[#151923] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-[#94A3B8] mb-2">Or pay using UPI ID</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-base font-semibold text-white">{upiSettings.upiId}</span>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(upiSettings.upiId); toast.success("UPI ID copied"); }}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="pt-3 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#94A3B8]">Amount:</span>
                  <span className="font-heading text-lg font-bold text-[#9333EA]">{inr(amount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#94A3B8]">Pay to:</span>
                  <span className="text-white font-medium">{upiSettings.upiName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#94A3B8]">Reference ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-white">{transactionId}</span>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(transactionId); toast.success("Copied!"); }}
                      className="p-1 rounded bg-white/5 hover:bg-white/10"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Confirmation Input */}
            <div>
              <Label>UPI Transaction ID / Reference Number</Label>
              <Input 
                data-testid="transaction-ref" 
                value={transactionRef} 
                onChange={(e) => setTransactionRef(e.target.value)} 
                placeholder="Enter transaction ID from your payment app" 
              />
              <p className="text-[10px] text-[#64748B] mt-1">You can find this in your UPI app's transaction history</p>
            </div>

            <div className="p-4 bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl">
              <p className="text-xs text-[#10B981] leading-relaxed">
                <strong>Note:</strong> After payment, enter your UPI transaction ID above and submit. We'll verify and credit your wallet within a few minutes.
              </p>
            </div>

            <PrimaryButton data-testid="submit-payment" onClick={submitPayment} disabled={busy || !transactionRef.trim()}>
              <CheckCircle2 className="w-4 h-4" />
              {busy ? "Submitting..." : "Submit Payment Confirmation"}
            </PrimaryButton>

            <SecondaryButton data-testid="back-to-amount" onClick={() => setStep(1)}>
              Change Amount
            </SecondaryButton>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="pt-10 text-center fade-up">
            <div className="w-20 h-20 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-[#10B981]" />
            </div>
            <h2 className="font-heading text-2xl font-bold mt-6">Payment Submitted!</h2>
            <p className="text-sm text-[#94A3B8] mt-2 max-w-sm mx-auto">
              Your recharge of {inr(amount)} has been submitted for verification. Admin will verify and credit your wallet shortly.
            </p>
            
            <div className="mt-6 p-4 bg-[#151923] border border-white/10 rounded-xl inline-block">
              <p className="text-xs text-[#94A3B8]">Reference ID</p>
              <p className="font-mono text-sm font-semibold text-white mt-1">{transactionId}</p>
            </div>

            <div className="mt-8 max-w-xs mx-auto space-y-3">
              <PrimaryButton data-testid="go-to-wallet" onClick={() => nav("/wallet")}>
                Back to Wallet
              </PrimaryButton>
              <SecondaryButton onClick={() => nav("/app")}>
                Go Home
              </SecondaryButton>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
