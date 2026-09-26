# Nails by Jazz

Online store for **Nails by Jazz** — handmade press-on nails by Jasveen Kaur, Meerut.

## Features
- Animated white & pink storefront: catalogue with filters, product photo galleries, sizing guide, FAQ
- "Recreate a design": customers paste a Pinterest/Instagram link, priced at base + custom fee
- Cart and checkout with ₹99 pan-India shipping (5–6 days); order is sent to WhatsApp (+91 84394 11560)
- Customer accounts: sign up / log in, saved address, order history with status and tracking
- Admin panel at `/admin`: orders (status, payment, tracking), designs with multiple photo uploads, single and bulk price changes, fees, customers, shop settings
- Razorpay online payments built in, switched off until keys are added

## Environment variables
| Name | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (required on Render so data survives restarts) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin login |
| `SESSION_SECRET` | Random string that signs login cookies |
| `WHATSAPP_NUMBER`, `INSTAGRAM` | First-run defaults (editable in Admin → Settings) |
| `PAYMENT_MODE`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Set `PAYMENT_MODE=razorpay` with keys to turn on online payment |

## Run locally
```bash
npm install
cp .env.example .env   # edit values
npm start              # http://localhost:3000
```
Without `MONGODB_URI`, data is stored in `data/store/*.json`.

## Deploy on Render (free)
New → Web Service → connect this repo → Build `npm ci`, Start `node server.js`, Instance type Free → add the environment variables above.
The free plan sleeps after 15 minutes without visitors; the first visit after that takes about a minute to load.
