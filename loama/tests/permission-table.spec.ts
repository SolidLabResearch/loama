import test, { expect } from "@playwright/test";
import authSetup from "./auth.setup";

test.beforeEach(authSetup);

test.describe("Permission table", () => {
    test.beforeEach(async ({ context }) => {
        context.setDefaultTimeout(30000);
    });
    test("Can add & remove webId subject", async ({ page }) => {
        await page.getByText("README").click();

        // Check if right panel is loaded
        const rightPanelElem = page.locator(".right-panel");
        const listHeader = rightPanelElem.locator(".list-header");
        await expect(listHeader).toContainText("Subjects with permissions")

        const startAgentPanelList = page.getByTestId('sidepanel-permission-list')
        await expect(startAgentPanelList.getByRole("listitem")).toHaveCount(2);
        await expect(startAgentPanelList.getByRole("listitem")).toHaveText(["http://localhost:8080/pod1/profile/card#me", "Public"])

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
        await expect(newSubjectDrawer).toBeHidden({ timeout: 30000 });

        const newSubjectRow = tableDrawer.locator("tr", { hasText: "http://localhost:8080/pod2/profile/card#me" });
        await expect(newSubjectRow).toBeVisible();
        await newSubjectRow.getByRole("button", { name: "Edit" }).click();

        const subjectEditorDrawer = page.locator(".subject-drawer");
        await expect(subjectEditorDrawer).toBeVisible()

        // The new subject only should have the read permission
        // We uncheck it to remove the subject so we are back to the previous state
        await subjectEditorDrawer.getByLabel('Read').uncheck();
        await expect(subjectEditorDrawer.getByLabel('Write')).not.toBeChecked();
        await expect(subjectEditorDrawer.getByLabel('Append')).not.toBeChecked();
        await expect(subjectEditorDrawer.getByLabel('Control')).not.toBeChecked();

        // Wait until the operation is finished
        await expect(subjectEditorDrawer.getByLabel('Read')).toBeEnabled();

        await subjectEditorDrawer.locator("button.p-drawer-close-button").click();
        await expect(subjectEditorDrawer).toBeHidden();

        // Check if the table is updated & close the drawer
        await expect(tableDrawer.locator("tbody").getByRole("row")).toHaveCount(2);
        await tableDrawer.locator("button.p-drawer-close-button").click();
        await expect(tableDrawer).toBeHidden();

        // Check if the right side panel has the 2 subjects
        await expect(startAgentPanelList.getByRole("listitem")).toHaveCount(2);
        await expect(startAgentPanelList.getByRole("listitem")).toHaveText(["http://localhost:8080/pod1/profile/card#me", "Public"])
    });

    test("Can change public permissions", async ({ page, browser }) => {
        await page.getByText("README").click();

        // Check if right panel is loaded
        const rightPanelElem = page.locator(".right-panel");
        const listHeader = rightPanelElem.locator(".list-header");
        await expect(listHeader).toContainText("Subjects with permissions")

        await rightPanelElem.getByRole("button", { name: "Edit" }).click();

        const tableDrawer = page.locator(".permission-drawer");
        const publicSubjectRow = tableDrawer.locator("tr", { hasText: "Public" });
        await expect(publicSubjectRow).toBeVisible();
        await publicSubjectRow.getByRole("button", { name: "Edit" }).click();

        const subjectEditorDrawer = page.locator(".subject-drawer");
        await expect(subjectEditorDrawer).toBeVisible()
        const readPermCheckbox = subjectEditorDrawer.getByLabel('Read')
        // Everyone can read the file
        await expect(readPermCheckbox).toBeChecked();

        const podPage = await browser.newPage();
        // Disable caching
        await podPage.route("**/pod1/README", (route) => route.continue());
        await podPage.goto("http://localhost:8080/pod1/README");
        await expect(podPage.getByText("Welcome to your pod")).toBeVisible();

        // Remove read permission
        await readPermCheckbox.uncheck();
        await expect(readPermCheckbox).toBeEnabled();

        await podPage.reload();
        await expect(podPage.getByText("Not logged in")).toBeVisible();

        await readPermCheckbox.check();
        await expect(readPermCheckbox).toBeEnabled();
    });

    test("Granting control permission give's a popup", async ({ page }) => {
        await page.getByText("README").click();

        // Check if right panel is loaded
        const rightPanelElem = page.locator(".right-panel");
        const listHeader = rightPanelElem.locator(".list-header");
        await expect(listHeader).toContainText("Subjects with permissions")

        await rightPanelElem.getByRole("button", { name: "Edit" }).click();

        const tableDrawer = page.locator(".permission-drawer");
        const publicSubjectRow = tableDrawer.locator("tr", { hasText: "Public" });
        await expect(publicSubjectRow).toBeVisible();
        await publicSubjectRow.getByRole("button", { name: "Edit" }).click();

        const subjectEditorDrawer = page.locator(".subject-drawer");
        await expect(subjectEditorDrawer).toBeVisible()
        const controlPermCheckbox = subjectEditorDrawer.getByLabel('Control')
        await expect(controlPermCheckbox).not.toBeChecked();
        await controlPermCheckbox.check();

        const checkDialog = page.getByText("Grant control permission?");
        await expect(checkDialog).toBeVisible();
    });

    test("Grant btn in popup contol permission gives the permission", async ({ page }) => {
        await page.getByText("README").click();

        // Check if right panel is loaded
        const rightPanelElem = page.locator(".right-panel");
        const listHeader = rightPanelElem.locator(".list-header");
        await expect(listHeader).toContainText("Subjects with permissions")

        await rightPanelElem.getByRole("button", { name: "Edit" }).click();

        const tableDrawer = page.locator(".permission-drawer");
        const publicSubjectRow = tableDrawer.locator("tr", { hasText: "Public" });
        await expect(publicSubjectRow).toBeVisible();
        await publicSubjectRow.getByRole("button", { name: "Edit" }).click();

        const subjectEditorDrawer = page.locator(".subject-drawer");
        await expect(subjectEditorDrawer).toBeVisible()
        const controlPermCheckbox = subjectEditorDrawer.getByLabel('Control')
        await expect(controlPermCheckbox).not.toBeChecked();
        await controlPermCheckbox.check();

        const checkDialog = page.getByRole("alertdialog", { name: "Grant control permission?" });
        await expect(checkDialog).toBeVisible();

        await checkDialog.getByRole("button", { name: "Grant" }).click();

        await expect(controlPermCheckbox).toBeEnabled();
        await expect(controlPermCheckbox).toBeChecked();
        await controlPermCheckbox.uncheck();
        await expect(controlPermCheckbox).toBeEnabled();
    });

    test("An toast should show while updating permissions", async ({ page }) => {
        await page.getByText("README").click();

        // Check if right panel is loaded
        const rightPanelElem = page.locator(".right-panel");
        const listHeader = rightPanelElem.locator(".list-header");
        await expect(listHeader).toContainText("Subjects with permissions")

        await rightPanelElem.getByRole("button", { name: "Edit" }).click();

        const tableDrawer = page.locator(".permission-drawer");
        const publicSubjectRow = tableDrawer.locator("tr", { hasText: "Public" });
        await expect(publicSubjectRow).toBeVisible();
        await publicSubjectRow.getByRole("button", { name: "Edit" }).click();

        const subjectEditorDrawer = page.locator(".subject-drawer");
        await expect(subjectEditorDrawer).toBeVisible()
        const writePermCheckbox = subjectEditorDrawer.getByLabel('Write')
        await expect(writePermCheckbox).not.toBeChecked();
        await writePermCheckbox.check();

        const mask = page.locator(".p-drawer-mask", { hasText: "Edit subject" })
        await mask.click({ position: { x: 1, y: 1 } });

        const alertToast = page.getByRole("alert")
        await expect(alertToast).toBeVisible();

        await expect(writePermCheckbox).toBeEnabled();
        await writePermCheckbox.uncheck();
        await expect(writePermCheckbox).toBeEnabled();
    })
})
