import test, { expect } from "@playwright/test";
import authSetup from './auth.setup';

test.beforeEach(authSetup);

test.describe("Resource Explorer", () => {
    test.beforeEach(async ({ context }) => {
        context.setDefaultTimeout(30000);
    });

    test("Can enter container", async ({ page }) => {
        await page.getByText('profileView resources').getByRole("button", { name: "View resources" }).click();
        await expect(page.locator(".left-panel").getByText("card")).toBeVisible({
            timeout: 30000,
        });

        const breadcrumsElement = page.locator("#explorer-breadcrumbs");
        await expect(breadcrumsElement).toContainText("/home/profile/", {
            timeout: 30000,
        });
    })
    test("Can go up a level", async ({ page }) => {
        await page.getByRole("button", { name: "View resources" }).click();
        const breadcrumsElement = page.locator("#explorer-breadcrumbs");
        await expect(breadcrumsElement).toContainText("/home/profile/");

        await expect(page.locator(".left-panel").getByText("card")).toBeVisible();

        const homeLink = page.getByRole('link', { name: 'home' });
        await homeLink.click();
        await expect(page.locator('div').filter({ hasText: /^profile$/ })).toBeVisible();
        await expect(breadcrumsElement).toContainText("/home/");
    })
})
