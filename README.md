# Blue Dream Interior Design — Website

Premium, animated, fully responsive website with a Node.js (Express) backend.

## Ki ki ache (Features)
- 3D door-opening hero (logo concept theke), swinging pendant lamp, mouse parallax
- Animated sections: scroll reveal, word-by-word quote, process timeline, counters, marquee
- Services, Drawing → 3D render drag slider, filterable portfolio with project popup
- Budget estimator (BDT lakh/crore + USD), material library, FAQ, contact form, WhatsApp button
- Backend: contact form API, leads saved in `data/leads.json`, optional email alert, rate limit, spam honeypot, security headers

## Run locally
```bash
npm install
cp .env.example .env      # ADMIN_TOKEN set korun
npm start                 # http://localhost:3000
```

## Apnar info change korun
`public/index.html` file e `const SITE = {...}` khujun — phone, WhatsApp, email, address, hours, social links, USD rate sob ekhane.

Portfolio projects: `const WORKS = [...]` — real project er naam, area, timeline bosan.
Hero numbers (350+, 1.2M, 10+): `data-count` attribute e apnar real number din.

## Enquiries dekhun
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" https://yourdomain.com/api/leads
```
Email alert chaile `.env` e SMTP fill korun (Gmail hole App Password use korun).

## Deploy
- **VPS (DigitalOcean / Contabo etc.)**: `npm install --omit=dev`, then `pm2 start server.js --name bluedream`, Nginx reverse proxy → port 3000, Certbot diye SSL.
- **cPanel (Node.js App support thakle)**: "Setup Node.js App" → startup file `server.js` → Run NPM Install → Restart.
- **Render / Railway**: repo connect korun, start command `npm start`. Note: free plan e disk persistent na, tai SMTP email alert on rakhun.
