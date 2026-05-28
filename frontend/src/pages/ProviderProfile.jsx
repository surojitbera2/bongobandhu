import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Star, Video, Wallet as WalletIcon, AlertTriangle, X, Clock, MessageCircle, ChevronRight, ZoomIn } from "lucide-react";
import { MobileShell, PrimaryButton } from "../components/MobileShell";
import { api } from "../lib/store";
import { getSession } from "../lib/auth";
import { inr } from "../lib/format";
import { toast, Toaster } from "sonner";

export default function ProviderProfile() {
  const nav = useNavigate();
  const { id } = useParams();
  const [provider, setProvider] = useState(null);
  const [user, setUser] = useState(null);
  const [packages, setPackages] = useState([]);
  const [confirmCall, setConfirmCall] = useState(false);
  const [adminWhatsapp, setAdminWhatsapp] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const carouselRef = React.useRef(null);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "user") { nav("/login"); return; }
    (async () => {
      try {
        const [p, u, billing, whatsapp] = await Promise.all([
          api.getProvider(id),
          api.getMe(),
          api.getPublicBilling().catch(() => ({ packages: [] })),
          api.getAdminWhatsapp().catch(() => ({ whatsappNumber: "" })),
        ]);
        setProvider(p); setUser(u);
        setPackages(Array.isArray(billing?.packages) ? billing.packages : []);
        setAdminWhatsapp(whatsapp?.whatsappNumber || "");
      } catch (e) { toast.error(e.message); nav("/app"); }
    })();
    // eslint-disable-next-line
  }, [id]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
        document.body.style.overflow = '';
      }
      if (e.key === 'ArrowLeft' && provider) {
        const images = (provider.avatars && provider.avatars.length > 0) ? provider.avatars : [provider.avatar].filter(Boolean);
        setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
      }
      if (e.key === 'ArrowRight' && provider) {
        const images = (provider.avatars && provider.avatars.length > 0) ? provider.avatars : [provider.avatar].filter(Boolean);
        setLightboxIndex((prev) => (prev + 1) % images.length);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, lightboxIndex, provider]);

  if (!provider || !user) return null;

  // Build image gallery (avatars[] preferred, fallback to single avatar)
  const images = (provider.avatars && provider.avatars.length > 0) ? provider.avatars : [provider.avatar].filter(Boolean);

  const scrollToImage = (index) => {
    if (carouselRef.current) {
      const carousel = carouselRef.current;
      const scrollWidth = carousel.scrollWidth;
      const imageWidth = scrollWidth / images.length;
      carousel.scrollTo({ left: imageWidth * index, behavior: 'smooth' });
      setCurrentImageIndex(index);
    }
  };

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    document.body.style.overflow = '';
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const sortedPackages = [...packages].sort((a, b) => a.minutes - b.minutes);
  const minPrice = sortedPackages.length ? sortedPackages[0].price : 0;

  const requestCall = () => {
    if (!provider.online) { toast.error("Provider is offline"); return; }
    if (provider.busy) { toast.error("Provider is on another call. Try again in a moment."); return; }
    if (sortedPackages.length === 0) { toast.error("Call packages not configured. Contact admin."); return; }
    if (user.wallet < minPrice) {
      toast.error(`Need at least ${inr(minPrice)} to start. Please recharge wallet.`);
      return;
    }
    setConfirmCall(true);
  };
  const proceedCall = () => {
    setConfirmCall(false);
    nav(`/call/${provider.id}`);
  };
  
  // Build the WhatsApp click-to-chat URL for the Real Meet button.
  // Uses the standard https://wa.me/<number>?text=<message> format.
  // The Android WebView (APK wrapper) must be configured to forward this
  // to WhatsApp via an Intent — see shouldOverrideUrlLoading in MainActivity.
  const realMeetMessage = provider
    ? encodeURIComponent(`Hi, I want to real meet with ${provider.name}`)
    : "";
  const realMeetHref = adminWhatsapp
    ? `https://wa.me/${adminWhatsapp}?text=${realMeetMessage}`
    : "#";

  // On tap, also copy the WhatsApp number to the clipboard as a backup so
  // the user can paste it into WhatsApp manually if the link is blocked.
  const handleRealMeetClick = (e) => {
    if (!adminWhatsapp) {
      e.preventDefault();
      toast.error("Real meet not available. Contact support.");
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(adminWhatsapp).catch(() => {});
      }
    } catch (_) { /* ignore */ }
  };
  
  // Check if provider is truly available
  const videoCallEnabled = provider.videoCallEnabled !== false;
  const realMeetEnabled = provider.realMeetEnabled === true;
  const isProviderAvailable = videoCallEnabled || realMeetEnabled;

  return (
    <MobileShell>
      <Toaster theme="dark" position="top-center" />
      <div className="relative">
        {/* Main Image Display */}
        <div className="h-96 relative overflow-hidden bg-[#0A0D14]">
          <div
            ref={carouselRef}
            data-testid="provider-image-carousel"
            className="flex h-full snap-x snap-mandatory overflow-x-auto no-scrollbar scroll-smooth"
            onScroll={(e) => {
              const index = Math.round(e.target.scrollLeft / e.target.offsetWidth);
              setCurrentImageIndex(index);
            }}
          >
            {images.map((src, i) => (
              <div
                key={i}
                className="w-full h-full shrink-0 snap-center relative cursor-pointer group"
                style={{ minWidth: "100%" }}
                onClick={() => openLightbox(i)}
              >
                <img
                  src={src}
                  alt={`${provider.name} ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Zoom indicator on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm rounded-full p-3">
                    <ZoomIn className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Image Counter */}
          {images.length > 1 && (
            <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm text-white text-xs font-semibold z-10">
              {currentImageIndex + 1} / {images.length}
            </div>
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0D14]/30 to-[#0A0D14] pointer-events-none" />
          
          {/* Top Navigation */}
          <div className="absolute top-0 left-0 right-0 px-5 pt-4 flex justify-between items-center z-10">
            <button data-testid="profile-back" onClick={() => nav(-1)} className="p-2 rounded-lg backdrop-blur-xl bg-black/30 border border-white/10">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button data-testid="profile-wallet" onClick={() => nav("/wallet")} className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl bg-black/30 border border-[#9333EA]/30 text-[#9333EA]">
              <WalletIcon className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">{inr(user.wallet)}</span>
            </button>
          </div>
        </div>

        {/* Thumbnail Navigation */}
        {images.length > 1 && (
          <div className="px-5 py-4 bg-[#0A0D14] border-b border-white/5">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => scrollToImage(i)}
                  className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    i === currentImageIndex 
                      ? 'border-[#9333EA] shadow-lg shadow-[#9333EA]/30' 
                      : 'border-white/10 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={src} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                  {i === currentImageIndex && (
                    <div className="absolute inset-0 bg-[#9333EA]/20" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 pt-5 relative z-10 pb-32">
          <div className="bg-[#151923] rounded-2xl border border-white/10 p-5 fade-up">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-heading text-2xl font-bold tracking-tight">{provider.name}</h1>
                <p className="text-xs text-[#94A3B8] mt-0.5">Age {provider.age}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                !isProviderAvailable ? "bg-white/5 text-[#94A3B8] border border-white/10" :
                provider.busy ? "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20" :
                provider.online ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20" :
                "bg-white/5 text-[#94A3B8] border border-white/10"
              }`}>
                {!isProviderAvailable ? "OFFLINE" : provider.busy ? "● BUSY" : provider.online ? "● ONLINE" : "OFFLINE"}
              </span>
            </div>

            <p className="text-sm text-[#94A3B8] leading-relaxed mt-4">{provider.bio}</p>

            {provider.languages?.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-wider text-[#64748B] font-semibold mb-2">Speaks</p>
                <div className="flex flex-wrap gap-1.5">
                  {provider.languages.map((lang) => (
                    <span key={lang} className="text-[11px] px-2.5 py-1 rounded-full bg-[#9333EA]/10 text-[#9333EA] border border-[#9333EA]/20 font-medium">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              {videoCallEnabled && <Stat label="Min plan" value={sortedPackages.length ? inr(minPrice) : "—"} accent />}
              <Stat label="Rating" value={<span className="flex items-center gap-1">4.8 <Star className="w-3.5 h-3.5 fill-[#9333EA] text-[#9333EA]" /></span>} />
            </div>
          </div>

          {/* Only show prices if video call is enabled */}
          {videoCallEnabled && (
            <div className="mt-5 p-4 rounded-xl bg-white/[0.03] border border-white/5 fade-up delay-1">
              <p className="text-xs uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5"><Clock className="w-3 h-3" /> Call packages</p>
              {sortedPackages.length === 0 ? (
                <p className="text-sm text-[#EF4444] mt-2">Packages not configured. Please contact admin.</p>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {sortedPackages.map((pk) => (
                      <div key={pk.minutes} className="bg-[#0A0D14] border border-[#9333EA]/15 rounded-lg p-3 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-[#9333EA] font-semibold">{pk.minutes} min</p>
                        <p className="font-heading text-base font-bold text-white mt-0.5">{inr(pk.price)}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-3">
                    You pay the tier matching your call duration. Auto-ends at {sortedPackages[sortedPackages.length - 1].minutes} min.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
          <div className="max-w-md mx-auto px-5 pb-5 pointer-events-auto space-y-2">
            {videoCallEnabled && (
              <PrimaryButton data-testid="start-call-btn" onClick={requestCall} disabled={!provider.online || provider.busy}>
                <Video className="w-4 h-4" />
                {provider.busy ? "Provider is busy" : provider.online ? "Start Video Call" : "Provider Offline"}
              </PrimaryButton>
            )}
            {realMeetEnabled && (
              <a
                data-testid="real-meet-btn"
                href={realMeetHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleRealMeetClick}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#9333EA] text-white font-semibold hover:bg-[#7C3AED] transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Real Meet
              </a>
            )}
            {!isProviderAvailable && (
              <div className="w-full py-3.5 rounded-xl bg-white/5 text-center text-[#94A3B8] font-semibold border border-white/10">
                Provider Unavailable
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmCall && (
        <div className="fixed inset-0 z-[120] backdrop-blur-2xl bg-black/80 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#151923] rounded-3xl border border-white/10 p-6 fade-up shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#9333EA]/15 border border-[#9333EA]/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#9333EA]" />
              </div>
              <div className="flex-1">
                <h3 className="font-heading text-xl font-bold tracking-tight">Before you call</h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed mt-2">
                  <span className="text-white font-semibold">Bongo Bandhu is for safe & friendly video chats only.</span> Misuse will result in a permanent ban.
                </p>
              </div>
              <button onClick={() => setConfirmCall(false)} data-testid="call-warning-close" className="p-1.5 rounded-lg hover:bg-white/5 text-[#94A3B8]"><X className="w-4 h-4" /></button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button data-testid="call-warning-cancel" onClick={() => setConfirmCall(false)} className="py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold">Cancel</button>
              <button data-testid="call-warning-agree" onClick={proceedCall} className="py-3 rounded-xl bg-[#9333EA] text-white font-bold">I Agree, Call Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Image Lightbox */}
      {lightboxOpen && (
        <div 
          className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 p-3 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Image Counter */}
          <div className="absolute top-4 left-4 z-10 px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm text-white font-semibold">
            {lightboxIndex + 1} / {images.length}
          </div>

          {/* Previous Button */}
          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-4 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-8 h-8 text-white" />
            </button>
          )}

          {/* Main Image */}
          <div 
            className="relative w-full h-full flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[lightboxIndex]}
              alt={`${provider.name} ${lightboxIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Next Button */}
          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-4 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-8 h-8 text-white" />
            </button>
          )}

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 max-w-[90%] overflow-x-auto">
              <div className="flex gap-2 px-4 py-3 bg-black/50 backdrop-blur-sm rounded-2xl">
                {images.map((src, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                    className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      i === lightboxIndex 
                        ? 'border-[#9333EA] scale-110' 
                        : 'border-white/30 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={src} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Keyboard hint */}
          {images.length > 1 && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-white/60 text-xs">
              Use arrow keys or swipe to navigate
            </div>
          )}
        </div>
      )}
    </MobileShell>
  );
}

const Stat = ({ label, value, accent }) => (
  <div className="bg-[#0A0D14] border border-white/5 rounded-xl p-3">
    <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">{label}</p>
    <p className={`font-heading font-bold mt-1 ${accent ? "text-[#9333EA] text-lg" : "text-white text-base"}`}>{value}</p>
  </div>
);
