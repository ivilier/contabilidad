# ivilier - Catálogo, Contabilidad e Inventario

Plataforma web ligera para la gestión de catálogo de productos, registro contable de flujo de caja y control de inventario de **ivilier** (joyería fina, aretes, dijes, anillos, collares y bolsas).

Diseñada bajo una arquitectura **Jamstack serverless**, combina un sitio estático generado con Jekyll alojado en **GitHub Pages** y dos hojas de cálculo de **Google Sheets** que actúan como base de datos a través de **Google Apps Script**.

---

## 🌟 Características Principales

- **Catálogo Público de Productos:**
  - Visualización moderna y adaptable (responsive) para clientes con modo oscuro y diseño *glassmorphism*.
  - **Buscador en tiempo real:** Búsqueda instantánea por nombre o código de referencia (`E0001`, `pandita`, `bolsa`).
  - **Filtros combinados:** Filtrado por categoría (`aretes`, `dijes`, `anillos`, `collares`, `bolsas`) integrado con la barra de búsqueda.
  - Datos desacoplados y gestionados desde un archivo YAML (`_data/catalog.yml`).

- **Módulo de Contabilidad (Caja Chica):**
  - Panel interno protegido mediante código PIN.
  - **Métricas financieras en vivo:** Visualización automática de *Total Ingresos*, *Total Egresos* y *Balance Neto en Caja*.
  - **Historial reciente:** Consulta inmediata de los últimos movimientos de caja sin salir de la plataforma.
  - Registro de movimientos de efectivo: **Entradas** (ventas, otros ingresos) y **Salidas** (gastos, proveedores, retiros).
  - Envío asíncrono y almacenamiento directo en Google Sheets.

- **Módulo de Inventario:**
  - **Stock disponible en tiempo real:** Indicador dinámico de existencias al seleccionar cualquier producto del catálogo.
  - **Historial de movimientos de stock:** Registro visual de entradas y salidas recientes con notas y fechas.
  - Registro de movimientos: **Entradas** (compras, devoluciones) y **Salidas** (ventas, mermas, ajustes).
  - Selección de productos sincronizada con el catálogo.

- **Soporte Bilingüe (i18n):**
  - Conmutador de idioma Español (predeterminado) / Inglés en tiempo real sin recargar la página.
  - Persistencia de preferencia en `localStorage` y prevención de parpadeo (FOUT).

- **Optimización SEO y Redes Sociales:**
  - Metaetiquetas Open Graph y Twitter Card con imagen de previsualización social (`assets/og-image.png`).

- **Sin Servidor Ni Base de Datos Dedicada:**
  - Costo cero de infraestructura y mantenimiento mínimo.

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología | Descripción |
|---|---|---|
| **Generador Estático** | [Jekyll 4.3+](https://jekyllrb.com/) | Plantillas Liquid y generación de HTML estático. |
| **Frontend** | Vanilla JavaScript (ES6+) | Lógica de cliente, i18n, validaciones y peticiones `fetch`. |
| **Estilos** | [Tailwind CSS](https://tailwindcss.com/) (CDN) | Estilizado moderno con paleta personalizada (acento `rose`). |
| **Tipografía** | Google Fonts (Inter) | Tipografía limpia y moderna. |
| **Backend / API** | [Google Apps Script](https://developers.google.com/apps-script) | Endpoints web (`doPost` / `doGet`) para procesar transacciones. |
| **Base de Datos** | [Google Sheets](https://www.google.com/sheets/about/) | Dos libros de cálculo privados: `Contabilidad - Caja` e `Inventario`. |
| **CI/CD & Hosting** | GitHub Actions & GitHub Pages | Despliegue automatizado al hacer push a la rama `main`. |

---

## 📁 Estructura del Proyecto

```text
contabilidad/
├── _config.yml              # Configuración del sitio Jekyll (título, baseurl, plugins, exclusiones)
├── Gemfile                  # Dependencias de Ruby (Jekyll, webrick, jekyll-sitemap)
├── Gemfile.lock             # Versiones fijadas de las gemas
├── index.html               # Página principal (Catálogo público + Panel de gestión con PIN)
│
├── _layouts/
│   └── default.html         # Plantilla maestra: SEO, Tailwind CDN, i18n, toasts y scripts globales
│
├── _data/
│   └── catalog.yml          # Catálogo de productos (ref_code, description, price, category)
│
├── _docs/                   # Guías y scripts de backend (excluidos del build de Jekyll)
│   ├── AccountingScript.gs  # Código Apps Script para el libro de contabilidad (caja)
│   ├── InventoryScript.gs   # Código Apps Script para el libro de inventario
│   └── SETUP.md             # Guía paso a paso de despliegue y configuración
│
├── .github/
│   └── workflows/
│       └── deploy.yml       # Flujo de CI/CD para compilar y desplegar en GitHub Pages
│
└── .kiro/
    └── steering/            # Reglas y especificaciones del proyecto (producto, estructura, tech)
```

---

## 🚀 Inicio Rápido (Desarrollo Local)

### Prerrequisitos
- **Ruby** (versión ≥ 3.1)
- **Bundler** (`gem install bundler`)
- **Git**

### Instalación y Ejecución

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/TU-USUARIO/contabilidad.git
   cd contabilidad
   ```

2. **Instalar dependencias de Ruby:**
   ```bash
   bundle install
   ```

3. **Iniciar el servidor local con recarga en vivo:**
   ```bash
   bundle exec jekyll serve --livereload
   ```

4. Abrir en el navegador: [http://localhost:4000/contabilidad/](http://localhost:4000/contabilidad/) (o [http://localhost:4000/](http://localhost:4000/) según el `baseurl`).

---

## ⚙️ Configuración del Backend y Despliegue

Para poner en funcionamiento los formularios de Contabilidad e Inventario:

1. **Crear las Hojas de Cálculo y desplegar Apps Script:**
   - Sigue las instrucciones detalladas en [`_docs/SETUP.md`](./_docs/SETUP.md).
   - Copia el código de [`_docs/AccountingScript.gs`](./_docs/AccountingScript.gs) en el libro de Contabilidad.
   - Copia el código de [`_docs/InventoryScript.gs`](./_docs/InventoryScript.gs) en el libro de Inventario.
   - Despliega ambos como **Web App** con acceso para *Cualquiera (Anyone)*.

2. **Vincular las URLs en el frontend:**
   - Edita [`_layouts/default.html`](./_layouts/default.html) y coloca las URLs generadas en la constante `SCRIPT_URLS`:
     ```javascript
     const SCRIPT_URLS = {
       accounting: "TU_URL_DE_APPS_SCRIPT_CONTABILIDAD",
       inventory:  "TU_URL_DE_APPS_SCRIPT_INVENTARIO",
     };
     ```
   - Si deseas cambiar el PIN de acceso al panel de administración (por defecto `1234`), modifica `ACCESS_PIN` en el mismo archivo.

3. **Configurar `_config.yml`:**
   - Ajusta `url` y `baseurl` con los datos de tu repositorio de GitHub Pages.

4. **Desplegar en GitHub Pages:**
   - Haz push a la rama `main`.
   - En tu repositorio de GitHub, ve a **Settings → Pages** y selecciona **GitHub Actions** como fuente.

---

## 📦 Gestión del Catálogo de Productos

Los productos se definen en [`_data/catalog.yml`](./_data/catalog.yml). Para añadir un nuevo producto, simplemente agrega una entrada con el siguiente formato:

```yaml
- ref_code: "E0010"
  description: "Aretes Colgantes Dorados"
  price: "$25"
  category: "aretes"
```

> **Categorías permitidas:** `aretes`, `dijes`, `anillos`, `collares`, `bolsas`.

---

## 📖 Documentación Adicional

- [Guía completa de configuración y despliegue (`_docs/SETUP.md`)](./_docs/SETUP.md)
- [Especificaciones de producto (`.kiro/steering/product.md`)](./.kiro/steering/product.md)
- [Estructura del proyecto (`.kiro/steering/structure.md`)](./.kiro/steering/structure.md)
- [Stack tecnológico y restricciones (`.kiro/steering/tech.md`)](./.kiro/steering/tech.md)