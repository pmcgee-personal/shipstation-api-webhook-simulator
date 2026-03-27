# 🚀 ShipStation API Webhook Simulator

[![View Live](https://img.shields.io/badge/View-Live_Demo-brightgreen)](https://pmcgee-personal.github.io/shipstation-api-webhook-simulator/)

A lightweight, browser-based tool to simulate **ShipStation API (fka ShipEngine)** tracking webhooks with production-accurate JSON schemas.

## 🛠 Features
* **Carrier Specifics:** Supports FedEx, UPS, and USPS event codes and geographic data.
* **Timeline Logic:** Automatically generates a logical history of events with relative timestamps.
* **Production Schema:** Matches the ShipEngine `API_TRACK` resource type exactly, including dynamic label IDs and null-safe event objects.

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
