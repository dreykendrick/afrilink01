# Mobile Deep Linking — AfriLink Password Reset

## Overview

The password reset email always links to the canonical web URL:

```
https://afrilink01.vercel.app/reset-password?token=<TOKEN>
```

When a mobile app (Android/iOS) is installed and properly configured, the OS
will intercept this URL and open it directly inside the app. If the app is not
installed the link opens normally in the browser.

---

## 1. Android App Links

### a) Host the verification file

The file `public/.well-known/assetlinks.json` is already in the repo. Before
publishing, replace the placeholders:

| Placeholder | Replace with |
|---|---|
| `REPLACE_ME_PACKAGE_NAME` | Your Android package name, e.g. `com.kbsoftwares.afrilink` |
| `REPLACE_ME_SHA256_FINGERPRINT` | SHA-256 fingerprint of your signing key |

To get the fingerprint:

```bash
keytool -list -v -keystore your-release-key.jks | grep SHA256
```

### b) AndroidManifest.xml intent-filter

Add this inside `<activity>` in your Android project:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data
    android:scheme="https"
    android:host="afrilink01.vercel.app"
    android:pathPrefix="/reset-password" />
</intent-filter>

<!-- Optional: custom scheme fallback -->
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data
    android:scheme="afrilink"
    android:host="reset-password" />
</intent-filter>
```

### c) Verification

After deploying, verify with:

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://afrilink01.vercel.app&relation=delegate_permission/common.handle_all_urls
```

---

## 2. iOS Universal Links

### a) Host the verification file

The file `public/.well-known/apple-app-site-association` is already in the
repo. Replace the placeholder:

| Placeholder | Replace with |
|---|---|
| `REPLACE_ME_TEAMID_BUNDLEID` | `<TEAM_ID>.<BUNDLE_ID>`, e.g. `ABC123.com.kbsoftwares.afrilink` |

### b) Xcode — Associated Domains

In your iOS project, add the Associated Domains capability:

```
applinks:afrilink01.vercel.app
```

### c) App routing

In your iOS app, handle the incoming URL in `AppDelegate` or `SceneDelegate`:

```swift
func application(_ application: UIApplication,
                 continue userActivity: NSUserActivity,
                 restorationHandler: ...) -> Bool {
  guard let url = userActivity.webpageURL,
        url.path.hasPrefix("/reset-password"),
        let token = URLComponents(url: url, resolvingAgainstBaseURL: false)?
          .queryItems?.first(where: { $0.name == "token" })?.value
  else { return false }
  
  // Navigate to ResetPasswordScreen(token: token)
  return true
}
```

---

## 3. Custom Scheme Fallback (`afrilink://`)

The web reset page includes an "Open in AfriLink App" button that fires:

```
afrilink://reset-password?token=<TOKEN>
```

This works even without App Links / Universal Links configured, but requires
the app to register the `afrilink://` scheme.

---

## 4. Vercel Headers

`vercel.json` already serves the `.well-known` files with
`Content-Type: application/json` and no redirects (the SPA rewrite is ordered
after the headers rule).

---

## 5. Checklist

- [ ] Replace placeholders in `assetlinks.json`
- [ ] Replace placeholder in `apple-app-site-association`
- [ ] Add intent-filter to `AndroidManifest.xml`
- [ ] Add Associated Domains in Xcode
- [ ] Implement token parsing in Android `Activity` / iOS `AppDelegate`
- [ ] Test: open `https://afrilink01.vercel.app/reset-password?token=test` on a device with app installed
