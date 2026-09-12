# 🎯 Bountyrunner — Real-Time Cyberpunk GPS Battle Game

A mobile-first, geofenced real-time hide-and-seek battle game built with React, Leaflet, Tailwind CSS, Express, and Drizzle ORM.

---

## 🚀 Quick Launch to Web with GitHub & Vercel

### 1. Push to GitHub
If you haven't created the repository on GitHub yet:
1. Go to [github.com/new](https://github.com/new) and create a repository called `Bountyrunner` (public or private).
2. Run these commands in your project folder:
```bash
git remote add origin https://github.com/<YOUR-GITHUB-USERNAME>/Bountyrunner.git
git push -u origin main
```

### 2. Deploy on Vercel
1. Go to [vercel.com/new](https://vercel.com/new) (sign in with GitHub).
2. Click **Import** next to your `Bountyrunner` repository.
3. Click **Deploy**!
*(Vercel automatically detects the Vite frontend and the `/api` serverless backend via `vercel.json` and `api/index.ts`).*

### 3. Optional: Add a Cloud Database
By default, Bountyrunner runs in **In-Memory Mode** out of the box with zero configuration!
If you want persistent scores, user accounts, and match histories across serverless cold starts:
- In your Vercel Dashboard, go to **Settings > Environment Variables**.
- Add `DATABASE_URL` with your PostgreSQL connection string (from Neon, Supabase, or Vercel Postgres).

