# 🚀 Deploy Raksshaas Fashion - Step by Step

## Option 1: Fastest - Vercel (Recommended, Full Backend Works)

### Step 1: Create GitHub Repo
1. Go to https://github.com/new
2. Repo name: `raksshaas-fashion`
3. Make it Public
4. **DO NOT** initialize with README (we already have)
5. Click "Create repository"

### Step 2: Push Code (Copy these commands)
Open terminal in this folder and run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/raksshaas-fashion.git
git push -u origin main
```
Replace YOUR_USERNAME with your GitHub username.

### Step 3: Deploy to Vercel (1-click)
1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select `raksshaas-fashion`
4. Vercel auto-detects Node.js - just click **Deploy**
5. Done! You'll get a live link like `https://raksshaas-fashion.vercel.app`

- Customer site: `https://your-link.vercel.app/`
- Admin: `https://your-link.vercel.app/admin`
- Login: raksshana / raksshaas123

---

## Option 2: Netlify (Static Only, No Backend Needed)

If you want super simple (no server), Netlify works with offline mode:

1. Go to https://app.netlify.com/drop
2. Drag and drop your entire project folder
3. Done! Live link in 30 seconds.

Admin uploads will be saved in browser (localStorage) - works for small boutique.

---

## Option 3: GitHub Pages (Free, Static Only)

1. Push to GitHub (same as above)
2. Go to repo Settings → Pages
3. Source: Deploy from branch `main`, folder `/ (root)`
4. Save - live at `https://YOUR_USERNAME.github.io/raksshaas-fashion/`

---

## After Deploy - Give to Raksshana

Send her:
- Website link: `https://your-link.vercel.app`
- Admin link: `https://your-link.vercel.app/admin`
- Login: raksshana / raksshaas123
- WhatsApp already set to +91 90253 75687

She can now upload from her phone!

## Change Admin Password

Edit `server.js` line 9-10:
```js
const ADMIN_USER = 'raksshana';
const ADMIN_PASS = 'your-new-password';
```
Then redeploy (git push, Vercel auto-deploys).

## Need Help?

WhatsApp number is already updated everywhere. Just replace images in `images/` folder with her real Aari work photos for final version.
