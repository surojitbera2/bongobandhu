# Call Notifications — WebView App Setup Guide

## What was implemented

✅ **Always-on push notifications** for incoming calls (works even when WebView is minimized)
✅ **Custom ringtone** (`/ringtone.wav`) — 4-second Indian double-ring loop
✅ **Service Worker** with vibration + `requireInteraction` so notification stays on screen
✅ **Auto-reconnect** when WebView is brought back to foreground
✅ **"Test notification" button** on Provider home — verify everything works
✅ **Two-way ringtone**: OS notification + in-app audio (whichever the device delivers)

## How call notifications work now

1. **User calls provider** → Backend dispatches both:
   - Socket.io `call_request` event (live tab)
   - Web Push notification (works even when app minimized / WebView throttled)

2. **Service worker** receives push and:
   - Shows OS notification with strong vibration pattern
   - Plays default notification sound (varies by Android version)
   - Posts message to any open clients → starts in-app ringtone

3. **Provider sees** a full-screen Accept/Reject dialog with looping ringtone

## WebView Android Setup (Required)

Your WebView wrapper **must** enable these for notifications to work:

### 1. AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

### 2. WebView settings (in Activity)
```kotlin
val webSettings = webView.settings
webSettings.javaScriptEnabled = true
webSettings.domStorageEnabled = true
webSettings.databaseEnabled = true
webSettings.mediaPlaybackRequiresUserGesture = false  // CRITICAL for ringtone
webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE

// Allow autoplay audio (ringtone)
webView.webChromeClient = object : WebChromeClient() {
    override fun onPermissionRequest(request: PermissionRequest) {
        request.grant(request.resources)
    }
    override fun onShowFileChooser(...) { /* file uploads */ }
}
```

### 3. Notification permission (Android 13+)
```kotlin
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    ActivityCompat.requestPermissions(this,
        arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
}
```

### 4. Best WebView wrapper apps (no-code option)
If you're using a service like **MyAppConverter / WebViewGold / GoNative / Median.co**:
- Enable "Web Push Notifications"
- Enable "Background Audio"
- Enable "Service Workers"
- Set "Media autoplay" = Allow

## How a provider enables notifications

1. Open the app → log in as provider
2. Toggle "Online" — this requests notification permission
3. Tap "Enable call notifications" if prompted
4. Tap "Test notification" — you should get a system notification + sound
5. Now any incoming call will alert you, even with app minimized

## Troubleshooting

**No sound when minimized?**
- Android notification channel default sound depends on phone settings
- Open phone Settings → Apps → [your app] → Notifications → Set sound to "Phone ringtone"

**Notification stops after 4 sec?**
- This is normal browser behavior. The `requireInteraction: true` flag keeps the visual notification, but the sound is set by Android system.
- For continuous ring, the in-app ringtone (`/ringtone.wav`) loops while the dialog is open.

**Test button shows "No subscriptions"?**
- The provider hasn't granted notification permission yet, or the SW isn't registered.
- Toggle online → off → on again to re-trigger subscription flow.

**WebView doesn't receive push?**
- WebView may not support service worker push out of the box.
- Solutions:
  a) Use a wrapper that bundles Firebase Cloud Messaging (FCM) bridge
  b) Use Capacitor / Cordova with `@capacitor/push-notifications` plugin
  c) Use a native Android wrapper like https://gonative.io with push enabled
