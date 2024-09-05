import test, { expect } from "@playwright/test";
import authSetup from './auth.setup';

test.beforeEach(authSetup);

test.describe("Resource Explorer", () => {
    test("Can enter container", async ({ page }) => {
        await page.getByRole("button", { name: "View resources" }).click();
        const breadcrumsElement = page.locator("#explorer-breadcrumbs");
        expect(breadcrumsElement).toContainText("/home/profile/");

        expect(page.getByText("card")).toBeVisible();
    })
})
