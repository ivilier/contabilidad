# Prompt: Architectural Specification for a Ultra-Simple Jekyll & Google Sheets Accounting & Inventory Platform

## Context & Purpose
This application is designed for a single store owner who operates strictly on a cash-only basis. The primary purpose is to provide a very simple, lightweight accounting and inventory management platform to keep track of cash flow and product stock.

# Role & Operational Goal
You are a Lead Frontend Architect and Systems Expert specializing in static site generation and serverless Jamstack architectures. Your objective is to architect the complete directory tree, core codebase, and technical deployment roadmap for a minimal accounting and inventory platform.

The application uses **Jekyll 4.3+** for its build engine, **GitHub Pages** for hosting, and **Google Sheets** (via Google Apps Script) as a headless, serverless data backend.

---

## Technical Stack & Build Constraints
* **Static Site Generator:** Jekyll 4.3+ (Ruby for build tooling, managed via Bundler/`Gemfile`).
* **Hosting Target:** GitHub Pages.
* **Languages:** HTML5, Liquid template engine, YAML (for static catalog data), and Vanilla JavaScript (ES6+ for client-side interactivity).
* **Frameworks:** NO JavaScript UI frameworks (No React, Vue, Alpine, etc.). Vanilla JS only for dynamic API interactions and state handling.
* **Styling Pipeline:** Tailwind CSS loaded strictly via CDN (`https://cdn.tailwindcss.com`).
  * No local CSS compilation step or PostCSS pipeline.
  * No `tailwind.config.js` or local build configuration required.
* **Color Palette System:**
  * **Primary Accent:** Tailwind `rose` palette.

---

## Platform Capabilities & Managed Services
The system must support and render UI modules for the store owner's daily operations:

### 1. Accounting Module
* **Daily Cash Flow Log:** Track cash transactions (Money In vs. Money Out).

### 2. Inventory Module
* **Inventory Flow Log:** Track stock movements (Product In vs. Product Out).

### 3. Store Catalog Integration
* Consume the pre-existing catalog data file located at `_data/catalog.yml`.

---

## Backend & Data Architecture

### Static Data Source
* Base catalog items, initial configuration, and pricing schemas are **already set up** in the project under `_data/catalog.yml`. 
* Liquid templates must consume `site.data.catalog` assuming standard keys (`id`, `title_es`, `description_es`, `price`, `sku`).

### Multi-Workbook Google Sheets Backend
To maintain strict domain isolation, security, and simplicity, backend operations are split across **two separate Google Sheets Workbooks**:
1. **Accounting Workbook:** Manages Daily Cash Flow Log (Money In vs. Money Out).
2. **Inventory Workbook:** Manages Inventory Flow Log (Product In vs. Product Out).

### Security, CORS & Access Control Model
* **Spreadsheet Privacy:** Both raw Google Sheet workbooks MUST remain **Private / Restricted**. Only the account owner/administrator can view or edit the workbooks directly.
* **Apps Script Web App API Bridge:**
  * **Execute as:** *Me* (Runs backend procedures using the owner's credentials).
  * **Who has access:** *Anyone* (Allows anonymous, secure API calls from the static site without exposing sheet keys).
  * **CORS & Fetch Handling:** Scripts must output JSON via `ContentService.createTextOutput()`. Client `fetch()` requests must set `{ redirect: 'follow' }` to handle Apps Script redirects properly.
* **Client-Side Security & UX:**
  * Include a hidden honeypot input field (`style="display:none"`) to discourage automated spam bots.
  * Vanilla JS handles the asynchronous user interface state: loading spinners, button disabling during submission, client-side field validation, graceful fallbacks, and success notifications.

---

## Internationalization (i18n) & Language Handling
* **Default Language:** Spanish (`<html lang="es">`).
* **Language Switcher:** A client-side UI toggle allowing users to switch between Spanish (`es`) and English (`en`).
* **Persistence & Flash Prevention:** Save language preference in `localStorage`. Place a lightweight, inline script in the `<head>` of `_layouts/default.html` to set the initial language state immediately and prevent flashes of un-translated content (FOUT).
* **UI Translation System:** 
  * Static UI elements use `data-i18n="key_name"`.
  * Maintain a JavaScript translation dictionary directly within the main layout (`_layouts/default.html`).

---

## SEO & Meta Tags
* Optimized for simple store management and product catalog display.
* Include Open Graph (`og:title`, `og:description`, `og:image`, `og:url`) and Twitter Card meta tags using Liquid logic inside `_includes/head.html` or `_layouts/default.html`.

---

## Required Technical Output
Please generate complete, production-ready code blocks and instructions for:

1. **Directory Structure:** A clean, annotated project repository view for Jekyll.
2. **`Gemfile`**: Bundler file specifying Jekyll 4.3+ and compatible GitHub Pages gems.
3. **`_layouts/default.html`**: Master layout with Tailwind CDN, SEO head, navigation, language toggle with FOUT prevention, and embedded Vanilla JS logic for i18n and Google Apps Script endpoints.
4. **`index.html`**: Core page featuring a dual layout:
   * A public-facing catalog page rendered from `_data/catalog.yml` via Liquid.
   * An internal interactive management panel for the store owner with honeypot-protected forms for cash flow and inventory logging.
5. **Google Apps Script Specifications**: Setup guide and separate script snippets (`AccountingScript.gs` and `InventoryScript.gs`) with CORS-compliant `doPost` and `doGet` handlers.