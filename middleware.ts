// Protección opcional durante la puesta en marcha en Vercel.
// Hasta activar WIKI_REQUIRE_AUTH=true, la wiki será pública.
import { next } from '@vercel/functions';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export const config = {
  matcher: ['/((?!acceso|api/|_astro/|favicon\\.svg).*)'],
};

function leerCookie(request: Request, nombre: string): string | null {
  const cookies = request.headers.get('cookie') ?? '';
  for (const parte of cookies.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) {
      try { return decodeURIComponent(v.join('=')); } catch { return null; }
    }
  }
  return null;
}

async function verificar(token: string, supabaseUrl: string): Promise<JWTPayload | null> {
  const issuer = `${supabaseUrl}/auth/v1`;
  const secreto = process.env.SUPABASE_JWT_SECRET;
  try {
    const { payload } = secreto
      ? await jwtVerify(token, new TextEncoder().encode(secreto), { issuer })
      : await jwtVerify(token, createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)), { issuer });
    return payload.role === 'authenticated' ? payload : null;
  } catch {
    return null;
  }
}

export default async function middleware(request: Request) {
  // En la primera fase, se despliega sin control de acceso.
  // La demostración debe ser accesible sin Supabase. No utilizar para información privada.
  // Para activar autenticación real, configurar WIKI_DEMO_ACCESS=false junto a WIKI_REQUIRE_AUTH=true.
  if (process.env.PUBLIC_WIKI_AUTH_ENABLED !== 'true' || process.env.WIKI_REQUIRE_AUTH !== 'true') return next();

  const supabaseUrl = 'https://mozmpxxlgrzbxukitpms.supabase.co';
  // Con protección activada pero Supabase sin configurar, no exponer la wiki.
  if (!supabaseUrl) return new Response('Autenticación pendiente de configurar', { status: 503 });

  const token = leerCookie(request, 'wiki_sesion');
  if (token) {
    const payload = await verificar(token, supabaseUrl);
    if (payload?.sub) {
      // Supabase Auth identifica al usuario; la membresía determina si está invitado.
      try {
        const response = await fetch(
          supabaseUrl + '/rest/v1/wiki_members?select=user_id&user_id=eq.' + encodeURIComponent(payload.sub),
          { headers: {
            apikey: 'sb_publishable_OtrtVuzuiJJefDs0oM6wuQ_LmexlzFk',
            Authorization: 'Bearer ' + token
          }, cache: 'no-store' }
        );
        if (response.ok) {
          const rows = await response.json();
          if (Array.isArray(rows) && rows.length === 1) return next();
        }
      } catch { /* Si no podemos comprobar la membresía, denegamos acceso. */ }
    }
  }

  const url = new URL(request.url);
  const acceso = new URL('/acceso/', url.origin);
  acceso.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(acceso, 302);
}
