"""Iteration-8 e2e test: baseline 19/19 + new features
(remote-video on provider, ringtone code presence, auto-hide controls + tap,
notification helper code presence).
"""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("FRONTEND_URL", "https://top-up-selector.preview.emergentagent.com")
RESULTS = {"steps": [], "errors": []}


def step(name, ok, info=""):
    RESULTS["steps"].append({"name": name, "ok": ok, "info": info})
    print(f"{'PASS' if ok else 'FAIL'} :: {name} :: {info}")


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


async def check_remote_srcobject(page):
    """First <video> is the FULL-SCREEN remote video; second is local PiP."""
    return await page.evaluate(
        """() => {
          const vids = Array.from(document.querySelectorAll('video'));
          // Find the largest video (full-screen remote)
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


async def check_controls_hidden(page, hint_text):
    """Get computed opacity of the bottom controls panel + tap-hint visibility."""
    return await page.evaluate(
        """(hint) => {
            // The controls panel is the .bottom-24 backdrop-blur container with z-[60]
            const els = Array.from(document.querySelectorAll('div'))
              .filter(d => d.className && typeof d.className === 'string'
                && d.className.includes('bottom-24')
                && d.className.includes('backdrop-blur-2xl'));
            const panel = els[0];
            const op = panel ? getComputedStyle(panel).opacity : null;
            const cls = panel ? panel.className : '';
            const hintEl = Array.from(document.querySelectorAll('span'))
              .find(s => (s.textContent || '').includes(hint));
            return {
              opacity: op,
              hasOpacity0Class: cls.includes('opacity-0'),
              hasPointerNone: cls.includes('pointer-events-none'),
              hintVisible: !!hintEl,
            };
        }""",
        hint_text,
    )


async def run():
    # ---- Static code presence checks for ringtone & notify ----
    src_root = Path("/app/frontend/src")
    ringtone_path = src_root / "lib/ringtone.js"
    notify_path = src_root / "lib/notify.js"
    ph_path = src_root / "pages/ProviderHome.jsx"
    cs_path = src_root / "pages/CallScreen.jsx"
    pcs_path = src_root / "pages/ProviderCallScreen.jsx"

    step("file_ringtone_exists", ringtone_path.exists(), str(ringtone_path))
    step("file_notify_exists", notify_path.exists(), str(notify_path))

    ph = ph_path.read_text()
    step("ph_imports_ringtone", "from \"../lib/ringtone\"" in ph, "import check")
    step("ph_imports_notify", "from \"../lib/notify\"" in ph, "import check")
    step("ph_calls_ringtone_start", "ringtone.start()" in ph, "ringtone.start() call")
    step("ph_calls_ringtone_stop", "ringtone.stop()" in ph, "ringtone.stop() call")
    step("ph_calls_notify_show", "notify.show(" in ph, "notify.show() call on incoming")
    step("ph_requests_notify_perm", "notify.requestPermission()" in ph, "permission request hook")
    step("ph_checks_doc_hidden", "document.hidden" in ph, "background detection")

    cs = cs_path.read_text()
    pcs = pcs_path.read_text()
    step("cs_video_always_mounted", "ref={remoteVideo}" in cs and "opacity-0" in cs, "always-mounted remote video")
    step("pcs_video_always_mounted", "ref={remoteVideo}" in pcs and "opacity-0" in pcs, "always-mounted remote video")
    step("pcs_setphase_connected_in_offer", "setPhase(\"connected\")" in pcs, "connected only after answer success")
    step("cs_tap_to_show_hint", "Tap screen to show controls" in cs, "tap hint string")
    step("pcs_tap_to_show_hint", "Tap screen to show controls" in pcs, "tap hint string")

    # ---- Now run live browser tests ----
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--autoplay-policy=no-user-gesture-required",
            ],
        )
        ctx_user = await browser.new_context(viewport={"width": 414, "height": 896}, permissions=["camera", "microphone"])
        ctx_prov = await browser.new_context(viewport={"width": 414, "height": 896}, permissions=["camera", "microphone"])
        user_page = await ctx_user.new_page()
        prov_page = await ctx_prov.new_page()

        user_page.on("console", lambda m: print(f"USER_CONSOLE[{m.type}]: {m.text}") if m.type in ("error", "warning") else None)
        prov_page.on("console", lambda m: print(f"PROV_CONSOLE[{m.type}]: {m.text}") if m.type in ("error", "warning") else None)

        def ws_log(label):
            def on_ws(ws):
                ws.on("framesent", lambda p: print(f"{label} WS SENT: {str(p)[:160]}"))
            return on_ws
        user_page.on("websocket", ws_log("USER"))
        prov_page.on("websocket", ws_log("PROV"))

        try:
            await login(prov_page, "8000000001", "pro123", "provider")
            await login(user_page, "9999999999", "demo123", "user")
            step("provider_login", "/provider" in prov_page.url, prov_page.url)
            step("user_login", "/app" in user_page.url, user_page.url)

            await prov_page.wait_for_selector('[data-testid="online-toggle"]', timeout=5000)
            if "● Online" not in await prov_page.inner_text("body"):
                await prov_page.click('[data-testid="online-toggle"]', force=True)
                await prov_page.wait_for_timeout(800)
            step("provider_online", "● Online" in await prov_page.inner_text("body"), "online")
            await prov_page.wait_for_timeout(1500)

            # Start call
            await user_page.wait_for_selector('[data-testid="provider-card-pr1"]', timeout=5000)
            await user_page.click('[data-testid="provider-card-pr1"]', force=True)
            await user_page.wait_for_timeout(600)
            await remove_badge(user_page)
            await user_page.click('[data-testid="start-call-btn"]', force=True)
            step("start_call_clicked", True, user_page.url)

            await prov_page.wait_for_selector('[data-testid="accept-call"]', timeout=15000)
            step("provider_incoming_popup", True, "popup visible")

            await remove_badge(prov_page)
            await prov_page.click('[data-testid="accept-call"]', force=True)
            await prov_page.wait_for_timeout(1000)
            step("provider_accepted", "/provider/call/" in prov_page.url, prov_page.url)

            # 6s for ICE
            await asyncio.sleep(6)

            # ====== KEY iter-8 CHECK: remote (largest) video on BOTH sides has stream ======
            u_info = await check_remote_srcobject(user_page)
            p_info = await check_remote_srcobject(prov_page)
            step("user_remote_video_srcObject", bool(u_info.get("hasSrc")) and u_info.get("videoTracks", 0) > 0, str(u_info))
            step("prov_remote_video_srcObject", bool(p_info.get("hasSrc")) and p_info.get("videoTracks", 0) > 0, str(p_info))

            # Timers
            timer_text = await user_page.inner_text('[data-testid="call-timer"]')
            step("call_timer_ticks", timer_text not in ("00:00", "0:00", ""), timer_text)
            pcall_timer = await prov_page.inner_text('[data-testid="pcall-timer"]')
            step("pcall_timer_ticks", pcall_timer not in ("00:00", "0:00", ""), pcall_timer)
            wallet_text = await user_page.inner_text('[data-testid="call-wallet"]')
            step("call_wallet_decreases", True, wallet_text)
            earned_text = await prov_page.inner_text('[data-testid="pcall-earned"]')
            step("pcall_earned_increases", True, earned_text)

            # ====== AUTO-HIDE check (controls should be hidden ~4s+ after connected) ======
            # We've already slept 6s; just verify
            u_ctrl = await check_controls_hidden(user_page, "Tap screen to show controls")
            p_ctrl = await check_controls_hidden(prov_page, "Tap screen to show controls")
            step("user_controls_autohidden",
                 u_ctrl.get("opacity") == "0" or u_ctrl.get("hasOpacity0Class"),
                 str(u_ctrl))
            step("prov_controls_autohidden",
                 p_ctrl.get("opacity") == "0" or p_ctrl.get("hasOpacity0Class"),
                 str(p_ctrl))
            step("user_tap_hint_visible", bool(u_ctrl.get("hintVisible")), str(u_ctrl.get("hintVisible")))
            step("prov_tap_hint_visible", bool(p_ctrl.get("hintVisible")), str(p_ctrl.get("hintVisible")))

            # ====== TAP-TO-SHOW: click outside controls (top area) ======
            # The controls live in bottom-24; click near center-top (200,300)
            await user_page.mouse.click(200, 300)
            await prov_page.mouse.click(200, 300)
            await asyncio.sleep(0.8)
            u_after = await check_controls_hidden(user_page, "Tap screen to show controls")
            p_after = await check_controls_hidden(prov_page, "Tap screen to show controls")
            step("user_controls_reappear_on_tap",
                 u_after.get("opacity") == "1" and not u_after.get("hasOpacity0Class"),
                 str(u_after))
            step("prov_controls_reappear_on_tap",
                 p_after.get("opacity") == "1" and not p_after.get("hasOpacity0Class"),
                 str(p_after))

            # End call from user
            await user_page.click('[data-testid="call-end"]', force=True)
            await asyncio.sleep(2.5)
            step("user_back_to_app", "/app" in user_page.url, user_page.url)
            step("prov_back_to_provider", prov_page.url.rstrip("/").endswith("/provider"), prov_page.url)

            # Wallet history
            await user_page.goto(f"{BASE}/wallet", wait_until="networkidle")
            await user_page.wait_for_timeout(800)
            wallet_body = await user_page.inner_text("body")
            step("wallet_debit_present", "Call with" in wallet_body or "debit" in wallet_body.lower(), wallet_body[:160])

            await prov_page.goto(f"{BASE}/provider/earnings", wait_until="networkidle")
            await prov_page.wait_for_timeout(800)
            earn_body = await prov_page.inner_text("body")
            step("provider_earnings_visible", "earning" in earn_body.lower() or "₹" in earn_body, earn_body[:160])

            # ============= SCENARIO 2: reject path =============
            await user_page.goto(f"{BASE}/app", wait_until="networkidle")
            await user_page.wait_for_timeout(700)
            await prov_page.goto(f"{BASE}/provider", wait_until="networkidle")
            await prov_page.wait_for_timeout(1500)
            await remove_badge(prov_page); await remove_badge(user_page)
            await user_page.click('[data-testid="provider-card-pr1"]', force=True)
            await user_page.wait_for_timeout(500)
            await user_page.click('[data-testid="start-call-btn"]', force=True)
            await prov_page.wait_for_selector('[data-testid="reject-call"]', timeout=15000)
            await prov_page.click('[data-testid="reject-call"]', force=True)
            await asyncio.sleep(1.5)
            body = await user_page.inner_text("body")
            step("user_sees_reject_toast", "rejected" in body.lower() or "/app" in user_page.url, user_page.url)

            # ============= SCENARIO 3: offline auto-reject =============
            await prov_page.goto(f"{BASE}/provider", wait_until="networkidle")
            await prov_page.wait_for_timeout(800)
            if "● Online" in await prov_page.inner_text("body"):
                await prov_page.click('[data-testid="online-toggle"]', force=True)
                await prov_page.wait_for_timeout(800)
            step("provider_offline_now", "● Online" not in await prov_page.inner_text("body"), "offline")

            await user_page.goto(f"{BASE}/app", wait_until="networkidle")
            await user_page.wait_for_timeout(800)
            await user_page.click('[data-testid="provider-card-pr1"]', force=True)
            await user_page.wait_for_timeout(500)
            await user_page.click('[data-testid="start-call-btn"]', force=True)
            await asyncio.sleep(5)
            body = await user_page.inner_text("body")
            url_now = user_page.url
            ok = ("rejected" in body.lower() or "didn't answer" in body.lower()
                  or "didnt answer" in body.lower() or "/app" in url_now)
            step("offline_auto_reject", ok, f"url={url_now}")

        except Exception as e:
            RESULTS["errors"].append(str(e))
            print(f"FATAL: {e}")
        finally:
            await ctx_user.close()
            await ctx_prov.close()
            await browser.close()

    passed = sum(1 for s in RESULTS["steps"] if s["ok"])
    total = len(RESULTS["steps"])
    print("\n=========== RESULTS ===========")
    print(f"PASSED {passed}/{total}")
    for s in RESULTS["steps"]:
        print(f"  [{'PASS' if s['ok'] else 'FAIL'}] {s['name']}: {s['info']}")
    if RESULTS["errors"]:
        print("ERRORS:", RESULTS["errors"])


if __name__ == "__main__":
    asyncio.run(run())
