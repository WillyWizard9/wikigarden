// Protección opcional durante la puesta en marcha en Vercel.
// Hasta activar WIKI_REQUIRE_AUTH=true, la wiki será pública.
import { next } from '@vercel/functions';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export const config = {
  matcher: ['/((?!acceso|_astro/|favicon\\.svg).*)'],
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
  if (process.env.WIKI_REQUIRE_AUTH !== 'true') return next();

  const supabaseUrl = (process.env.PUBLIC_SUPABASE_URL ?? '').trim().replace(/[/]$/, '');
  // Con protección activada pero Supabase sin configurar, no exponer la wiki.
  if (!supabaseUrl) return new Response('Autenticación pendiente de configurar', { status: 503 });

  const token = leerCookie(request, 'wiki_sesion');
  if (token && (await verificar(token, supabaseUrl))) return next();

  const url = new URL(request.url);
  const acceso = new URL('/acceso/', url.origin);
  acceso.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(acceso, 302);
}
