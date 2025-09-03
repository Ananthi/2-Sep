Deploying the Dashboard

Overview
- This is a Vite + React (TypeScript) single-page app that builds to static files in `dist/`.
- You can host it on any static hosting: GitHub Pages, Netlify, Vercel, S3/CloudFront, Azure Static Web Apps, etc.

Prerequisites
- Node.js 18+ and npm installed locally.

Build locally
1. `cd dashboard`
2. `npm ci` (or `npm install`)
3. `npm run build`
4. Preview locally with `npm run preview` (serves `dist/`).

Option A: GitHub Pages (auto-deploy)
1. Ensure your default branch is `main` and the app is under `dashboard/` at the repo root (as in this project).
2. Push this repo to GitHub.
3. In GitHub, enable Pages: Settings → Pages → Build and deployment → Source: GitHub Actions.
4. The included workflow `.github/workflows/deploy-gh-pages.yml` builds and publishes on every push to `main`.
5. The site will be available at `https://<your-username>.github.io/<repo>/`.

Note on base path
- The Vite config reads `VITE_BASE`. The GitHub Actions workflow sets it to `"/<repo>/"` so assets resolve correctly from the subpath.
- If you host at root (e.g., custom domain), keep base as `/`.

Option B: Netlify
1. Install the Netlify CLI (optional): `npm i -g netlify-cli`.
2. `cd dashboard`
3. `netlify init` (link to a team/site) and then `netlify deploy --build --prod`.
   - Build command: `npm run build`
   - Publish directory: `dist`
4. The `netlify.toml` is included and sets `VITE_BASE` to `/`.

Option C: Vercel
1. Push repo to GitHub.
2. Import the repo in Vercel dashboard.
3. Framework preset: Vite.
4. Build command: `npm run build` and Output directory: `dist`.
5. No special base needed if deploying at root.

Troubleshooting
- White screen/404 for assets on GitHub Pages typically means the base path is wrong. Ensure `VITE_BASE` matches `"/<repo>/"` at build time.
- If using a custom domain or Netlify/Vercel root, use base `/` (default).

