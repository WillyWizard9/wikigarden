# WikiGarden · Cymara × ALIAT

Guía interactiva de control de inventario para garden centers, creada con Astro Starlight y desplegada en Vercel.

## Experiencia actual (demostración)

- La ruta `/acceso/` muestra un formulario de usuario y contraseña **sin autenticar**: cualquier combinación permite entrar.
- El nombre del usuario se guarda en `sessionStorage`; los pasos completados, medallas y resultados del test se guardan en `localStorage` del navegador.
- Esta interfaz **no protege contenido, no identifica usuarios y no sincroniza progreso entre dispositivos**. No publiques datos privados basándote en esta pantalla.
- Cinco retos con progreso en cinco etapas y medallas; examen de 15 preguntas; autodiagnóstico de 25 preguntas.
- Formulario comercial disponible mediante `/api/contact`: requiere `RESEND_API_KEY` y `RESEND_FROM_EMAIL` configurados en Vercel para enviar realmente a info@cymara.es.
- Si `WIKI_REQUIRE_AUTH=true`, se mantiene activo el middleware de autenticación real mediante Supabase: la pantalla de demostración **no sustituye** esa verificación. Para usar solamente la demostración, esta variable debe estar desactivada.

## Integración real de acceso mediante Supabase (opcional)

## Editar el contenido

Cada página es un archivo Markdown en `src/content/docs/`. Edítalo en GitHub y Vercel publica el cambio en un minuto. El menú lateral se define en `astro.config.mjs`.

## Cómo funciona el acceso

- El acceso está temporalmente abierto. Cuando se configure Supabase, definir `WIKI_REQUIRE_AUTH=true` para activar la protección mediante `middleware.ts`.
- En `/acceso/` el garden pone su email y recibe un enlace mágico de Supabase. No hay contraseñas.
- Solo entran los emails dados de alta: el registro está cerrado.
- Para cerrar sesión: `/acceso/?salir=1`.

## Puesta en marcha (una vez)

### 1. Supabase
1. Crea un proyecto nuevo, por ejemplo `wiki-aliat`. Mejor separado del de Cymara.
2. En **Authentication → Sign In / Providers**, desactiva **Allow new users to sign up**. Deja activado Email.
3. En **Authentication → URL Configuration**, pon el dominio de la wiki en **Site URL** y añade `https://TU-DOMINIO/acceso/**` en **Redirect URLs**. Añade también la URL `*.vercel.app` mientras pruebas.
4. En **Authentication → Emails**, traduce la plantilla **Magic Link** al español.
5. Para 70 gardens, configura un **SMTP propio** en Authentication → Emails → SMTP. El email incluido en Supabase tiene un límite muy bajo de envíos por hora.

### 2. Dar de alta a los gardens
Prepara `gardens.csv` con una línea por persona: `email,garden`. Después ejecuta:
```
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SECRET_KEY=la_clave_secreta npm run invitar -- gardens.csv
```
El script no envía emails. Cada garden entra desde `/acceso/` cuando quiere. En Supabase → Authentication → Users ves quién ha entrado y cuándo.

### 3. Vercel
1. Importa el repo de GitHub. Vercel detecta Astro solo.
2. En **Environment Variables**, añade:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_KEY`: la clave publishable o anon.
   - `SUPABASE_JWT_SECRET`: solo si el proyecto usa la clave JWT antigua. Los proyectos nuevos no la necesitan.
3. Cuando el acceso esté listo, define `WIKI_REQUIRE_AUTH=true` en Vercel y vuelve a desplegar.
4. Conecta el dominio, por ejemplo `wiki.cymara.es`.

**Nota:** mientras `WIKI_REQUIRE_AUTH` no sea `true`, la wiki será pública. No incluyas información confidencial durante las pruebas.

## Desarrollo en local
```
cp .env.example .env   # rellena las variables
npm install
npm run dev
```
En local la protección no se aplica, porque el middleware solo corre en Vercel.