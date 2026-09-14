# Raksshaas Fashion by Raksshana 🪡

**Designs made with love 💖 | From threads to tradition ✨**

Boutique website for Aari work, Embroidery, Custom Stitching in Salem & Coimbatore.

- Instagram: [@raksshaas_fashion](https://www.instagram.com/raksshaas_fashion/)
- WhatsApp: +91 90253 75687
- Locations: Seeragapadi, Salem & Coimbatore

## Features

- ✨ Premium boutique design with animations
- 📸 Admin panel to upload designs (no coding)
- 💬 WhatsApp ordering (no payment gateway)
- 📱 Fully responsive, Tamil + English touch
- 🪡 Focused on Aari work, embroidery, kids couture

## How it Works

**Customer:** Just visits website, sees designs, clicks "Enquire on WhatsApp"

**Shopkeeper (Raksshana):**
1. Go to `/admin`
2. Login: `raksshana` / `raksshaas123`
3. Upload photo + title + price + description
4. Instantly live on website!

## Tech Stack

- Frontend: HTML, CSS, JS (no framework)
- Backend: Node.js + Express + Multer (for uploads)
- Storage: JSON file + uploads folder (can upgrade to MongoDB)

## Local Development

```bash
npm install
node server.js
# Open http://localhost:3000
# Admin: http://localhost:3000/admin
```

## Deployment

### Option 1: Vercel (Recommended - Full Backend)
1. Push to GitHub
2. Import in Vercel
3. Deploy - it auto-detects Node.js

### Option 2: Netlify / GitHub Pages (Static Only)
- Works with offline demo mode (uploads saved in browser localStorage)
- Just drag-drop the folder to Netlify

### Option 3: Render / Railway
- Connect GitHub repo
- Build command: `npm install`
- Start command: `node server.js`

## Admin Credentials

Change in `server.js`:
```js
const ADMIN_USER = 'raksshana';
const ADMIN_PASS = 'raksshaas123';
```

## Contact

Built by Vivyn for Raksshana ❤️
