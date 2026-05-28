import React, { useEffect, useState } from "react";
import { api } from "../../lib/store";
import { Input, Label } from "../../components/MobileShell";
import { inr, timeAgo } from "../../lib/format";
import { Check, X, Save, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_PACKAGES = [
  { minutes: 5, price: 300, providerRate: 200 },
  { minutes: 10, price: 400, providerRate: 250 },
  { minutes: 15, price: 500, providerRate: 300 },
];

export default function AdminPayments() {
  const [settings, setSettings] = useState({ upi_id: "", qr_url: "" });
  const [billing, setBilling] = useState({ packages: DEFAULT_PACKAGES });
  const [whatsapp, setWhatsapp] = useState({ whatsappNumber: "" });
  const [upi, setUpi] = useState({ upiId: "", upiName: "Bongo Bandhu", qrCodeUrl: "" });
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState({});
  const [uploadingQr, setUploadingQr] = useState(false);

  const refresh = async () => {
    try {
      const [s, b, w, u, q] = await Promise.all([
        api.getPaymentSettings(),
        api.adminGetBilling(),
        api.adminGetWhatsapp(),
        api.adminGetUpi(),
        api.adminGetRecharges(),
      ]);
      setSettings(s);
      const pkgs = Array.isArray(b?.packages) && b.packages.length ? b.packages : DEFAULT_PACKAGES;
      setBilling({
        packages: pkgs.map((p) => ({
          minutes: Number(p.minutes) || 0,
          price: Number(p.price) || 0,
          providerRate: p.providerRate != null ? Number(p.providerRate) : Math.round((Number(p.price) || 0) * 0.6),
        })),
      });
      setWhatsapp(w || { whatsappNumber: "" });
      setUpi(u || { upiId: "", upiName: "Bongo Bandhu", qrCodeUrl: "" });
      setRequests(q);
    } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { refresh(); }, []);

  const savePaymentSettings = async () => {
    setBusy((b) => ({ ...b, upi: true }));
    try { await api.adminSavePayments(settings); toast.success("Payment settings saved"); }
    catch (e) { toast.error(e.message); }
    finally { setBusy((b) => ({ ...b, upi: false })); }
  };
  const saveBilling = async () => {
    // Validate packages
    const pkgs = (billing.packages || [])
      .map((p) => ({
        minutes: Math.max(1, Math.round(Number(p.minutes) || 0)),
        price: Math.max(0, Math.round(Number(p.price) || 0)),
        providerRate: Math.max(0, Math.round(Number(p.providerRate) || 0)),
      }))
      .filter((p) => p.minutes > 0)
      .sort((a, b) => a.minutes - b.minutes);
    if (pkgs.length === 0) return toast.error("Add at least one package");
    // Validate: providerRate <= price for each
    for (const p of pkgs) {
      if (p.providerRate > p.price) {
        return toast.error(`${p.minutes}-min: provider rate (₹${p.providerRate}) cannot exceed price (₹${p.price})`);
      }
      if (p.price <= 0) return toast.error(`${p.minutes}-min: price must be greater than 0`);
      if (p.providerRate <= 0) return toast.error(`${p.minutes}-min: provider rate must be greater than 0`);
    }
    // ensure unique minutes
    const seen = new Set();
    for (const p of pkgs) {
      if (seen.has(p.minutes)) return toast.error(`Duplicate ${p.minutes}-min package`);
      seen.add(p.minutes);
    }
    setBusy((b) => ({ ...b, billing: true }));
    try {
      await api.adminSaveBilling({ packages: pkgs });
      toast.success("Billing saved");
      await refresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy((b) => ({ ...b, billing: false })); }
  };
  const updatePkg = (i, field, val) => {
    setBilling((b) => {
      const arr = [...(b.packages || [])];
      arr[i] = { ...arr[i], [field]: val };
      return { ...b, packages: arr };
    });
  };
  const addPkg = () => setBilling((b) => ({ ...b, packages: [...(b.packages || []), { minutes: 0, price: 0, providerRate: 0 }] }));
  const delPkg = (i) => setBilling((b) => ({ ...b, packages: (b.packages || []).filter((_, idx) => idx !== i) }));

  const saveWhatsapp = async () => {
    setBusy((b) => ({ ...b, whatsapp: true }));
    try { await api.adminSaveWhatsapp(whatsapp); toast.success("WhatsApp number saved"); }
    catch (e) { toast.error(e.message); }
    finally { setBusy((b) => ({ ...b, whatsapp: false })); }
  };

  const saveUpi = async () => {
    setBusy((b) => ({ ...b, upi: true }));
    try { await api.adminSaveUpi(upi); toast.success("UPI settings saved"); }
    catch (e) { toast.error(e.message); }
    finally { setBusy((b) => ({ ...b, upi: false })); }
  };

  const uploadQrCode = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }
    
    setUploadingQr(true);
    try {
      const formData = new FormData();
      formData.append('files', file);
      const { urls } = await api.adminUpload(formData);
      if (urls && urls[0]) {
        setUpi({ ...upi, qrCodeUrl: urls[0] });
        toast.success("QR code uploaded successfully");
      }
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingQr(false);
    }
  };
  
  // const saveRzp = async () => { ... }; // REMOVED - Razorpay disabled
  const approve = async (id) => { try { await api.adminApproveRecharge(id); await refresh(); toast.success("Recharge approved"); } catch (e) { toast.error(e.message); } };
  const reject = async (id) => { try { await api.adminRejectRecharge(id); await refresh(); toast("Recharge rejected"); } catch (e) { toast.error(e.message); } };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Payments & Billing</h1>
        <p className="text-sm text-[#94A3B8] mt-1">Configure call packages, revenue split, and payment gateways.</p>
      </header>

      {/* Billing packages */}
      <section className="bg-[#151923] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#94A3B8]">Call packages (fixed-time)</h3>
            <p className="text-[11px] text-[#94A3B8] mt-1">Set user price and provider earning rate per package. Admin commission = price − provider rate.</p>
          </div>
        </div>
        <div className="space-y-2">
          {/* Header row */}
          <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-[#64748B] font-semibold px-1 pb-1">
            <div className="col-span-3">Duration (min)</div>
            <div className="col-span-3">User pays (₹)</div>
            <div className="col-span-3">Provider earns (₹)</div>
            <div className="col-span-2">Admin gets</div>
            <div className="col-span-1"></div>
          </div>
          {(billing.packages || []).map((pk, i) => {
            const adminShare = Math.max(0, (Number(pk.price) || 0) - (Number(pk.providerRate) || 0));
            const invalid = Number(pk.providerRate) > Number(pk.price);
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-3">
                  <label className="text-xs tracking-[0.08em] uppercase text-[#94A3B8] font-medium mb-2 block sm:hidden">Duration (min)</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]" />
                    <Input
                      data-testid={`pkg-min-${i}`}
                      type="number" min={1}
                      value={pk.minutes}
                      onChange={(e) => updatePkg(i, "minutes", e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-xs tracking-[0.08em] uppercase text-[#94A3B8] font-medium mb-2 block sm:hidden">User pays (₹)</label>
                  <Input
                    data-testid={`pkg-price-${i}`}
                    type="number" min={1}
                    value={pk.price}
                    onChange={(e) => updatePkg(i, "price", e.target.value)}
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-xs tracking-[0.08em] uppercase text-[#94A3B8] font-medium mb-2 block sm:hidden">Provider earns (₹)</label>
                  <Input
                    data-testid={`pkg-prate-${i}`}
                    type="number" min={1}
                    value={pk.providerRate ?? ""}
                    onChange={(e) => updatePkg(i, "providerRate", e.target.value)}
                    className={invalid ? "border-[#EF4444]" : ""}
                  />
                </div>
                <div className="col-span-9 sm:col-span-2">
                  <label className="text-xs tracking-[0.08em] uppercase text-[#94A3B8] font-medium mb-2 block sm:hidden">Admin gets</label>
                  <div className={`px-3 py-2.5 rounded-lg border text-sm tabular-nums ${invalid ? "border-[#EF4444]/40 text-[#EF4444] bg-[#EF4444]/5" : "border-white/10 text-[#10B981] bg-[#10B981]/5"}`} data-testid={`pkg-admin-${i}`}>
                    ₹{adminShare}
                  </div>
                </div>
                <div className="col-span-3 sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    data-testid={`pkg-del-${i}`}
                    onClick={() => delPkg(i)}
                    className="p-2.5 rounded-lg text-[#EF4444] hover:bg-[#EF4444]/10 border border-transparent hover:border-[#EF4444]/20"
                    title="Remove package"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={addPkg}
            data-testid="pkg-add"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#9333EA]/40 text-[#9333EA] hover:bg-[#9333EA]/10 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Add package
          </button>
        </div>

        <button data-testid="save-billing" disabled={busy.billing} onClick={saveBilling} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#9333EA] text-white font-semibold rounded-xl hover:bg-[#7C3AED] disabled:opacity-50">
          <Save className="w-4 h-4" /> Save billing
        </button>
      </section>

      {/* WhatsApp Settings for Real Meet */}
      <section className="bg-[#151923] border border-white/5 rounded-2xl p-5">
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#94A3B8] mb-4">WhatsApp for Real Meet</h3>
        <p className="text-[11px] text-[#94A3B8] mb-4">Users clicking "Real Meet" will be redirected to this WhatsApp number.</p>
        <div className="max-w-md">
          <Label>WhatsApp Number (with country code)</Label>
          <Input 
            data-testid="whatsapp-number" 
            value={whatsapp.whatsappNumber} 
            onChange={(e) => setWhatsapp({ ...whatsapp, whatsappNumber: e.target.value.replace(/\D/g, "") })} 
            placeholder="919876543210 (no + or spaces)" 
          />
          <p className="text-[11px] text-[#64748B] mt-1">Example: 919876543210 for +91 9876543210</p>
        </div>
        <button data-testid="save-whatsapp" disabled={busy.whatsapp} onClick={saveWhatsapp} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#9333EA] text-white font-semibold rounded-xl hover:bg-[#7C3AED] disabled:opacity-50">
          <Save className="w-4 h-4" /> Save WhatsApp
        </button>
      </section>

      {/* UPI Payment Settings */}
      <section className="bg-[#151923] border border-white/5 rounded-2xl p-5">
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#94A3B8] mb-4">UPI Payment Settings</h3>
        <p className="text-[11px] text-[#94A3B8] mb-4">Users will scan QR code or use UPI ID to pay. Upload your payment QR code and set UPI details.</p>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: UPI Details */}
          <div className="space-y-4">
            <div>
              <Label>UPI ID</Label>
              <Input 
                data-testid="upi-id" 
                value={upi.upiId} 
                onChange={(e) => setUpi({ ...upi, upiId: e.target.value })} 
                placeholder="yourname@paytm, yourname@ybl, etc." 
              />
              <p className="text-[10px] text-[#64748B] mt-1">Your UPI ID (e.g., 9876543210@paytm)</p>
            </div>
            <div>
              <Label>UPI Name</Label>
              <Input 
                data-testid="upi-name" 
                value={upi.upiName} 
                onChange={(e) => setUpi({ ...upi, upiName: e.target.value })} 
                placeholder="Your Name or Business Name" 
              />
              <p className="text-[10px] text-[#64748B] mt-1">Name shown to users during payment</p>
            </div>
          </div>

          {/* Right: QR Code Upload */}
          <div>
            <Label>Payment QR Code</Label>
            <div className="mt-2">
              {upi.qrCodeUrl ? (
                <div className="relative inline-block">
                  <img 
                    src={upi.qrCodeUrl} 
                    alt="Payment QR Code" 
                    className="w-48 h-48 object-contain bg-white rounded-xl border-2 border-[#9333EA]/30"
                  />
                  <button
                    onClick={() => setUpi({ ...upi, qrCodeUrl: "" })}
                    className="absolute -top-2 -right-2 p-1.5 rounded-full bg-[#EF4444] text-white hover:bg-[#DC2626]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-[#9333EA]/50 transition-colors bg-white/[0.02]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadQrCode}
                    disabled={uploadingQr}
                    className="hidden"
                  />
                  {uploadingQr ? (
                    <p className="text-sm text-[#9333EA]">Uploading...</p>
                  ) : (
                    <>
                      <Plus className="w-8 h-8 text-[#94A3B8] mb-2" />
                      <p className="text-xs text-[#94A3B8]">Click to upload</p>
                      <p className="text-[10px] text-[#64748B] mt-1">PNG, JPG (max 5MB)</p>
                    </>
                  )}
                </label>
              )}
            </div>
            <p className="text-[10px] text-[#64748B] mt-2">Upload your UPI payment QR code image</p>
          </div>
        </div>

        <button data-testid="save-upi" disabled={busy.upi} onClick={saveUpi} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#9333EA] text-white font-semibold rounded-xl hover:bg-[#7C3AED] disabled:opacity-50">
          <Save className="w-4 h-4" /> Save UPI Settings
        </button>
        
        <div className="mt-4 p-4 bg-[#9333EA]/10 border border-[#9333EA]/20 rounded-xl">
          <p className="text-xs text-[#94A3B8]">
            <strong className="text-[#9333EA]">How it works:</strong> Users see your QR code and UPI ID on the recharge page. They scan the QR code or use UPI ID to pay, then submit payment confirmation. You verify and approve from "Recharge Requests" below.
          </p>
        </div>
      </section>

      {/* Razorpay - REMOVED
      <section className="bg-[#151923] border border-white/5 rounded-2xl p-5">
        ...
      </section>
      */}

      {/* Manual UPI */}
      <section className="bg-[#151923] border border-white/5 rounded-2xl p-5">
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#94A3B8] mb-4">Manual UPI fallback</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>UPI ID</Label>
            <Input data-testid="upi-id-input" value={settings.upi_id || ""} onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })} placeholder="yourbusiness@upi" />
          </div>
          <div>
            <Label>QR image URL</Label>
            <Input data-testid="upi-qr-input" value={settings.qr_url || ""} onChange={(e) => setSettings({ ...settings, qr_url: e.target.value })} placeholder="https://..." />
          </div>
        </div>
        <button data-testid="save-payment-settings" disabled={busy.upi} onClick={saveUpi} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#9333EA] text-black font-semibold rounded-xl hover:bg-[#7C3AED] disabled:opacity-50">
          <Save className="w-4 h-4" /> Save UPI
        </button>
        {settings.qr_url && <img src={settings.qr_url} alt="qr preview" className="mt-5 w-32 h-32 object-cover rounded-xl border border-white/10" />}
      </section>

      {/* Recharge requests */}
      <section>
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#94A3B8] mb-4">Recharge requests</h3>
        <div className="bg-[#151923] border border-white/5 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0D1119] text-[#94A3B8]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Ref</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">When</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#94A3B8]">No requests yet.</td></tr>}
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-white">{r.userName || "—"}</td>
                  <td className="px-4 py-3 text-[#9333EA] font-heading font-semibold">{inr(r.amount)}</td>
                  <td className="px-4 py-3 text-[#94A3B8] text-xs">{(r.refNote || "").includes(":") ? r.refNote.split(":").slice(1).join(":").trim() : r.refNote}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === "approved" ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20" : r.status === "rejected" ? "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20" : "bg-[#9333EA]/10 text-[#9333EA] border border-[#9333EA]/20"}`}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#94A3B8]">{timeAgo(new Date(r.at).getTime())}</td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "pending" && (
                      <div className="inline-flex gap-2">
                        <button data-testid={`approve-${r.id}`} onClick={() => approve(r.id)} className="text-[#10B981] p-2 rounded-lg hover:bg-[#10B981]/10"><Check className="w-4 h-4" /></button>
                        <button data-testid={`reject-${r.id}`} onClick={() => reject(r.id)} className="text-[#EF4444] p-2 rounded-lg hover:bg-[#EF4444]/10"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
