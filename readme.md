# 🚀 ShipStation API Webhook Simulator

[![View Live](https://img.shields.io/badge/View-Live_Demo-brightgreen)](https://pmcgee-personal.github.io/shipstation-api-webhook-simulator/)

A lightweight, browser-based tool to simulate **ShipStation API (fka ShipEngine)** tracking webhooks with production-accurate JSON schemas.

📱 Mobile Installation (PWA)
This simulator is a Progressive Web App, meaning you can install it on your phone's home screen without using an App Store:

iOS (Safari): Tap the Share icon (square with up arrow) and select "Add to Home Screen."

Android (Chrome): Tap the three dots in the top right and select "Install app" or "Add to Home screen."

Desktop: Click the Install icon in the address bar of Chrome or Edge to run it as a standalone window.

## 🛠 Features
* **Carrier Specifics:** Supports FedEx, UPS, and USPS event codes and geographic data.
* **Timeline Logic:** Automatically generates a logical history of events with relative timestamps.
* **Production Schema:** Matches the ShipStation API `API_TRACK` resource type exactly, including dynamic label IDs and null-safe event objects.
* **Offline Ready (Basic)**: Includes a Service Worker (sw.js) to meet PWA installation requirements.
* **App Manifest**: Configured with a manifest.json for a native look and feel, including a custom app icon and theme colors.
* **Mobile Optimized**: Uses a specific viewport meta-tag to prevent accidental zooming on mobile inputs.

---

## ⚠️ Critical: CORS Setup
To bypass browser security restrictions (CORS) when sending requests from GitHub Pages to a third-party URL:

1. Visit the [CORS Anywhere Demo Page](https://cors-anywhere.herokuapp.com/corsdemo).
2. Click **"Request temporary access to the demo server"**.
3. Return to the Simulator and fire your webhooks.

---

## 📖 How to Use
1. **Enter Target URL:** Paste your webhook endpoint (e.g., a `webhook.site` URL).
2. **Select Carrier & Status:** Choose the scenario you want to test.
3. **Fire Webhook:** Click the button.
4. **Check History:** The "Recent Activity" log shows a green **SENT** tag if the destination server accepted the payload.

---

## 📄 Example Payload Structure
The tool sends a `POST` request with a JSON body following the ShipStation API standard:
- `estimated_delivery_date`: Null if status is Delivered.
- `actual_delivery_date`: Populated only if status is Delivered.

---

## 🔧 Tech Stack
* **Axios & Day.js** (CDN loaded)
* **GitHub Pages** (Hosting)
* **CORS Anywhere** (Proxy)
