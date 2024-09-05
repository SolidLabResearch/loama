import test, { expect } from "@playwright/test";
import authSetup from "./auth.setup";

test.beforeEach(authSetup);

test.describe("Permission table", () => {
    test("Can add webId subject", async ({ page }) => {
        await page.getByText("README").click();

        // Check if right panel is loaded
        const rightPanelElem = page.locator(".right-panel");
        const listHeader = rightPanelElem.locator(".list-header");
        await expect(listHeader).toContainText("Subjects with permissions")

        const startAgentPanelList = page.getByTestId('sidepanel-permission-list')
        expect(startAgentPanelList.getByRole("listitem")).toHaveCount(2);
        expect(startAgentPanelList.getByRole("listitem")).toHaveText(["http://localhost:8080/pod1/profile/card#me", "Public"])

        await rightPanelElem.getByRole("button", { name: "Edit" }).click();

        const tableDrawer = page.locator(".permission-drawer");
        await tableDrawer.getByRole("button", { name: "New subject" }).click();

        const newSubjectDrawer = page.locator(".new-subject-drawer")
        await newSubjectDrawer.locator('[name="subject-type"]').click();
        await page.getByLabel('webId').click();

        const webIdInput = newSubjectDrawer.locator("input#webid");
        await webIdInput.click();
        await webIdInput.fill("http://localhost:8080/pod2/profile/card#me")
        await newSubjectDrawer.getByRole("button", { name: "Create" }).click();

        expect(newSubjectDrawer).toBeHidden({ timeout: 10000 });

        const newSubjectEntry = tableDrawer.getByText("http://localhost:8080/pod2/profile/card#me");

        expect(newSubjectEntry).toBeVisible();
    });
})
