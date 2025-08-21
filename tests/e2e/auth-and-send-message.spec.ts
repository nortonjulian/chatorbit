import { test, expect } from '@playwright/test';

test('signup, login, create chat, send message', async ({ page }) => {
  await page.goto('/');

  // sign up
  await page.getByRole('button', { name: /sign up/i }).click();
  const username = `e2e_${Date.now()}`;
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/email/i).fill(`${username}@test.local`);
  await page.getByLabel(/password/i).fill('pw123456');
  await page.getByRole('button', { name: /create account/i }).click();

  // login
  await page.getByRole('button', { name: /login/i }).click();
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill('pw123456');
  await page.getByRole('button', { name: /sign in/i }).click();

  // create chat
  await page.getByRole('button', { name: /new chat/i }).click();
  await page.getByLabel(/chat name/i).fill('e2e room');
  await page.getByRole('button', { name: /create/i }).click();

  // send message
  await page.getByPlaceholder(/type a message/i).fill('hello e2e');
  await page.getByRole('button', { name: /send/i }).click();

  await expect(page.getByText('hello e2e')).toBeVisible();
});
