# readme.md (updated)

Copy everything inside the code block below and paste it over the contents of `readme.md`.

```markdown
# 🚀 ShipStation API Webhook Simulator

[![View Live](https://img.shields.io/badge/View-Live_Demo-brightgreen)](https://pmcgee-personal.github.io/shipstation-api-webhook-simulator/)

A lightweight, browser-based tool that sends **ShipStation API (formerly ShipEngine)** tracking webhooks to your endpoint, so you can build and test a webhook receiver without waiting on a live shipment.

The payloads are **real `API_TRACK` captures** from production, sanitized and re-timed so the newest scan happens the moment you click the button.

> **Which webhook is this?** `API_TRACK` is the tracking webhook for **ShipStation API** accounts. ShipStation accounts receive a different one, `TRACK_EVENT_V2`, which this tool does not send.

---

## 🛠 Features

- **Four carriers:** UPS, USPS, FedEx and DHL eCommerce.
- **Four scenarios:** Label created, In transit, Out for delivery and Delivered. Each carrier's four scenarios are one real parcel at four points in its journey.
- **Your own tracking number:** type one, or leave the pre-filled one. A non-blocking hint flags numbers that don't match the carrier's usual format.
- **Realistic timing:** the newest scan happens now, and every other scan keeps its original distance from it.
- **CORS proxy field:** defaults to CORS Anywhere. Clear it to send directly, or paste your own proxy.
- **Activity log:** each send shows SENT or ERR with the reason (for example `HTTP 200`, `HTTP 403` or a network error).
- **Installable PWA:** works from your home screen. It always loads the latest files when online and falls back to its saved copy offline.

---

## 📖 How to Use

1. **Enter the Target URL:** paste your webhook endpoint, for example a `webhook.site` URL.
2. **Check the proxy:** leave the default CORS Anywhere box, or see [Sending and CORS](#-sending-and-cors) below.
3. **Pick a carrier and scenario.**
4. **Tracking number (optional):** keep the generated one, type your own, or clear the box and a number is generated when you fire.
5. **Fire Webhook:** the log shows a green **SENT** tag if the server accepted the request, or a red **ERR** tag with the reason.

You can also run it locally by opening `index.html` in a browser. No build step is needed.

---

## ⚠️ Sending and CORS

Browsers block cross-origin requests unless the receiving server allows them, so by default the simulator sends through a CORS proxy.

**Default (CORS Anywhere demo):**

1. Visit the [CORS Anywhere demo page](https://cors-anywhere.herokuapp.com/corsdemo).
2. Click **"Request temporary access to the demo server"**.
3. Return to the simulator and fire your webhooks.

The unlock is temporary and applies to the browser you used. The demo server is shared and rate limited, and it may stop working at any time.

**Other options**

- **Your own proxy:** paste its address into the CORS Proxy box. If the address ends in `/`, `?` or `=` it is used as typed, otherwise a `/` is added. Your webhook URL is added to the end.
- **No proxy:** clear the box to send straight to your webhook URL. The simulator's requests carry custom headers, so the receiving server has to allow cross-origin requests and answer the browser's preflight check for those headers.

**Reading an ERR**

| Log message                                         | Likely cause                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `HTTP 403`                                          | The CORS Anywhere unlock is missing or has expired                                    |
| `Network error (proxy locked, CORS or unreachable)` | The proxy isn't unlocked or is down, or with no proxy the receiver doesn't allow CORS |
| `HTTP 4xx` / `5xx` from your server                 | The request reached your endpoint and it rejected it                                  |

---

## 📄 What's in the Payload

Every send is a `POST` with a JSON body in the ShipStation API `API_TRACK` shape: `resource_url`, `resource_type` and a `data` object with 14 keys and events with 19 keys each, in the same order as production.

**Changed on every send**

- `data.tracking_number` and the `tracking_number` in `resource_url` (your number).
- Every timestamp, shifted so the newest scan is "now". Each carrier's own encoding is kept.
- The `se-` ID in `label_url`, for the carriers that populate it.

**Everything else is exactly as captured**, including the quirks. `null` and empty strings, status codes and the order of events are left alone, so a parser tested here sees what production sends.

### Carrier differences

|                         | UPS                        | USPS                          | FedEx                      | DHL eCommerce                     |
| ----------------------- | -------------------------- | ----------------------------- | -------------------------- | --------------------------------- |
| `carrier_occurred_at`   | No suffix, carrier-local   | `-07:00` offset               | `Z` (UTC)                  | `Z` (UTC)                         |
| `status_detail_code`    | Populated                  | Populated                     | Populated                  | `null`                            |
| `label_url`             | `null`                     | `null`                        | Populated                  | Populated                         |
| City and state on scans | Yes, except the label scan | Yes, except no-location scans | Yes, except the label scan | **No** (ZIP and coordinates only) |
| ZIP code                | Delivery scan only         | Most scans                    | **Never**                  | Every scan                        |

### Not simulated

- **Exceptions:** there's no real capture of a delivery exception yet, so the option is hidden.
- **Signed deliveries and proof of delivery:** these fields are empty in every real payload.
- **Non-US scans.**
- **Real signatures:** the request carries `x-shipengine-timestamp`, `x-shipengine-rsa-sha256-signature` and `x-shipengine-rsa-sha256-key-id` headers, but the signature and key ID are placeholders. A receiver that verifies ShipStation's RSA signature will reject these requests.

---

## 📱 Mobile Installation (PWA)

This simulator is a Progressive Web App, so you can install it without an app store:

- **iOS (Safari):** tap the Share icon (square with an up arrow) and select **Add to Home Screen**.
- **Android (Chrome):** tap the three dots in the top right and select **Install app** or **Add to Home screen**.
- **Desktop:** click the Install icon in the address bar of Chrome or Edge to run it as a standalone window.

---

## 🗂 Project Files

| File            | Purpose                                                                         |
| --------------- | ------------------------------------------------------------------------------- |
| `index.html`    | The page and its logic                                                          |
| `replay.js`     | Dependency-free engine that re-times a fixture and swaps in the tracking number |
| `fixtures.js`   | The 16 real `API_TRACK` captures (4 carriers × 4 scenarios)                     |
| `sw.js`         | Service worker: network first, with an offline fallback                         |
| `manifest.json` | PWA manifest                                                                    |
| `icon.png`      | App icon                                                                        |

### Refreshing the fixtures

`fixtures.js` holds one entry per carrier, keyed by the `carrier_code` used in the `resource_url`: `ups`, `usps`, `fedex` and `dhl_global_mail`. Each carrier has four scenarios, `label-created`, `in-transit`, `out-for-delivery` and `delivered`, and each scenario is a webhook body exactly as ShipStation sends it (`resource_url`, `resource_type` and `data`). To refresh one, replace its body with a new capture, and keep any extra keys that aren't part of the real body out of it. Mask the tracking number and the `se-` ID in `label_url` before committing.

### Branches

`gh-pages` is the default branch. It holds this app and is the branch GitHub Pages serves. `legacy-main` holds an earlier, local Node.js version of the tool.

---

## 🔧 Tech Stack

- **Axios** (CDN loaded)
- **Plain JavaScript:** no build step, and `replay.js` has no dependencies
- **GitHub Pages** (hosting)
- **CORS Anywhere** (default proxy, replaceable)
```
