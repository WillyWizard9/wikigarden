# WikiGarden · Cymara × ALIAT

Guía interactiva de control de inventario para garden centers, creada con Astro Starlight y desplegada en Vercel.

## Experiencia actual (demostración)

- La ruta `/acceso/` muestra un formulario de usuario y contraseña **sin autenticar**: cualquier combinación permite entrar.
- El nombre del usuario se guarda en `sessionStorage`; los pasos completados, medallas y resultados del test se guardan en `localStorage` del navegador.
- Esta interfaz **no protege contenido, no identifica usuarios y no sincroniza progreso entre dispositivos**. No publiques datos privados basándote en esta pantalla.
- Cinco retos con progreso en cinco etapas y medallas; examen de 15 preguntas; autodiagnóstico de 25 preguntas.
- Formulario comercial disponible mediante `/api/contact`: requiere `RESEND_API_KEY` y `RESEND_FROM_EMAIL` configurados en Vercel para enviar realmente a info@cymara.es.
- El acceso real se activa únicamente cuando `PUBLIC_WIKI_AUTH_ENABLED=true` y `WIKI_REQUIRE_AUTH=true` están configurados simultáneamente en Vercel.

## Supabase WikiGarden (noviembre de 2026)

Proyecto independiente: `wikigarden` (`mozmpxxlgrzbxukitpms`) en la organización de gardens.

**Estado actual**: esquema creado, RLS verificado, cliente Auth y persistencia de progreso implementados en GitHub. El acceso DEMO permanece activo hasta habilitar simultáneamente las dos variables de Vercel y probar una invitación.

### Tablas creadas
- `wiki_gardens`: nombre del garden.
- `wiki_members`: usuario autenticado y su garden.
- `wiki_progress`: datos de pasos completados, descargas, diagnóstico y examen, sincronizados por usuario.

Las tres tablas tienen RLS. Cada usuario solo lee su propia membresía, su garden y su progreso. La escritura de progreso solo permite `user_id = auth.uid()`. La web verifica JWT y pertenencia a garden en middleware al activar producción.

### Activar producción (tras prueba con usuario invitado)
1. En **Supabase → Authentication → Providers / Email**, mantener email con contraseña y **desactivar el registro público (Allow new users to sign up)**. La creación de usuarios la realiza el administrador mediante invitación.
2. En **Authentication → URL Configuration**, establecer `Site URL` con la URL pública real de WikiGarden y permitir `https://TU-DOMINIO/acceso/` en Redirect URLs. Para pruebas, incluir la URL de Vercel correspondiente. Comprobar la invitación y establecer una contraseña de al menos 10 caracteres.
3. Configurar SMTP para invitaciones si se envían a todos los gardens; el envío predeterminado de Supabase es limitado.
4. Preparar `gardens.csv` en un ordenador seguro, formato `email,garden,nombre`. Verificar con `npm run invitar -- gardens.csv` (simulación). **Solo con autorización para invitar y SMTP probado**, ejecutar `SUPABASE_URL=... SUPABASE_SECRET_KEY=... SITE_URL=https://TU-DOMINIO npm run invitar -- gardens.csv --send`. Nunca subir secretos ni datos de contacto al repositorio.
5. Una vez que una cuenta de prueba esté invitada y tenga su fila en `wiki_members`, activar en **Vercel → Settings → Environment Variables**: `PUBLIC_WIKI_AUTH_ENABLED=true` y `WIKI_REQUIRE_AUTH=true`. Desplegar de nuevo para que Astro compile el cliente real. Ambas variables deben activarse juntas.
6. Comprobar: login, cierre de sesión, acceso sin cuenta rechazado, aislamiento de progresos de dos usuarios, progreso persistente al cambiar de navegador, invitación, evaluación y trofeo Platino. No lanzar a los 70 gardens sin estas pruebas.

**Importante**: `PUBLIC_WIKI_AUTH_ENABLED` es una bandera de activación, no un secreto. La clave pública de Supabase está integrada en el cliente y puede exponerse. La clave secreta `SUPABASE_SECRET_KEY` debe utilizarse solo en ejecución administrativa local, nunca en el frontend ni en GitHub.

El progreso de la etapa demo es local y **no se migra automáticamente** a una nueva cuenta, para no atribuir a un usuario los logros de otra persona que hubiera utilizado el mismo navegador.

## Editar el contenido

Cada página es un archivo Markdown en `src/content/docs/`. Edítalo en GitHub y Vercel publica el cambio en un minuto. El menú lateral se define en `astro.config.mjs`.

## Desarrollo en local
```
cp .env.example .env   # rellena las variables
npm install
npm run dev
```
En local la protección no se aplica, porque el middleware solo corre en Vercel.