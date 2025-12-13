import { test, expect } from '@playwright/test';

test.describe('Navigation & Layout Tests', () => {

  test.describe('Landingpage', () => {
    test('sollte Navbar mit korrektem Layout anzeigen', async ({ page }) => {
      await page.goto('/de');

      // Navbar sollte existieren (erste nav ist die Hauptnavigation)
      const navbar = page.locator('nav').first();
      await expect(navbar).toBeVisible();

      // Logo sollte sichtbar sein
      await expect(page.getByText('Draw to Media').first()).toBeVisible();

      // Navigation Links prüfen - nur Home und Preise auf Landingpage
      await expect(page.getByRole('link', { name: 'Start' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Preise' }).first()).toBeVisible();
    });

    test('sollte Hero Section anzeigen', async ({ page }) => {
      await page.goto('/de');
      await expect(page.locator('main')).toBeVisible();
    });

    test('sollte Footer anzeigen', async ({ page }) => {
      await page.goto('/de');
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
    });
  });

  test.describe('Pricing Page - Neues Layout', () => {
    test('Pricing sollte KEIN Dashboard-Layout haben (Marketing-Layout)', async ({ page }) => {
      await page.goto('/de/pricing');
      await page.waitForLoadState('networkidle');

      // Screenshot für Debugging
      await page.screenshot({ path: 'tests/screenshots/pricing-new.png', fullPage: true });

      // Prüfe ob Dashboard-Sidebar NICHT existiert (lg:w-72 ist Dashboard-Sidebar)
      const dashboardSidebar = page.locator('aside.lg\\:w-72');
      await expect(dashboardSidebar).toHaveCount(0);

      // Prüfe ob Navbar existiert (Marketing-Layout)
      const navbar = page.locator('nav').first();
      await expect(navbar).toBeVisible();

      // Prüfe ob Footer existiert (Marketing-Layout)
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();

      console.log('SUCCESS: Pricing verwendet jetzt Marketing-Layout!');
    });

    test('Pricing Link von Landingpage sollte korrekt funktionieren', async ({ page }) => {
      await page.goto('/de');

      // Klicke auf Preise Link
      await page.getByRole('link', { name: 'Preise' }).first().click();

      // Warte auf Navigation
      await page.waitForURL('**/pricing');

      // URL prüfen
      expect(page.url()).toContain('/pricing');

      // Navbar sollte sichtbar sein (Marketing-Layout)
      const navbar = page.locator('nav').first();
      await expect(navbar).toBeVisible();
    });
  });

  test.describe('Login Page - Neues Layout', () => {
    test('Login sollte Navbar und Footer haben (Marketing-Layout)', async ({ page }) => {
      await page.goto('/de/login');
      await page.waitForLoadState('networkidle');

      await page.screenshot({ path: 'tests/screenshots/login-new.png', fullPage: true });

      // Prüfe ob Navbar existiert
      const navbar = page.locator('nav').first();
      await expect(navbar).toBeVisible();

      // Prüfe ob Footer existiert
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();

      console.log('SUCCESS: Login hat jetzt Navbar und Footer!');
    });
  });

  test.describe('Protected Routes', () => {
    test('Generate sollte Login erfordern', async ({ page }) => {
      await page.goto('/de/generate');

      // Sollte zum Login redirecten
      await page.waitForURL('**/login**', { timeout: 5000 });

      expect(page.url()).toContain('/login');
      expect(page.url()).toContain('redirect');

      console.log('SUCCESS: Generate redirect zu Login funktioniert');
    });

    test('History sollte Login erfordern', async ({ page }) => {
      await page.goto('/de/history');

      await page.waitForURL('**/login**', { timeout: 5000 });

      expect(page.url()).toContain('/login');
    });

    test('Profile sollte Login erfordern', async ({ page }) => {
      await page.goto('/de/profile');

      await page.waitForURL('**/login**', { timeout: 5000 });

      expect(page.url()).toContain('/login');
    });

    test('Pricing sollte NICHT Login erfordern', async ({ page }) => {
      await page.goto('/de/pricing');

      // Sollte NICHT redirecten
      await page.waitForLoadState('networkidle');

      // URL sollte pricing bleiben
      expect(page.url()).toContain('/pricing');
      expect(page.url()).not.toContain('/login');

      console.log('SUCCESS: Pricing ist öffentlich zugänglich');
    });
  });

  test.describe('Layout Konsistenz', () => {
    test('Landingpage sollte Navbar + Footer haben (kein Dashboard-Sidebar)', async ({ page }) => {
      await page.goto('/de');

      // Navbar (erste)
      const navbar = page.locator('nav').first();
      await expect(navbar).toBeVisible();

      // Footer
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();

      // Kein Dashboard-Sidebar
      const dashboardSidebar = page.locator('aside.lg\\:w-72');
      await expect(dashboardSidebar).toHaveCount(0);
    });
  });

  test.describe('Responsive Design', () => {
    test('Mobile Menü sollte auf kleinem Screen funktionieren', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/de');

      // Desktop-Nav sollte versteckt sein
      const desktopNav = page.locator('div.hidden.md\\:flex');
      await expect(desktopNav.first()).not.toBeVisible();

      // Mobile Menu Button sollte sichtbar sein
      const menuButton = page.locator('button.md\\:hidden');
      await expect(menuButton).toBeVisible();

      await page.screenshot({ path: 'tests/screenshots/mobile-landing-new.png', fullPage: true });
    });
  });

  test.describe('Sprachen', () => {
    test('Deutsche Seite sollte laden', async ({ page }) => {
      await page.goto('/de');
      expect(page.url()).toContain('/de');
    });

    test('Englische Seite sollte laden', async ({ page }) => {
      await page.goto('/en');
      expect(page.url()).toContain('/en');
    });

    test('Französische Seite sollte laden', async ({ page }) => {
      await page.goto('/fr');
      expect(page.url()).toContain('/fr');
    });
  });
});
