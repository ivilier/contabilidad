# Deployment & Setup Guide

This guide walks you through every step needed to get the Jekyll site live on GitHub Pages and the two Google Sheets backends wired up.

---

## Prerequisites

| Tool | Version | How to check |
|---|---|---|
| Ruby | ≥ 3.1 | `ruby -v` |
| Bundler | any | `bundler -v` (install: `gem install bundler`) |
| Git | any | `git --version` |
| GitHub account | — | github.com |
| Google account | — | For Google Sheets + Apps Script |

---

## Part 1 — Local Development

### 1.1 Install Ruby gems

```bash
cd /path/to/contabilidad
bundle install
```

### 1.2 Start the development server

```bash
bundle exec jekyll serve --livereload
```

Open `http://localhost:4000` in your browser.

> **Tip:** The management panel forms will show a network error when you submit (because the Apps Script URLs are placeholders). This is expected at this stage — everything else should work.

---

## Part 2 — Google Sheets Setup (repeat for both workbooks)

You will create **two separate** Google Sheets workbooks and deploy **one Apps Script** in each.

### 2.1 Create the Accounting Workbook

1. Go to [sheets.new](https://sheets.new) — a new Google Sheets workbook opens.
2. Rename it: click the title ("Untitled spreadsheet") → type **`Contabilidad - Caja`**.
3. Leave the sheet open.

### 2.2 Deploy AccountingScript.gs

1. In the Accounting workbook, click **Extensions → Apps Script**.
2. Delete all existing code in `Code.gs`.
3. Copy the entire contents of [`_docs/AccountingScript.gs`](./_docs/AccountingScript.gs) and paste it.
4. Click **💾 Save project** (or `Ctrl+S`).
5. Click **Deploy → New deployment**.
6. Click the ⚙️ gear icon next to "Select type" → choose **Web app**.
7. Fill in the settings:
   - **Description:** `Accounting API v1`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
8. Click **Deploy**.
9. When prompted, click **Authorize access** and grant the requested permissions.
10. **Copy the Web App URL** — it looks like:
    ```
    https://script.google.com/macros/s/AKfycb.../exec
    ```
    You will need this in Part 3.

### 2.3 Create the Inventory Workbook

Repeat the exact same steps (2.1–2.2) but:
- Name the workbook **`Contabilidad - Inventario`**
- Paste [`_docs/InventoryScript.gs`](./_docs/InventoryScript.gs) instead

Keep both Web App URLs handy.

### 2.4 Verify the scripts work (optional but recommended)

Test the GET endpoint in your browser:

```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?limit=5
```

You should see:
```json
{ "status": "ok", "rows": [], "total": 0 }
```

---

## Part 3 — Wire Scripts into the Site

Open [`_layouts/default.html`](./_layouts/default.html) and find the `SCRIPT_URLS` constant near the top of the `<script>` block:

```js
const SCRIPT_URLS = {
  accounting: "YOUR_ACCOUNTING_SCRIPT_URL",  // ← paste here
  inventory:  "YOUR_INVENTORY_SCRIPT_URL",   // ← paste here
};
```

Replace both placeholder strings with the Web App URLs from Part 2.

While you're there, optionally change the owner PIN (default is `1234`):

```js
const ACCESS_PIN = "1234";  // ← change to something memorable
```

---

## Part 4 — GitHub Pages Deployment

### 4.1 Create the GitHub repository

1. Go to [github.com/new](https://github.com/new).
2. Repository name: `contabilidad` (or any name you prefer).
3. Set visibility to **Private** (recommended — your store data stays private).
4. Click **Create repository**.

### 4.2 Update `_config.yml`

Open [`_config.yml`](./_config.yml) and update:

```yaml
url: "https://YOUR-USERNAME.github.io"
baseurl: "/contabilidad"   # Use "" if this IS your username.github.io repo
```

### 4.3 Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Jekyll accounting & inventory platform"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/contabilidad.git
git push -u origin main
```

### 4.4 Enable GitHub Pages via GitHub Actions

1. In your repository on GitHub, go to **Settings → Pages**.
2. Under **Source**, select **GitHub Actions**.
3. Go to **Actions** tab — you should see the `Deploy Jekyll to GitHub Pages` workflow running automatically.
4. Once it turns green (✅), your site is live at:
   ```
   https://YOUR-USERNAME.github.io/contabilidad/
   ```

---

## Part 5 — Post-Deployment Testing

### Catalog
- [ ] All products from `_data/catalog.yml` appear in the grid
- [ ] Category filter tabs correctly filter by `aretes`, `dijes`, `anillos`, `collares`, `bolsas`
- [ ] "No hay productos" message appears when a category is empty

### Language Toggle
- [ ] Clicking EN/ES switches all UI strings immediately (no reload)
- [ ] Refreshing the page preserves the last selected language

### Owner Panel
- [ ] Wrong PIN shows error, does not unlock
- [ ] Correct PIN (default `1234`) unlocks the panel
- [ ] "Bloquear" button re-locks the panel

### Accounting Form
- [ ] Submitting empty form shows inline validation errors
- [ ] Selecting Money In / Money Out highlights the correct direction card
- [ ] Successful submit shows ✓ green toast and resets the form
- [ ] New row appears in the **CashFlow** sheet in the Accounting workbook

### Inventory Form
- [ ] Product dropdown lists all catalog items with ref codes and prices
- [ ] Submitting empty form shows inline validation errors
- [ ] Successful submit shows ✓ green toast and resets the form
- [ ] New row appears in the **InventoryLog** sheet in the Inventory workbook

---

## Updating the Catalog

To add, remove, or change products, edit [`_data/catalog.yml`](./_data/catalog.yml).

- **Activate a product:** Uncomment its block (remove `#` prefixes)
- **Disable a product:** Comment it out with `#`
- **Add a new product:** Append a new YAML block at the end:

```yaml
- ref_code: "E0099"
  description: "Nuevo Arete"
  price: "$15"
  category: "aretes"
```

Then commit and push — GitHub Actions rebuilds and redeploys automatically.

---

## Updating the Apps Script

If you need to change the script logic:

1. Open the Apps Script editor (Extensions → Apps Script in the workbook).
2. Make your changes.
3. Go to **Deploy → Manage deployments**.
4. Click ✏️ Edit on the current deployment.
5. Change "Version" to **New version**.
6. Click **Deploy**.

> **Important:** Do NOT create a brand-new deployment — the URL would change and you'd need to update `_layouts/default.html` again. Always update the *existing* deployment with a new version.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Forms show network error | Script URL is wrong or placeholder | Re-check `SCRIPT_URLS` in `default.html` |
| Forms show `error_msg` toast | Script rejected the payload | Check Apps Script Execution Log (View → Execution log) |
| Catalog empty on GitHub Pages | Build failed | Check the Actions tab for red ❌ logs |
| Products in wrong category | `category` value typo in `catalog.yml` | Must be exactly: `aretes`, `dijes`, `anillos`, `collares`, or `bolsas` |
| Language not switching | `localStorage` blocked | Try in a private/incognito window |
| Date field invisible | Browser color-scheme issue | Reported on some older Firefox — use Chrome/Safari |
