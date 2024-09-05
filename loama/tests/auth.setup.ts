import { PlaywrightTestArgs, PlaywrightWorkerArgs, expect } from "@playwright/test";

const authSetup = async ({ page }: PlaywrightTestArgs & PlaywrightWorkerArgs) => {
    await page.goto('http://localhost:4173/');

    const idpInput = page.locator("#solid-pod-url")
    await idpInput.click();
    await idpInput.fill('http://localhost:8080');

    await page.getByRole('button', { name: 'Login' }).click();

    await page.getByLabel('Email').click();
    await page.getByLabel('Email').fill('hello@example.com');
    await page.getByLabel('Password').click();
    await page.getByLabel('Password').fill('abc123');
    await page.getByRole('button', { name: 'Log in' }).click();

    await page.getByRole('button', { name: 'Authorize' }).click();


    await expect(page.getByRole('link', { name: 'Resources', exact: true })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('home');
}

export default authSetup;
