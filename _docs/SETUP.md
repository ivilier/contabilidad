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
4. **Configure your Secret PIN / Auth Token:**
   - In Apps Script, go to **Project Settings** (⚙️ on the left menu) → scroll down to **Script Properties** (*Propiedades de la secuencia de comandos*).
   - Click **Add script property** (*Agregar propiedad de secuencia de comandos*).
   - **Property:** `AUTH_TOKEN`
   - **Value:** Your private PIN or password (e.g. `%Foxman01` or your private key).
   - Click **Save script properties**.
5. Click **💾 Save project** (or `Ctrl+S`).
6. Click **Deploy → New deployment** (or *Manage deployments → Edit → New version*).
7. Select type **Web app**.
8. Fill in the settings:
   - **Description:** `Accounting API v1`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
9. Click **Deploy**.
10. When prompted, click **Authorize access** and grant the requested permissions.
11. **Copy the Web App URL** — it looks like:
    ```
    https://script.google.com/macros/s/AKfycb.../exec
    ```
    You will need this in Part 3.

### 2.3 Create the Inventory Workbook

Repeat the exact same steps (2.1–2.2) in your **`Contabilidad - Inventario`** spreadsheet:
- Paste [`_docs/InventoryScript.gs`](./_docs/InventoryScript.gs) into `Code.gs`.
- In **Project Settings (⚙️) → Script Properties**, set the **exact same** `AUTH_TOKEN`.
- Deploy as **Web app** with `Execute as: Me` and `Who has access: Anyone`.
- *(Optional / Recommended)* To immediately initialize the 10 category tabs with colors and headers, select `initializeAllCategoryTabs` in the top bar of Apps Script and click **Run**. If you have existing data in `InventoryLog`, run `migrateExistingRowsToCategoryTabs` to distribute records.

Keep both Web App URLs handy.

### 2.4 Security & Rate Limiting Features

- **Rate Limiting & Countdown:** Apps Script permits up to **3 consecutive failed authorization attempts**. If exceeded, access is temporarily locked for 15 minutes and the frontend automatically displays a live countdown timer (`MM:SS`), re-enabling access once expired.
- **Manual Lock Reset (`resetSecurityLock`):** If you ever need to manually clear the lockout or reset the failure counter, select the `resetSecurityLock` function in Apps Script's top toolbar and click **Run**.
- **Formula Injection Protection:** Text inputs are automatically sanitized to prevent malicious spreadsheet formula execution.

---

## Part 3 — Wire Scripts into the Site & Accessing the Panel

Open [`_layouts/default.html`](./_layouts/default.html) and check the `SCRIPT_URLS` constant near the top of the `<script>` block:

```js
const SCRIPT_URLS = {
  accounting: "YOUR_ACCOUNTING_SCRIPT_URL",  // ← paste here
  inventory:  "YOUR_INVENTORY_SCRIPT_URL",   // ← paste here
};
```

### 🔒 Discreet Panel Access

The "Panel" navigation button is **hidden from public store visitors by default**.

To access the management panel as the store owner:
1. **Triple-click the logo 💎:** Click 3 times rapidly on the brand logo at the top left.
2. **Keyboard Shortcut:** Press `Ctrl + Shift + A` (Windows/Linux), `Cmd + Shift + A` (Mac), or `Alt + P`.
3. **Session Auto-Lock:** The panel automatically locks and clears credentials after **30 minutes of inactivity**.

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

## Updating the Catalog & Adding New Products

There are two ways to manage catalog products:

### Method 1: Directly in Google Sheets (Recommended & Automatic) 🚀
1. Open your **`Contabilidad - Inventario`** spreadsheet in Google Sheets.
2. Go to the tab of the corresponding category (e.g. **Aretes**, **Anillos**, **Bolsas**, etc.).
3. Add a new row with:
   - `Direction`: `IN`
   - `Ref Code`: e.g. `E0120`
   - `Description`: e.g. `Broquel Estrella Circonias`
   - `Price`: e.g. `$30`
   - `Category`: e.g. `aretes`
   - `Quantity`: Initial stock (e.g. `5`)
   - `Notes`: e.g. `Nuevo ingreso`
   - `Date`: e.g. `2026-08-28`
   - `Foto`: `=IMAGE("https://raw.githubusercontent.com/ivilier/contabilidad/main/images/aretes/E0120.jpg")` (or let formula autocomplete)
4. Save the product's photo into `/images/{category}/{REF_CODE}.jpg` (e.g. `images/aretes/E0120.jpg`).
5. Run:
   ```bash
   git add images/
   git commit -m "Add photo E0120"
   git push
   ```
6. The product will immediately appear in the store's web catalog and in the management panel!

### Method 2: Static YAML Files (Build Time)
Edit the category YAML file in `_data/{category}.yml` (e.g. `_data/aretes.yml`).
Append:
```yaml
- ref_code: "E0120"
  description: "Broquel Estrella Circonias"
  price: "$30"
```

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
