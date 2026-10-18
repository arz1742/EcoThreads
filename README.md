# EcoThreads 🌿 — Online Thrift Store

Buy, sell and donate pre-loved clothing. Built with **React + TypeScript + Vite + Tailwind**, backed by a **Supabase (PostgreSQL)** database plus a separate, read-only **Backend Viewer** app.

| Link | Folder | What it is |
|---|---|---|
| Store | `/` (this folder) | The shopping website, including the **Our Impact** page |
| Backend Viewer | `backend-viewer/` | Live ER diagram, table browser, real-time data changes |

➡️ **Setup:** see [SETUP.md](SETUP.md)

## Pages
| Page | What it does |
|---|---|
| `/` Home | Hero, live impact counters, categories, fresh arrivals, free items, recently viewed, real reviews |
| `/shop` | Search, category / type / condition / price filters, sort, active-filter chips, load more |
| `/item/:id` | Photo gallery, condition explained, seller rating & reviews, buy now, add to cart, request free item |
| `/sell` | Sell or donate form with NGO picker, drag-and-drop photos, inline validation, pricing hint, live preview |
| `/cart` | Cart with undo, free-shipping progress, CO₂ saved |
| `/checkout` | 3-step checkout (address → payment → review) with a progress stepper; simulated payment |
| `/account` | Dashboard: listings (hide/delete), orders (received → rate seller), sales, donation requests (approve/decline), reviews, profile |
| `/wishlist` | Saved items |
| `/impact` | Our Impact: items re-homed, CO₂ & water saved, community numbers, category & city breakdowns, NGO partners, recent milestones |
| `/help` | FAQ, pricing guide, safety, accessibility & shortcuts |

## Usability & accessibility features
- **Feedback & system status:** loading skeletons, toasts, checkout stepper, order progress tracker, live counts
- **Error prevention:** inline validation as you type, database rules (price, pincode, rating), can't buy own or sold items
- **Easy reversal:** Undo on cart/wishlist actions, "hide instead of delete", confirmation before deleting
- **Recognition over recall:** visible filter chips, recently viewed, breadcrumbs, live listing preview
- **Accessibility:** text-size switch, skip link, keyboard focus rings, ARIA labels, `/` shortcut to search, reduced-motion support
- **Voice search:** microphone button in the search bar (Chrome / Edge)
- **User evaluation:** "Feedback" button on every page stores ease & satisfaction ratings per page
- **Sustainability:** estimated CO₂ and water saved per item, per user and site-wide

## Database
13 tables · 19 foreign keys · 5 views · Row Level Security on every table. See `database/schema.sql`.

`categories` · `ngos` · `profiles` · `items` · `item_images` · `wishlists` · `cart_items` · `orders` · `order_items` · `donation_requests` · `reviews` · `feedback` · `activity_log`

## Scripts
```
npm install      # once
npm run dev      # start at http://localhost:3000
npm run build    # production build into /dist
npm run backend  # start the Backend Viewer at http://localhost:3001
```
