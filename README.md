# ivilier Joyería 💎 — Catálogo, Contabilidad e Inventario

Plataforma web para la tienda **ivilier Joyería**: catálogo interactivo de productos con fotografías de alta resolución, filtros avanzados y buscador, junto con un **panel privado de gestión** para el registro contable de flujo de caja y control de inventario en tiempo real.

Construido bajo una arquitectura **Jamstack serverless**, combina un sitio estático generado con Jekyll alojado en **GitHub Pages** y dos libros de **Google Sheets** como base de datos conectados a través de **Google Apps Script**.

---

## 🌟 Características Principales

### 🛍️ 1. Catálogo Público de Productos
- **Diseño visual elegante:** Estética clara, moderna y limpia con tarjetas de productos, previsualización de imágenes, códigos de referencia y precios.
- **10 Categorías de Joyería:** Aretes, Dijes, Anillos, Cadenas, Bolsos Wayuu, Arracadas, Brazalete para oreja (Ear Cuff), Pulseras, Tobilleras y Esmeraldas.
- **Filtros por tipo y conteo dinámico:** Barra lateral con selector de categorías y conteo en tiempo real del total de piezas por sección.
- **Filtro de rango de precio:** Entradas de precio mínimo y máximo para afinar la búsqueda.
- **Buscador en tiempo real:** Búsqueda instantánea por nombre del producto o por código de referencia (`R0001`, `E0001`, `pandita`, `bolsa`).
- **Ordenamiento:** Opciones para ordenar por precio (menor a mayor / mayor a menor) y por nombre (A–Z / Z–A).
- **Estructura modular de datos:** Catálogos organizados en archivos YAML independientes bajo `_data/*.yml` con imágenes asociadas en `images/*`.

### 💰 2. Módulo de Contabilidad (Caja)
- **Acceso Protegido por PIN:** Puerta de seguridad con validación en servidor contra Google Apps Script. El panel permanece bloqueado de forma predeterminada.
- **Métricas Financieras en Vivo:** Tarjetas de balance automático con *Total Ingresos (Entradas)*, *Total Egresos (Salidas)* y *Balance Neto en Caja*.
- **Registro de Movimientos:** Formulario para registrar movimientos de dinero (*Dinero Entra* / *Dinero Sale*, monto, concepto y fecha).
- **Historial de Movimientos:** Lista de transacciones recientes con botón de actualización en tiempo real (↻).

### 📦 3. Módulo de Inventario (Stock)
- **Selector Sincronizado:** Desplegable de selección que carga automáticamente todos los productos de las 10 categorías del catálogo.
- **Indicador de Stock en Vivo:** Al seleccionar cualquier pieza, el panel muestra la disponibilidad actual de existencias calculada desde Google Sheets.
- **Registro de Movimientos de Stock:** Formulario para registrar entradas y salidas de mercancía con cantidad, notas y fecha.
- **Historial de Movimientos de Inventario:** Lista de movimientos recientes con códigos de producto, conceptos y cantidades.

### 🌐 4. Internacionalización (i18n)
- Conmutador de idioma **Español (predeterminado) / Inglés** sin recargar la página.
- Persistencia de preferencia en `localStorage` con script en `<head>` para prevenir parpadeos (FOUT).

### 🛡️ 5. Seguridad, Privacidad y Rendimiento
- **Cero Secretos en Git:** La clave maestra (`AUTH_TOKEN`) nunca se almacena en el frontend ni en GitHub; se guarda exclusivamente en las *Propiedades del Script* (*Script Properties*) de tu cuenta privada de Google.
- **Protección contra Fuerza Bruta (3 Intentos & Cuenta Regresiva de 15 Minutos):** Si se registran **3 intentos fallidos**, el sistema bloquea el acceso temporalmente por 15 minutos. El panel muestra un **temporizador de cuenta regresiva en vivo (`MM:SS`)** y se rehabilita automáticamente al llegar a cero.
- **Sanitización contra Inyección de Fórmulas:** Neutralización automática de caracteres de escape y fórmulas (`=`, `+`, `-`, `@`) en descripciones y notas antes de guardarse en Google Sheets.
- **Acceso Discreto al Panel (Oculto al Público):** El botón de acceso al panel permanece invisible para clientes y visitantes. Solo tú puedes invocarlo mediante:
  - **Triple clic rápido en el logo 💎** de la tienda.
  - **Atajo de teclado:** `Ctrl + Shift + A` / `Cmd + Shift + A` o `Alt + P`.
- **Navegación Dinámica:** Una vez desbloqueado con el PIN, el botón "Panel" aparece en el menú para alternar fácilmente entre la tienda y la administración.
- **Cierre Automático por Inactividad:** Cierre de sesión y bloqueo automático tras **30 minutos sin actividad** en la pestaña.
- **Almacenamiento Efímero (`sessionStorage`):** La sesión solo vive en la memoria de la pestaña activa y se destruye al cerrar el navegador o pulsar "Bloquear".
- **Honeypots anti-spam:** Campos trampa ocultos para neutralizar bots automatizados.
- **Hojas 100% Privadas:** Google Sheets permanece completamente cerrado al público.
- **Costo Cero & Ultra Rápido:** Arquitectura Jamstack serverless de alto rendimiento.

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología | Descripción |
|---|---|---|
| **Generador Estático** | [Jekyll 4.3+](https://jekyllrb.com/) | Plantillas Liquid y generación de HTML estático. |
| **Frontend** | Vanilla JavaScript (ES6+) | Lógica de cliente, i18n, validaciones y peticiones `fetch`. |
| **Estilos** | [Tailwind CSS](https://tailwindcss.com/) (CDN) | Paleta refinada en tonos claros y neutros a juego con la tienda. |
| **Tipografía** | Google Fonts (Inter) | Tipografía limpia y moderna. |
| **Backend / API** | [Google Apps Script](https://developers.google.com/apps-script) | Endpoints web (`doPost` / `doGet`) para procesar transacciones. |
| **Base de Datos** | [Google Sheets](https://www.google.com/sheets/about/) | Dos libros privados: `Contabilidad - Caja` e `Inventario`. |
| **CI/CD & Hosting** | GitHub Actions & GitHub Pages | Despliegue automatizado al hacer push a `main`. |

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
│   └── default.html         # Plantilla maestra: cabecera, navegación, footer, scripts globales
│
├── _includes/
│   └── products.html        # Componente del catálogo con filtros y cuadrícula de productos
│
├── _data/                   # Archivos de datos del catálogo (YAML)
│   ├── anillos.yml
│   ├── aretes.yml
│   ├── arracadas.yml
│   ├── bolsas.yml
│   ├── cadenas.yml
│   ├── dijes.yml
│   ├── ear_cuff.yml
│   ├── esmeraldas.yml
│   ├── pulseras.yml
│   └── tobilleras.yml
│
├── images/                  # Fotografías de productos organizadas por categoría
│   ├── anillos/
│   ├── aretes/
│   ├── arracadas/
│   ├── bolsas/
│   ├── cadenas/
│   ├── dijes/
│   ├── ear_cuff/
│   ├── esmeraldas/
│   ├── pulseras/
│   └── tobilleras/
│
├── _docs/                   # Scripts de backend y guías (excluidos del build)
│   ├── AccountingScript.gs  # Google Apps Script para el libro de caja
│   ├── InventoryScript.gs   # Google Apps Script para el libro de inventario
│   └── SETUP.md             # Guía paso a paso de despliegue y configuración
│
└── .github/
    └── workflows/
        └── deploy.yml       # Flujo de CI/CD para compilar y desplegar en GitHub Pages
```

---

## 🚀 Inicio Rápido (Desarrollo Local)

### Prerrequisitos
- **Ruby** (versión ≥ 3.1)
- **Bundler** (`gem install bundler`)
- **Git**

### Instalación y Ejecución

1. **Instalar dependencias:**
   ```bash
   bundle install
   ```

2. **Iniciar el servidor local con recarga en vivo:**
   ```bash
   bundle exec jekyll serve --livereload
   ```

3. Abrir en el navegador: [http://localhost:4000/](http://localhost:4000/) (o [http://localhost:4000/contabilidad/](http://localhost:4000/contabilidad/) según la configuración de `baseurl`).

---

## ⚙️ Configuración del Backend y Despliegue

1. **Crear las Hojas de Cálculo y desplegar Apps Script:**
   - Sigue las instrucciones detalladas en [`_docs/SETUP.md`](./_docs/SETUP.md).
   - Copia el código de [`_docs/AccountingScript.gs`](./_docs/AccountingScript.gs) en el libro de Contabilidad.
   - Copia el código de [`_docs/InventoryScript.gs`](./_docs/InventoryScript.gs) en el libro de Inventario.
   - Configura tu clave en `AUTH_TOKEN` (o en *Script Properties* de Apps Script).
   - Despliega ambos como **Web App** con acceso para *Cualquiera (Anyone)*.

2. **Vincular las URLs en el frontend:**
   - Edita [`_layouts/default.html`](./_layouts/default.html) y coloca las URLs en la constante `SCRIPT_URLS`:
     ```javascript
     const SCRIPT_URLS = {
       accounting: "https://script.google.com/macros/s/.../exec",
       inventory:  "https://script.google.com/macros/s/.../exec",
     };
     ```

## 🔄 Sincronización Automática con Archivos YAML (`_data/*.yml`)

Cuando agregues o elimines productos en Google Sheets, los archivos `_data/*.yml` se mantienen sincronizados automáticamente:

1. **Sincronización manual en tu computadora:**
   ```bash
   ruby scripts/sync_inventory_to_yaml.rb
   ```
   *(Consulta Google Sheets, crea los productos nuevos, borra los eliminados y actualiza precios/nombres en todos los archivos `.yml` de `_data/`)*.

2. **Sincronización automática en GitHub Actions:**
   - **En cada despliegue:** Antes de compilar el sitio en GitHub Pages, el flujo `.github/workflows/deploy.yml` ejecuta la sincronización para construir el sitio con los datos más recientes.
   - **Flujo programado:** El flujo `.github/workflows/sync-inventory.yml` se ejecuta periódicamente y actualiza los archivos `.yml` en el repositorio automáticamente.

---

## 📖 Documentación Adicional

- [Guía completa de configuración y despliegue (`_docs/SETUP.md`)](./_docs/SETUP.md)