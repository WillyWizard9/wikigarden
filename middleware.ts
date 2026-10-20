// Vercel Routing Middleware: protege toda la wiki.
// Solo deja pasar si la cookie `wiki_sesion` lleva un token válido de Supabase.
import { next } from '@vercel/functions';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export const config = {
  // Todo excepto la página de acceso y sus recursos estáticos.
  matcher: ['/((?!acceso|_astro/|favicon\\.svg).*)'],
};

const SUPABASE_URL = (process.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET; // solo si el proyecto usa la clave JWT antigua (HS256)
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

async function verificar(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = JWT_SECRET
      ? await jwtVerify(token, new TextEncoder().encode(JWT_SECRET), { issuer: ISSUER })
      : await jwtVerify(token, JWKS, { issuer: ISSUER });
    return payload.role === 'authenticated' ? payload : null;
  } catch {
    return null;
  }
}

function leerCookie(request: Request, nombre: string): string | null {
  const cookies = request.headers.get('cookie') ?? '';
  for (const parte of cookies.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(v.join('='));
  }
  return null;
}

export default async function middleware(request: Request) {
  const token = leerCookie(request, 'wiki_sesion');
  if (token && (await verificar(token))) return next();

  const url = new URL(request.url);
  const acceso = new URL('/acceso/', url.origin);
  acceso.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(acceso, 302);
}