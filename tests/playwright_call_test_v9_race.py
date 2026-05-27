"""Iteration-9 race test: simulates the getUserMedia-race for the
'sometimes user side not visible on provider' bug.

Strategy:
  1. Patch navigator.mediaDevices.getUserMedia with a 500-800 ms delay
     via addInitScript on BOTH user and provider contexts. This reliably
     puts the offer ahead of the provider's media-ready state.
  2. Spin up user+provider, accept the call within ~1 s of provider's
     tab loading -> hits the pendingOffer path on the provider.
  3. Capture WS frames to verify webrtc_offer is followed by
     webrtc_answer within 3 s even when getUserMedia is slow.
  4. After accept + 6 s ICE wait, the LARGEST <video> on BOTH pages
     must have srcObject with >=1 video track.
  5. Repeat 3 times -> flake/race detection.
"""
import asyncio
import json
import os
import time
from playwright.async_api import async_playwright

BASE = os.environ.get("FRONTEND_URL", "https://top-up-selector.preview.emergentagent.com")
RESULTS = {"steps": [], "errors": []}


def step(name, ok, info=""):
    RESULTS["steps"].append({"name": name, "ok": ok, "info": info})
    print(f"{'PASS' if ok else 'FAIL'} :: {name} :: {info}")


# This init script wraps getUserMedia with a 500-800 ms delay. The wrapper
# is installed *before* any app JS runs so React's first call hits the slow
# path. We must not break the resolution shape: still resolve with the real
# MediaStream produced by the real getUserMedia.
SLOW_GUM_SCRIPT = r"""
(() => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (constraints) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        orig(constraints).then(resolve).catch(reject);
      }, 600 + Math.random() * 200);
    });
  };
  window.__slowGumInstalled = true;
})();
"""


async def remove_badge(page):
    try:
        await page.evaluate("document.getElementById('emergent-badge')?.remove()")
    except Exception:
        pass


async def login(page, mobile, password, role):
    url = f"{BASE}/login" if role == "user" else f"{BASE}/provider/login"
    await page.goto(url, wait_until="networkidle")
    await page.wait_for_selector('[data-testid="login-mobile"]', timeout=10000)
    await page.fill('[data-testid="login-mobile"]', mobile)
    await page.fill('[data-testid="login-password"]', password)
    await page.click('[data-testid="login-submit"]')
    await page.wait_for_timeout(1500)
    await remove_badge(page)


async def check_largest_video_srcobject(page):
    return await page.evaluate(
        """() => {
          const vids = Array.from(document.querySelectorAll('video'));
          if (!vids.length) return {found:false};
          let best = vids[0]; let bestArea = 0;
          for (const v of vids) {
            const r = v.getBoundingClientRect();
            const a = r.width * r.height;
            if (a > bestArea) { bestArea = a; best = v; }
          }
          const ms = best.srcObject;
          return {
            found: true,
            hasSrc: ms != null,
            videoTracks: ms ? ms.getVideoTracks().length : 0,
            audioTracks: ms ? ms.getAudioTracks().length : 0,
            readyState: best.readyState,
            area: bestArea,
            count: vids.length,
          };
        }"""
    )


def install_ws_capture(page, label, frames_bucket):
    """Capture WS framesSent/Received for analysis."""
    def on_ws(ws):
        def on_sent(payload):
            frames_bucket.append({"side": label, "dir": "out", "t": time.time(), "p": payload})
        def on_recv(payload):
            frames_bucket.append({"side": label, "dir": "in",  "t": time.time(), "p": payload})
        ws.on("framesent", lambda f: on_sent(f))
        ws.on("framereceived", lambda f: on_recv(f))
    page.on("websocket", on_ws)


def _kind(payload):
    if not isinstance(payload, str):
        return None
    try:
        obj = json.loads(payload)
    except Exception:
        return None
    return obj.get("type") if isinstance(obj, dict) else None


async def run_iteration(p, iteration):
    browser = await p.chromium.launch(
        headless=True,
        args=[
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
        ],
    )
    ctx_user = await browser.new_context(
        viewport={"width": 414, "height": 896},
        permissions=["camera", "microphone"],
    )
    ctx_prov = await browser.new_context(
        viewport={"width": 414, "height": 896},
        permissions=["camera", "microphone"],
    )

    # Install slow-gum BEFORE any page load
    await ctx_user.add_init_script(SLOW_GUM_SCRIPT)
    await ctx_prov.add_init_script(SLOW_GUM_SCRIPT)

    user_page = await ctx_user.new_page()
    prov_page = await ctx_prov.new_page()

    frames = []
    install_ws_capture(user_page, "user", frames)
    install_ws_capture(prov_page, "provider", frames)

    try:
        # Fresh state
        await user_page.goto(BASE, wait_until="networkidle")
        await prov_page.goto(BASE, wait_until="networkidle")
        await user_page.evaluate("localStorage.clear()")
        await prov_page.evaluate("localStorage.clear()")

        # Login both sides
        await login(user_page, "9999999999", "demo123", "user")
        await login(prov_page, "8000000001", "pro123", "provider")
        step(f"iter{iteration}_login", "/app" in user_page.url and "/provider" in prov_page.url,
             f"user={user_page.url} prov={prov_page.url}")

        # Provider online toggle
        body = await prov_page.inner_text("body")
        if "● Online" not in body:
            await prov_page.click('[data-testid="online-toggle"]', force=True)
            await prov_page.wait_for_timeout(800)

        # Start call from user
        await user_page.goto(f"{BASE}/app", wait_until="networkidle")
        await user_page.wait_for_timeout(500)
        await user_page.click('[data-testid="provider-card-pr1"]', force=True)
        await user_page.wait_for_timeout(400)
        await user_page.click('[data-testid="start-call-btn"]', force=True)

        # Provider should receive incoming popup
        await prov_page.wait_for_selector('[data-testid="accept-call"]', timeout=15000)
        # Race window: accept as fast as possible (we want offer to land before gum resolves)
        t0 = time.time()
        await prov_page.click('[data-testid="accept-call"]', force=True)
        step(f"iter{iteration}_accepted_fast", True, f"clicked accept t={time.time()-t0:.2f}s after popup")

        # Wait for ICE / negotiation
        await asyncio.sleep(6.5)

        u_v = await check_largest_video_srcobject(user_page)
        p_v = await check_largest_video_srcobject(prov_page)
        step(f"iter{iteration}_user_remote_video",
             bool(u_v.get("hasSrc")) and u_v.get("videoTracks", 0) >= 1,
             str(u_v))
        step(f"iter{iteration}_prov_remote_video",
             bool(p_v.get("hasSrc")) and p_v.get("videoTracks", 0) >= 1,
             str(p_v))

        # WS frame analysis: find offer + answer timestamps
        offer_ts = None
        answer_ts = None
        for f in frames:
            k = _kind(f["p"])
            if k == "webrtc_offer" and offer_ts is None:
                offer_ts = f["t"]
            elif k == "webrtc_answer" and answer_ts is None and offer_ts is not None:
                answer_ts = f["t"]
                break
        if offer_ts and answer_ts:
            delta = answer_ts - offer_ts
            step(f"iter{iteration}_offer_answer_within_3s",
                 delta <= 3.0,
                 f"offer->answer={delta:.2f}s")
        else:
            step(f"iter{iteration}_offer_answer_within_3s", False,
                 f"missing frames offer_ts={offer_ts} answer_ts={answer_ts} total_frames={len(frames)}")

        # End the call cleanly so next iteration is independent
        try:
            await user_page.click('[data-testid="call-end"]', force=True)
        except Exception:
            pass
        await asyncio.sleep(1.5)

    except Exception as e:
        RESULTS["errors"].append(f"iter{iteration}: {e}")
        print(f"FATAL iter{iteration}: {e}")
    finally:
        await ctx_user.close()
        await ctx_prov.close()
        await browser.close()


async def main():
    async with async_playwright() as p:
        for i in range(1, 4):
            print(f"\n========== RACE ITERATION {i}/3 ==========")
            await run_iteration(p, i)

    passed = sum(1 for s in RESULTS["steps"] if s["ok"])
    total = len(RESULTS["steps"])
    print("\n=========== RACE RESULTS ===========")
    print(f"PASSED {passed}/{total}")
    for s in RESULTS["steps"]:
        print(f"  [{'PASS' if s['ok'] else 'FAIL'}] {s['name']}: {s['info']}")
    if RESULTS["errors"]:
        print("ERRORS:", RESULTS["errors"])


if __name__ == "__main__":
    asyncio.run(main())
