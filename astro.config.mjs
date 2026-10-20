// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Wiki de control de stock',
      description: 'Guía práctica de control de stock para los garden centers de ALIAT, por Cymara.',
      defaultLocale: 'root',
      locales: { root: { label: 'Español', lang: 'es' } },
      customCss: ['./src/styles/cymara.css'],
      sidebar: [
        { label: 'Empieza aquí', items: [
          { label: 'Bienvenida', slug: 'index' },
          { label: 'Autodiagnóstico en 5 minutos', slug: 'autodiagnostico' },
        ]},
        { label: 'Los cuatro problemas', items: [
          { label: '1. Stock mal localizado', slug: 'problemas/localizacion' },
          { label: '2. Sobrestock', slug: 'problemas/sobrestock' },
          { label: '3. Planificación de compras', slug: 'problemas/compras' },
          { label: '4. Conteos poco fiables', slug: 'problemas/conteos' },
        ]},
        { label: 'Recursos', items: [
          { label: 'Laboratorio interactivo', slug: 'laboratorio' },
          { label: 'Plantillas y checklists', slug: 'plantillas' },
          { label: 'Glosario', slug: 'glosario' },
          { label: 'Diagnóstico gratuito', slug: 'diagnostico' },
        ]},
      ],
    }),
  ],
});