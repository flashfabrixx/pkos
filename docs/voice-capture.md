# Voice capture via iOS Shortcuts

PKOS exposes a public REST endpoint (`POST /api/v1/captures`) that any
HTTP client can call to push a capture. The most convenient setup on
iOS is a Shortcut you can fire from the Lock Screen, Back Tap, or the
Action Button: it dictates a voice note, transcribes it, and posts the
text straight into PKOS.

This guide walks through that setup. It's the same recipe for n8n,
Tasker on Android, Raycast on macOS, or a `curl` call from a server —
everything boils down to one HTTPS POST with a Bearer token.

---

## 1. Create an API key

In PKOS, go to **Settings → General → API keys**. Create a key named
something memorable (e.g. `iPhone Shortcut`) with the **`captures:write`**
scope. Copy the plaintext value — PKOS only shows it once.

If you want the Shortcut to also let you search and chat with PKOS
later, add `search:read` and `chat:read` to the key too.

## 2. Build the Shortcut

On iOS 17+:

1. Open **Shortcuts → +** (new shortcut).
2. Add action **Dictate Text** (Speech category). Configure:
   - Language: your dictation language (Auto works fine).
   - Stop Listening: After Pause (or On Tap if you want manual control).
3. Add action **Get Contents of URL** (Web category). Configure:
   - **URL**: `https://your-pkos.example/api/v1/captures`
   - **Method**: `POST`
   - **Headers**:
     - `Authorization`: `Bearer pkos_XXXX_YYYY` (your key)
     - `Content-Type`: `application/json`
   - **Request Body**: JSON
     - `sourceType`: `voice_note`
     - `rawText`: tap to pick the variable from step 2 (the dictated text)
     - `capturedAt`: a Date action formatted as `YYYY-MM-DD` (or omit
       to let PKOS use the server clock)
     - `confidentiality`: `private` (or `internal`, `public`, etc.)
4. (Optional) Add a **Show Notification** action with the result so
   you can see the new capture's id confirming success.
5. Save the Shortcut as **PKOS Capture** (or whatever you prefer).

## 3. Place the trigger

Pick one or more of:

- **Home Screen**: long-press the Shortcut → Share → Add to Home Screen.
- **Lock Screen widget**: Edit Lock Screen → Add Widgets → Shortcuts.
- **Back Tap**: Settings → Accessibility → Touch → Back Tap → Double
  Tap → Pick your Shortcut.
- **Action Button** (iPhone 15 Pro+): Settings → Action Button →
  Shortcut → Pick your Shortcut.
- **Siri**: just say "Hey Siri, PKOS Capture" and dictate.

## 4. Test it

Run the Shortcut. After dictating ~5 seconds of speech you should see
a new capture appear in PKOS under **Captures**. The extractor will
pull entities and tags out of it on its normal schedule.

## Troubleshooting

- **401 Unauthorized**: the Bearer token is wrong, missing the
  `captures:write` scope, or was revoked. Check the value and the
  scope checkboxes on the key in Settings.
- **The capture lands but text is empty**: the Dictate Text variable
  isn't wired into `rawText`. Tap the field and pick "Dictated Text"
  from the variable picker, don't paste literal text.
- **Slow response from PKOS**: the server runs the extractor
  asynchronously — the POST should return within a second. If it
  doesn't, your reverse proxy is the prime suspect.

## Beyond voice notes

The same endpoint accepts any `sourceType` PKOS recognises
(`meeting`, `text_note`, `email`, `web_clip`, etc.) plus optional
`title`, `summary`, `participants`, `project`, and metadata fields.
See `docs/api.md` for the full schema.
