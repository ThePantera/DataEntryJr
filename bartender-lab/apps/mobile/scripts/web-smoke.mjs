// Smoke test of the real app UI in a browser (react-native-web + SQLite/WASM + Playwright).
// It exports the web build, serves it with cross-origin isolation, visits every screen and runs
// the main offline flow. Fails on any uncaught page error. Screenshots go to SMOKE_SHOTS (optional).
//
// Usage: npm run smoke:web -w @bartender-lab/mobile
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(import.meta.dirname, '..');
const out = join(root, 'dist-web');
const shots = process.env.SMOKE_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });

execSync(`npx expo export --platform web --output-dir ${out}`, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, CI: '1' },
});

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
};
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(out, path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(out, 'index.html');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const catalog = require('@bartender-lab/client-core/data/catalog.json');
const negroni = catalog.recipes.find((r) => r.slug === 'negroni');
const shake = catalog.techniques.find((t) => t.name === 'Batido');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
const errors = [];
// Headless Chromium denies the Wake Lock API used by expo-keep-awake on web; on Android the
// screen is kept on natively (FLAG_KEEP_SCREEN_ON), so this message is not an app error.
const BROWSER_ONLY = [/Wake Lock permission request denied/];
const record = (message) => BROWSER_ONLY.some((re) => re.test(message)) || errors.push(message);
page.on('pageerror', (error) => record(error.message));
page.on('console', (msg) => msg.type() === 'error' && record(msg.text()));

let step = 0;
async function visit(path, expectText) {
  await page.goto(`${base}${path}`);
  await page.getByText(expectText, { exact: false }).first().waitFor({ timeout: 20000 });
  if (shots)
    await page.screenshot({
      path: join(
        shots,
        `${String(++step).padStart(2, '0')}${path.replace(/[^a-z0-9]+/gi, '_')}.png`,
      ),
    });
  console.log(`✓ ${path} muestra "${expectText}"`);
}

try {
  await visit('/', 'Con tu barra puedes preparar');
  await visit('/explorar', 'Negroni');
  await visit('/buscar', '¿Qué puedo preparar?');
  await visit('/mi-barra', 'Mi barra está vacía');
  await visit('/mas', 'Escuela de técnicas');
  await visit(`/receta/${negroni.id}`, 'Vermut rojo');
  await visit(`/preparar/${negroni.id}?porciones=1`, 'Prepara los ingredientes');
  await visit('/tecnicas', 'Batido');
  await visit(`/tecnicas/${shake.id}`, 'Errores comunes');
  await visit('/favoritos', 'Sin favoritos todavía');
  await visit('/compras', 'No tienes listas');
  await visit('/configuracion', 'Servidor (opcional)');
  await visit('/descargas', 'recetas guardadas en este teléfono');

  // Main offline flow: stock the bar, then ask what can be prepared.
  for (const name of ['Gin', 'Campari', 'Vermut rojo']) {
    await visit('/ingredientes?modo=barra', 'Amargo de Angostura');
    await page.getByText(name, { exact: true }).first().click();
    await page.waitForTimeout(500);
  }
  await visit('/mi-barra', 'Vermut rojo');
  await visit('/buscar?modo=preparar', 'Tienes todo (1)');
  await visit(`/receta/${negroni.id}`, 'Añadir faltantes a la lista de compras');
} finally {
  await browser.close();
  server.close();
}

if (errors.length) {
  console.error(`✗ Errores en la página:\n - ${errors.join('\n - ')}`);
  process.exit(1);
}
console.log('Prueba de humo web superada.');
