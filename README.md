# Sala Group — Sistema de información y gestión

ERP de Sala Group (Shell · DSB Asociados, YPF · Combustibles Magdalena, Alvemem Tolosa y Olmos) publicado en **Firebase**,
con ingreso por usuario y contraseña, permisos controlados en el servidor, base de datos persistente, respaldos diarios
y sincronización de solo lectura con la carpeta **ESTACIONES** de Google Drive.

Dirección: `https://erp-sala-group.web.app` (HTTPS, la da Firebase Hosting).

## Cómo está armado

| Parte | Dónde | Qué hace |
|---|---|---|
| Pantalla de acceso, bienvenida y adaptadores | `src/shell/` | Ingreso, cambio obligatorio de contraseña provisoria, cierre por 30 min de inactividad, conexión con Firestore |
| ERP | `src/erp/` | Módulos, tableros, cálculos y formularios (mismo código y diseño del tablero original) |
| Reglas de seguridad | `firestore.rules`, `storage.rules` | Qué puede leer y escribir cada perfil; lo hace cumplir Google, no la pantalla |
| Funciones del servidor | `functions/` | Usuarios, contraseñas, registro de accesos, auditoría, respaldo diario, sincronización de Drive |
| Publicación | `.github/workflows/` | Prueba y publica en cada cambio de `main`; preparación inicial del proyecto |

### Perfiles

| Perfil | Puede |
|---|---|
| **Administrador** | Todo: registros, configuración, usuarios, importación de datos, Drive, registro de accesos y auditoría |
| **Gerencia** | Ver todo; dar de alta, modificar y dar de baja registros. No administra usuarios ni configuración |
| **Consulta** | Solo lectura |

Hernán, Javier y Christian se crean como **Administrador**.

### Seguridad

- Contraseñas guardadas cifradas por Firebase Authentication (nadie puede verlas). Mínimo 10 caracteres con letras y números,
  sin el usuario ni el nombre.
- Contraseña provisoria → cambio obligatorio en el primer ingreso; hasta entonces las reglas no dejan leer ningún dato.
- El perfil viaja en la credencial firmada (custom claim) y solo lo cambian las funciones del servidor.
- Sesión por pestaña del navegador y cierre automático tras 30 minutos sin actividad.
- Registro de accesos (`accesos`) y auditoría de cada alta, modificación y baja con la persona que la hizo (`auditoria`);
  en una baja se guarda el registro completo.
- Adjuntos privados en Firebase Storage: se abren con la sesión de la persona, nunca con enlaces públicos.
- Los datos de la empresa **no** se guardan en este repositorio.

## Puesta en marcha (una sola vez)

1. **Proyecto de Firebase** — en <https://console.firebase.google.com> proyecto `erp-sala-group`
   (para usar otro, cargarlo como variable `FIREBASE_PROJECT` en GitHub → Settings → Secrets and variables → Actions → Variables).
   - Plan **Blaze** (pago por uso; para este volumen el costo esperado es de centavos o nulo, pero lo exigen las funciones y los respaldos).
   - Authentication → Método de acceso → habilitar **Correo electrónico/contraseña**.
   - Firestore Database → crear en modo producción, ubicación **southamerica-east1 (São Paulo)**.
   - Storage → crear, misma ubicación.
2. **Publicación sin claves** — GitHub Actions entra a Google con Workload Identity Federation (pool `github-pool`)
   como la cuenta `github-deploy@erp-sala-group.iam.gserviceaccount.com`; no hay claves JSON guardadas.
3. **Contraseña provisoria** — crear el secreto `CLAVE_INICIAL` con una contraseña provisoria (10+ caracteres, letras y números).
   Es la que van a usar Hernán, Javier y Christian la primera vez; el sistema los obliga a cambiarla.
4. **Preparar** — GitHub → Actions → *Preparar proyecto (una sola vez)* → *Run workflow*. Habilita las APIs, crea el depósito de
   respaldos y los tres usuarios. El resumen de la ejecución muestra el correo de la **cuenta del servidor**.
5. **Drive** — compartir la carpeta ESTACIONES, como **Lector**, con ese correo de cuenta de servicio
   (lo tiene que hacer la cuenta dueña de la carpeta).
6. **Publicar** — GitHub → Actions → *Publicar* → *Run workflow* (después se publica solo con cada cambio en `main`).
7. **Datos** — ingresar como Administrador → Administración → Configuración → *Importar datos* y elegir el paquete
   `salagroup-datos.json` (planillas del tablero actual). Después, *Sincronizar ahora* en Google Drive.

Usuarios: `hernan`, `javier`, `christian`. Nuevos usuarios y contraseñas provisorias se gestionan desde
Administración → Configuración → Usuarios y permisos.

## Desarrollo local

Requiere Node 22 y Java 21 (emuladores).

```bash
npm ci && npm ci --prefix functions
npm test                 # pruebas del servidor
npm run emuladores       # arma public/ y levanta Firebase local en http://127.0.0.1:5000
```

Con los emuladores corriendo, crear usuarios locales y correr la prueba de punta a punta:

```bash
cd functions && FIREBASE_PROJECT=demo-salagroup GCLOUD_PROJECT=demo-salagroup FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 CLAVE_INICIAL=Provisoria2026x node scripts/usuarios-iniciales.js
```

```bash
CLAVE_INICIAL=Provisoria2026x DATOS=/ruta/salagroup-datos.json npm run e2e
```

## Respaldos

- Automático: exportación completa de Firestore todos los días a las 03:17 (Buenos Aires) a `gs://<proyecto>-respaldos`, con 30 días de retención.
- Manual: Administración → Configuración → *Descargar copia completa (JSON)*; se puede volver a importar.
- Restaurar un respaldo automático: `gcloud firestore import gs://<proyecto>-respaldos/firestore/<fecha>`.
