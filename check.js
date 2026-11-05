import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function submitCrossSiteForm(page, path, buttonName) {
  const methods = [];
  function recordRequest(request) {
    if (request.url() === `http://localhost:3000${path}`) methods.push(request.method());
  }
  page.on('request', recordRequest);
  await page.goto(`http://127.0.0.1:3001${path}`);
  const [response] = await Promise.all([
    page.waitForNavigation(),
    page.getByRole('button', { name: buttonName }).click(),
  ]);
  page.off('request', recordRequest);
  // No OPTIONS preflight
  assert.deepEqual(methods, ['POST']);
  return response;
}

try {
  console.log('Browser:', browser.version());

  // Case 1: cross-site account change
  for (const sameSite of ['None', 'Lax']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:3000/csrf-account');
    const login = await page.evaluate(async (sameSite) => {
      const response = await fetch('/csrf-account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'victim', password: 'demo-password', sameSite }),
      });
      return response.status;
    }, sameSite);
    assert.equal(login, 200);
    const [cookie] = (await context.cookies()).filter((c) => c.name === 'csrfDemoSession');
    assert.equal(cookie.sameSite, sameSite);

    const response = await submitCrossSiteForm(page, '/csrf-account', 'Submit cross-site change');
    assert.equal(response.status(), sameSite === 'None' ? 200 : 401);

    await page.goto('http://localhost:3000/csrf-account');
    const after = JSON.parse(await page.locator('body').innerText());
    assert.equal(after.account.displayName, sameSite === 'None' ? 'Changed by cross-site form' : 'Original name');
    console.log(JSON.stringify({ case: 'account change', sameSite, crossSiteStatus: response.status(), displayNameAfter: after.account.displayName }));
    await context.close();
  }

  // Case 2: cross-site login (login CSRF)
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:3000/profile');
  const login = await page.evaluate(async () => {
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'victim', password: 'demo-password' }),
    });
    return response.json();
  });
  assert.equal(login.user, 'victim');

  const response = await submitCrossSiteForm(page, '/login', 'Submit cross-site login');
  assert.equal(response.status(), 200);

  await page.goto('http://localhost:3000/profile');
  const profile = JSON.parse(await page.locator('body').innerText());
  assert.equal(profile.user, 'attacker');
  const [cookie] = (await context.cookies()).filter((c) => c.name === 'demoSession');
  assert.equal(cookie.sameSite, 'Lax');
  console.log(JSON.stringify({ case: 'login', sameSite: cookie.sameSite, crossSiteStatus: response.status(), userBefore: login.user, userAfter: profile.user }));
  await context.close();
} finally {
  await browser.close();
}
