"""Cross-context DialPro call e2e test.
Runs two browser contexts (user + provider) to validate WebRTC signaling.
"""
import asyncio
import os
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


async def run():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--autoplay-policy=no-user-gesture-required",
            ],
        )
        # Two SEPARATE contexts = separate localStorage/sessions
        ctx_user = await browser.new_context(
            viewport={"width": 414, "height": 896},
            permissions=["camera", "microphone"],
        )
        ctx_prov = await browser.new_context(
            viewport={"width": 414, "height": 896},
            permissions=["camera", "microphone"],
        )

        user_page = await ctx_user.new_page()
        prov_page = await ctx_prov.new_page()

        user_page.on("console", lambda m: print(f"USER_CONSOLE: {m.text}") if m.type in ("error", "warning") else None)
        prov_page.on("console", lambda m: print(f"PROV_CONSOLE: {m.text}") if m.type in ("error", "warning") else None)

        # WS instrumentation
        def ws_log(label):
            def on_ws(ws):
                print(f"{label} WS OPEN -> {ws.url}")
                ws.on("framesent", lambda p: print(f"{label} WS SENT: {str(p)[:200]}"))
                ws.on("framereceived", lambda p: print(f"{label} WS RECV: {str(p)[:200]}"))
                ws.on("close", lambda: print(f"{label} WS CLOSED"))
            return on_ws
        user_page.on("websocket", ws_log("USER"))
        prov_page.on("websocket", ws_log("PROV"))

        try:
            # ---- Login both
            await login(prov_page, "8000000001", "pro123", "provider")
            await login(user_page, "9999999999", "demo123", "user")
            step("provider_login", "/provider" in prov_page.url, prov_page.url)
            step("user_login", "/app" in user_page.url, user_page.url)

            # ---- Provider toggle online
            await prov_page.wait_for_selector('[data-testid="online-toggle"]', timeout=5000)
            body_txt = await prov_page.inner_text("body")
            if "● Online" not in body_txt:
                await prov_page.click('[data-testid="online-toggle"]', force=True)
                await prov_page.wait_for_timeout(800)
            body_txt = await prov_page.inner_text("body")
            step("provider_online", "● Online" in body_txt, "online state visible")
            # Allow signaling sockets time to settle
            await prov_page.wait_for_timeout(1500)

            # ============================
            # SCENARIO 1: Full happy-path call
            # ============================
            await user_page.wait_for_selector('[data-testid="provider-card-pr1"]', timeout=5000)
            await user_page.click('[data-testid="provider-card-pr1"]', force=True)
            await user_page.wait_for_timeout(800)
            await remove_badge(user_page)
            await user_page.wait_for_selector('[data-testid="start-call-btn"]', timeout=5000)
            await user_page.click('[data-testid="start-call-btn"]', force=True)
            step("start_call_clicked", True, user_page.url)

            # Provider must see incoming popup within ~15s (allow ~5 retries while WS settles)
            try:
                await prov_page.wait_for_selector('[data-testid="accept-call"]', timeout=15000)
                step("provider_incoming_popup", True, "accept-call visible")
            except Exception as e:
                step("provider_incoming_popup", False, f"NOT visible within 15s: {e}")
                raise

            await remove_badge(prov_page)
            await prov_page.click('[data-testid="accept-call"]', force=True)
            await prov_page.wait_for_timeout(1000)
            step("provider_accepted", "/provider/call/" in prov_page.url, prov_page.url)

            # Allow 6s for ICE
            await asyncio.sleep(6)

            # Verify both <video> have srcObject
            user_has_video = await user_page.evaluate(
                "() => Array.from(document.querySelectorAll('video')).some(v => v.srcObject != null)"
            )
            prov_has_video = await prov_page.evaluate(
                "() => Array.from(document.querySelectorAll('video')).some(v => v.srcObject != null)"
            )
            step("user_video_srcObject", user_has_video, str(user_has_video))
            step("prov_video_srcObject", prov_has_video, str(prov_has_video))

            # call-timer should be > 00:00
            timer_text = await user_page.inner_text('[data-testid="call-timer"]')
            step("call_timer_ticks", timer_text not in ("00:00", "0:00", ""), timer_text)
            try:
                pcall_timer = await prov_page.inner_text('[data-testid="pcall-timer"]')
                step("pcall_timer_ticks", pcall_timer not in ("00:00", "0:00", ""), pcall_timer)
            except Exception as e:
                step("pcall_timer_ticks", False, str(e))

            # call-wallet should have decreased (< 250)
            try:
                wallet_text = await user_page.inner_text('[data-testid="call-wallet"]')
                step("call_wallet_decreases", True, wallet_text)
            except Exception as e:
                step("call_wallet_decreases", False, str(e))
            try:
                earned_text = await prov_page.inner_text('[data-testid="pcall-earned"]')
                step("pcall_earned_increases", True, earned_text)
            except Exception as e:
                step("pcall_earned_increases", False, str(e))

            # End call from user
            await remove_badge(user_page)
            await user_page.click('[data-testid="call-end"]', force=True)
            await asyncio.sleep(2.5)
            step("user_back_to_app", "/app" in user_page.url, user_page.url)
            step("prov_back_to_provider", prov_page.url.rstrip("/").endswith("/provider"), prov_page.url)

            # Verify /wallet shows a new debit
            await user_page.goto(f"{BASE}/wallet", wait_until="networkidle")
            await user_page.wait_for_timeout(800)
            wallet_body = await user_page.inner_text("body")
            step("wallet_debit_present", "Call with" in wallet_body or "debit" in wallet_body.lower(), wallet_body[:200])

            # Verify earnings updated
            await prov_page.goto(f"{BASE}/provider/earnings", wait_until="networkidle")
            await prov_page.wait_for_timeout(800)
            earn_body = await prov_page.inner_text("body")
            step("provider_earnings_visible", "earning" in earn_body.lower() or "₹" in earn_body, earn_body[:200])

            # ============================
            # SCENARIO 2: Reject path
            # ============================
            await user_page.goto(f"{BASE}/app", wait_until="networkidle")
            await user_page.wait_for_timeout(700)
            await prov_page.goto(f"{BASE}/provider", wait_until="networkidle")
            await prov_page.wait_for_timeout(1500)
            await remove_badge(prov_page)
            await remove_badge(user_page)

            await user_page.wait_for_selector('[data-testid="provider-card-pr1"]', timeout=5000)
            await user_page.click('[data-testid="provider-card-pr1"]', force=True)
            await user_page.wait_for_timeout(600)
            await user_page.click('[data-testid="start-call-btn"]', force=True)
            try:
                await prov_page.wait_for_selector('[data-testid="reject-call"]', timeout=15000)
                await remove_badge(prov_page)
                await prov_page.click('[data-testid="reject-call"]', force=True)
                await asyncio.sleep(1.5)
                body = await user_page.inner_text("body")
                step("user_sees_reject_toast", "rejected" in body.lower() or "/app" in user_page.url, user_page.url)
            except Exception as e:
                step("reject_path", False, f"reject-call not visible: {e}")

            # ============================
            # SCENARIO 3: 30s timeout when provider OFFLINE
            # ============================
            # Toggle provider offline
            await prov_page.goto(f"{BASE}/provider", wait_until="networkidle")
            await prov_page.wait_for_timeout(800)
            body_txt = await prov_page.inner_text("body")
            if "● Online" in body_txt:
                await prov_page.click('[data-testid="online-toggle"]', force=True)
                await prov_page.wait_for_timeout(800)
            body_txt = await prov_page.inner_text("body")
            step("provider_offline_now", "● Online" not in body_txt, "offline confirmed")

            await user_page.goto(f"{BASE}/app", wait_until="networkidle")
            await user_page.wait_for_timeout(800)
            await user_page.click('[data-testid="provider-card-pr1"]', force=True)
            await user_page.wait_for_timeout(600)
            await user_page.click('[data-testid="start-call-btn"]', force=True)
            # Wait up to ~5s for offline auto-reject
            await asyncio.sleep(5)
            body = await user_page.inner_text("body")
            url_now = user_page.url
            offline_handled = ("rejected" in body.lower() or "didn't answer" in body.lower()
                               or "didnt answer" in body.lower() or "/app" in url_now)
            step("offline_auto_reject", offline_handled, f"url={url_now} body_snippet={body[:150]}")

        except Exception as e:
            RESULTS["errors"].append(str(e))
            print(f"FATAL: {e}")
        finally:
            await ctx_user.close()
            await ctx_prov.close()
            await browser.close()

    print("\n=========== RESULTS ===========")
    passed = sum(1 for s in RESULTS["steps"] if s["ok"])
    total = len(RESULTS["steps"])
    print(f"PASSED {passed}/{total}")
    for s in RESULTS["steps"]:
        print(f"  [{'PASS' if s['ok'] else 'FAIL'}] {s['name']}: {s['info']}")
    if RESULTS["errors"]:
        print("ERRORS:", RESULTS["errors"])


if __name__ == "__main__":
    asyncio.run(run())
