# EcoThreads — Setup Guide

This guide is in simple steps. Do Part 1 once, then Part 2 on every laptop that wants to run the project.

---

## Part 1 — Database (do this once, ~5 minutes)

Your Supabase project is already connected in the code:
`https://psehpfabxnhcwvqceoqr.supabase.co`

**Step 1. Create the tables**
1. Open **supabase.com** → your project.
2. Left menu → **SQL Editor** → **New query**.
3. Open the file `database/schema.sql` from this folder, copy **everything**, paste it in.
4. Click **Run**. You should see **Success**.

**Step 2. Turn off email confirmation (important for demos)**
1. Left menu → **Authentication** → **Sign In / Providers** → **Email**.
2. Switch **Confirm email** to **OFF** → **Save**.

   *Why:* otherwise every new user must click a link in their inbox before they can sign in.

**Step 3. Check it worked**
- **Table Editor** → you'll see `items`, `orders`, `reviews` and more, filled with sample data.
- **Database → Schema Visualizer** → the ER diagram.

**Step 4. Add your teammates**
- **Organization settings → Team → Invite** → enter their emails.

---

## Part 2 — Run on your laptop

**Step 1.** Install **Node.js (LTS)** from nodejs.org (one time only).

**Step 2.** Open a terminal inside this folder and type:

```
npm install
npm run dev
```

**Step 3.** The browser opens the store at **http://localhost:3000**

**Step 4 (optional). Open the Backend Viewer** — open a **second** terminal in the same folder and type:

```
npm run backend
```

It opens **http://localhost:3001** — the live ER diagram, tables and activity feed.

> The keys are already inside the `.env` files, so nothing else to set up.

---

## Part 3 — Put it online (two public links)

**Step 1. Upload to GitHub**
1. github.com → **New repository** → name it `EcoThreads`.
2. Upload this folder (drag & drop works). Don't upload `node_modules`.

**Step 2. Deploy the store (link 1)**
1. vercel.com → sign in with GitHub → **Add New → Project** → choose `EcoThreads`.
2. Click **Deploy**. No settings needed.

**Step 3. Deploy the Backend Viewer (link 2)**
1. **Add New → Project** → choose the **same** `EcoThreads` repo again.
2. Change the project name to something like `ecothreads-backend`.
3. Next to **Root Directory**, click **Edit** → choose **`backend-viewer`**.
4. *(Optional)* **Environment Variables** → add `VITE_STORE_URL` = your store link from Step 2. This shows an "Open store" button.
5. Click **Deploy**.

**Your two links**
- 🌐 Store: `https://ecothreads-xxxx.vercel.app` → includes the **Our Impact** page (what the platform has achieved)
- 📊 Backend Viewer: `https://ecothreads-backend-xxxx.vercel.app` → live ER diagram, tables and data changes

**Step 4. Tell Supabase your website address**
- Supabase → **Authentication → URL Configuration → Site URL** → paste your Vercel link → Save.

Every time you upload changes to GitHub, Vercel updates both links automatically.

---

## Demo tip — show live updates
Open the **store** and the **Backend Viewer** side by side. List an item, add to cart, or place an order on the website — the change appears on the database page within a second (green highlight + "Live activity" feed).

---

## If something goes wrong

| What you see | What to do |
|---|---|
| "Can't reach the server" | Supabase project may be **paused** (free projects pause after ~1 week idle). Open the dashboard → **Restore project**, wait 2 minutes. |
| "Database tables are missing" | Run `database/schema.sql` again (Part 1, Step 1). |
| "Please confirm your email first" | Turn off **Confirm email** (Part 1, Step 2), or click the link in the inbox. |
| Backend Viewer says "Auto-refresh every 30 s" instead of "Live" | Realtime is blocked by the network (some college Wi-Fi). Data still updates every 30 s. |
| Page shows 404 after refresh on Vercel | Make sure `vercel.json` was uploaded. |
| Backend Viewer link shows the store instead | In that Vercel project: Settings → General → **Root Directory** must be `backend-viewer`. |

⚠️ Running `schema.sql` again **resets all data** back to the sample data. Useful before a demo — but don't do it once you have real data you want to keep.
