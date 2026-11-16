/**
 * Recorrido de punta a punta con un navegador real (Playwright) contra la app en marcha.
 *   BASE=http://localhost:3000 SHOTS=./capturas node e2e/flow.mjs
 */
import { mkdirSync } from 'node:fs';

import { createRequire } from 'node:module';

// Playwright: instalado en el proyecto (npm i -D playwright) o globalmente.
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS ?? 'e2e-shots';
mkdirSync(SHOTS, { recursive: true });

const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(['✓', name]);
    console.log('✓', name);
  } catch (e) {
    results.push(['✗', name]);
    console.log('✗', name, '→', e.message.split('\n')[0]);
    throw e;
  }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`); });
const overflow = [];
const shot = async (n) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (w > 1) overflow.push(`${n}: ${w}px`);
  await page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
};
const expectText = async (t, timeout = 15000) => page.getByText(t, { exact: false }).first().waitFor({ timeout });

try {
  await step('registro', async () => {
    await page.goto(`${BASE}/`);
    await page.waitForURL('**/login');
    await shot('01-login');
    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await page.getByLabel('Correo electrónico').fill(`ana${Date.now()}@ejemplo.com`);
    await page.getByLabel('Contraseña').fill('secreto123');
    await page.locator('input[name=terms]').check();
    await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
    await page.waitForURL('**/bienvenida');
  });

  await step('perfil inicial en 4 pasos', async () => {
    await page.getByLabel('Nombre (opcional)').fill('Ana');
    await page.getByLabel('Fecha de nacimiento').fill('1995-05-10');
    await page.getByLabel('Altura').fill('162');
    await page.getByLabel('Peso actual').fill('68');
    await shot('02-paso1');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('radio', { name: 'Perder grasa' }).click();
    await page.getByRole('radio', { name: /^Moderado/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: '+ Quinua' }).click();
    await page.getByRole('button', { name: '+ Maní' }).click();
    await shot('03-paso3');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('radio', { name: 'LU' }).click();
    await page.getByRole('button', { name: 'Crear mi plan' }).click();
    await page.waitForURL('**/hoy**', { timeout: 20000 });
  });

  await step('menor de edad: no puede elegir "Perder grasa"', async () => {
    // Se comprueba en un contexto aparte para no alterar la cuenta principal.
    const p2 = await ctx.browser().newPage({ viewport: { width: 393, height: 852 } });
    await p2.goto(`${BASE}/login`);
    await p2.getByRole('tab', { name: 'Crear cuenta' }).click();
    await p2.getByLabel('Correo electrónico').fill(`teen${Date.now()}@ejemplo.com`);
    await p2.getByLabel('Contraseña').fill('secreto123');
    await p2.locator('input[name=terms]').check();
    await p2.getByRole('button', { name: 'Crear mi cuenta' }).click();
    await p2.waitForURL('**/bienvenida');
    await p2.getByLabel('Fecha de nacimiento').fill(`${new Date().getFullYear() - 15}-03-01`);
    await p2.getByLabel('Altura').fill('158');
    await p2.getByLabel('Peso actual').fill('52');
    if (!(await p2.getByText('menor de edad').count())) throw new Error('no muestra aviso para menores');
    if (await p2.getByLabel('% de grasa corporal').count()) throw new Error('pide % de grasa a un menor');
    await p2.getByRole('button', { name: 'Continuar' }).click();
    if (await p2.getByRole('radio', { name: 'Perder grasa' }).count()) throw new Error('ofrece perder grasa a un menor');
    await p2.screenshot({ path: `${SHOTS}/04-menor.png`, fullPage: true });
    await p2.close();
  });

  await step('generar el plan del día', async () => {
    await shot('05-hoy-vacio');
    await page.getByRole('button', { name: /Generar el plan del día/ }).click();
    await expectText('Desayuno', 30000);
    await page.getByText('Pendiente').first().waitFor();
    const n = await page.getByText('Pendiente').count();
    if (n < 4) throw new Error(`esperaba 4 comidas, hay ${n}`);
    await shot('06-hoy-plan');
  });

  await step('"Lo comí" marca el desayuno como cumplido', async () => {
    await page.getByRole('button', { name: 'Lo comí' }).first().click();
    await page.getByText('Cumplido').first().waitFor();
  });

  await step('"Comí otra cosa": registra la comida real y marca el almuerzo como reemplazado', async () => {
    await page.getByRole('button', { name: 'Comí otra cosa' }).first().click();
    await page.getByLabel('¿Qué comiste?').fill('Una salteña de pollo y un refresco');
    await page.getByRole('button', { name: /Estimar con IA/ }).click();
    await page.getByText('Para afinar').waitFor();
    if ((await page.getByLabel('kcal').inputValue()) !== '920') throw new Error('no rellenó la estimación');
    await shot('07-comi-otra-cosa');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByText('Reemplazado').first().waitFor();
    await expectText('Comiste:');
  });

  await step('cambiar plato con la IA', async () => {
    const before = await page.locator('h3').nth(3).innerText();
    await page.getByRole('button', { name: 'Cambiar plato' }).last().click();
    await page.getByRole('button', { name: 'No tengo los ingredientes' }).click();
    await page.getByRole('button', { name: 'Proponer otro plato' }).click();
    await page.waitForFunction((b) => document.querySelectorAll('h3')[3]?.textContent !== b, before, { timeout: 20000 });
    await expectText('Cambios del día');
    await shot('08-hoy-cambios');
  });

  await step('ver receta e ingredientes', async () => {
    await page.getByRole('button', { name: 'Ver receta' }).first().click();
    await expectText('Preparación');
    await page.getByRole('button', { name: 'Guardar favorito' }).first().click();
    await expectText('guardado en favoritos');
  });

  await step('chat: "Hoy pesé 67,5 kg" registra la medición', async () => {
    await page.goto(`${BASE}/chat`);
    await shot('09-chat-vacio');
    await page.getByLabel('Mensaje').fill('Hoy pesé 67,5 kg');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expectText('Registré 67,5 kg', 20000);
  });

  await step('chat: "No tengo pollo en mi casa" cambia la cena', async () => {
    await page.getByLabel('Mensaje').fill('No tengo pollo en mi casa');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expectText('por «', 20000);
    await shot('10-chat');
  });

  await step('chat: "entrené solamente dos días"', async () => {
    await page.getByLabel('Mensaje').fill('Esta semana entrené solamente dos días');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expectText('Anoté 2 entrenamientos', 20000);
  });

  await step('el historial del chat se conserva al volver', async () => {
    await page.reload();
    await expectText('Hoy pesé 67,5 kg');
  });

  await step('calendario: semana con estados y generar días que faltan', async () => {
    await page.goto(`${BASE}/calendario`);
    await expectText('Cumplido');
    await shot('11-calendario');
    const gen = page.getByRole('button', { name: /Generar/ });
    if (await gen.count()) {
      await gen.click();
      await page.getByText(/Plan creado/).waitFor({ timeout: 60000 });
    }
    await shot('12-calendario-generado');
  });

  await step('calendario: detalle de un día', async () => {
    await page.getByRole('link', { name: /Hoy/ }).first().click();
    await page.waitForURL('**/calendario/**');
    await expectText('Reemplazado');
  });

  await step('lista de compras', async () => {
    await page.goto(`${BASE}/compras`);
    await expectText('Granos, cereales');
    await page.getByRole('checkbox').first().click();
    await expectText('1 de');
    await shot('13-compras');
  });

  await step('progreso: control, gráficas y revisión', async () => {
    await page.goto(`${BASE}/progreso`);
    await page.getByLabel('Peso').fill('67,2');
    await page.getByLabel('Cintura').fill('80');
    await page.getByRole('button', { name: 'Guardar control' }).click();
    await expectText('Control guardado');
    await page.getByRole('button', { name: /Revisar mi progreso/ }).click();
    await expectText('ritmo estable', 20000);
    if (await page.getByText('Sugerencia moderada').count()) throw new Error('sugirió ajuste con menos de 3 semanas de datos');
    await shot('14-progreso');
  });

  await step('inicio con datos', async () => {
    await page.goto(`${BASE}/`);
    await expectText('kcal');
    await shot('15-inicio');
  });

  await step('perfil: memoria, favoritos y exportación', async () => {
    await page.goto(`${BASE}/perfil`);
    await expectText('Lo que Vyro recuerda');
    await expectText('Le gusta el plato');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Descargar mis datos/ }).click()]);
    const path = await dl.path();
    const data = JSON.parse((await import('node:fs')).readFileSync(path, 'utf8'));
    if (!data.meal_logs?.length || !data.chat_messages?.length || !data.meal_change_history?.length) throw new Error('exportación incompleta');
    await shot('16-perfil');
  });

  await step('eliminar la cuenta', async () => {
    await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
    await page.getByLabel('Escribe ELIMINAR para confirmar').fill('ELIMINAR');
    await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await page.waitForURL('**/login', { timeout: 15000 });
  });
} catch {
  await shot('zz-fallo').catch(() => {});
} finally {
  console.log(`\n${results.filter((r) => r[0] === '✓').length}/${results.length} pasos correctos`);
  console.log('errores del navegador:', errors.length ? errors : 'ninguno');
  console.log('páginas con desbordamiento horizontal:', overflow.length ? overflow : 'ninguna');
  await browser.close();
}
