import { test, expect } from '@playwright/test';

test.describe('Linguistic Arbitrage Engine - Smoke Test', () => {
    test.beforeEach(async ({ context }) => {
        // Grant microphone permissions
        await context.grantPermissions(['microphone']);
    });

    test('should load the homepage and display key elements', async ({ page }) => {
        // Navigate to homepage
        await page.goto('/');

        // Check if the main title is visible
        await expect(page.getByText('LINGUISTIC ARBITRAGE ENGINE')).toBeVisible();

        // Check if microphone button is present
        const micButton = page.locator('button').filter({ hasText: /microphone|mic/i }).first();
        await expect(micButton).toBeVisible();

        // Take screenshot for visual verification
        await page.screenshot({ path: 'tests/screenshots/homepage.png', fullPage: true });
    });

    test('should display scenario selector', async ({ page }) => {
        await page.goto('/');

        // Check if scenario selector exists
        const scenarioSelector = page.locator('select, [role="combobox"]').first();
        await expect(scenarioSelector).toBeVisible();
    });

    test('should have metrics visualization', async ({ page }) => {
        await page.goto('/');

        // Check if metrics panel is visible
        const metricsPanel = page.locator('text=/confidence|velocity|sentiment/i').first();
        await expect(metricsPanel).toBeVisible();
    });
});
