import { test, expect, Page } from '@playwright/test';

// In-memory mock data
const MOCK_EVENTS = [
  { id: 1, name: 'Inviton Summit 2026', date: '2026-06-15T09:00:00.000Z', endDate: '2026-06-16T18:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' },
];
const MOCK_TICKET_TYPES = [
  { id: 1, eventId: 1, name: 'Standard' },
  { id: 2, eventId: 1, name: 'VIP' },
  { id: 3, eventId: 1, name: 'Premium' },
];
const MOCK_TEMPLATES = [
  { id: 1, name: 'Welcome', subject: 'Welcome!', body: 'Hi there' },
  { id: 2, name: 'Event Reminder', subject: 'Reminder!', body: 'Coming soon' },
  { id: 3, name: 'Thank You', subject: 'Thanks!', body: 'Thanks for coming' },
];

let automations: any[] = [];
let nextId = 1;

function setupApiMocks(page: Page) {
  // Reset state per test
  automations = [];
  nextId = 1;

  page.route('**/api/events', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: MOCK_EVENTS });
    } else {
      await route.continue();
    }
  });

  page.route('**/api/events/*/ticket-types', async (route) => {
    await route.fulfill({ json: MOCK_TICKET_TYPES });
  });

  page.route('**/api/templates', async (route) => {
    await route.fulfill({ json: MOCK_TEMPLATES });
  });

  page.route('**/api/events/*/automations', async (route) => {
    if (route.request().method() === 'GET') {
      // Return automations with nested template and ticketType
      const enriched = automations.map((a) => ({
        ...a,
        template: MOCK_TEMPLATES.find((t) => t.id === a.templateId) ?? null,
        ticketType: a.ticketTypeId ? MOCK_TICKET_TYPES.find((t) => t.id === a.ticketTypeId) ?? null : null,
      }));
      await route.fulfill({ json: enriched });
    } else if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      const newAutomation = {
        id: nextId++,
        eventId: 1,
        name: body.name,
        triggerType: body.triggerType,
        daysOffset: body.daysOffset ?? null,
        templateId: body.templateId,
        ticketTypeId: body.ticketTypeId ?? null,
        pdfPath: body.pdfPath ?? null,
        active: false,
        sentCount: 0,
        createdAt: new Date().toISOString(),
      };
      automations.push(newAutomation);
      await route.fulfill({ status: 201, json: newAutomation });
    }
  });

  page.route('**/api/automations/*/toggle', async (route) => {
    const url = route.request().url();
    const idMatch = url.match(/\/automations\/(\d+)\/toggle/);
    const id = idMatch ? Number(idMatch[1]) : -1;
    const automation = automations.find((a) => a.id === id);
    if (automation) {
      automation.active = !automation.active;
      await route.fulfill({ json: automation });
    } else {
      await route.fulfill({ status: 404, json: { error: 'Not found' } });
    }
  });

  page.route(/\/api\/automations\/\d+$/, async (route) => {
    const url = route.request().url();
    const idMatch = url.match(/\/automations\/(\d+)$/);
    const id = idMatch ? Number(idMatch[1]) : -1;

    if (route.request().method() === 'DELETE') {
      automations = automations.filter((a) => a.id !== id);
      await route.fulfill({ json: { message: 'Deleted' } });
    } else if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      const idx = automations.findIndex((a) => a.id === id);
      if (idx !== -1) {
        automations[idx] = { ...automations[idx], ...body };
        await route.fulfill({ json: automations[idx] });
      }
    } else {
      await route.continue();
    }
  });

  page.route('**/api/automations/*/test', async (route) => {
    await route.fulfill({ json: { message: 'Test email sent' } });
  });

  page.route('**/api/upload/pdf', async (route) => {
    await route.fulfill({ json: { path: '/uploads/test.pdf' } });
  });
}

test.describe('Email Automation Module', () => {

  test.beforeEach(async ({ page }) => {
    setupApiMocks(page);
    await page.goto('/');
    // Wait for events to load
    await expect(page.getByTestId('event-selector')).toBeVisible();
  });

  test('should display the automation list page', async ({ page }) => {
    await expect(page.getByTestId('event-selector')).toBeVisible();
    await expect(page.getByTestId('add-automation-btn')).toBeVisible();
  });

  test('should create an "after purchase" automation', async ({ page }) => {
    await page.getByTestId('add-automation-btn').click();

    await page.getByTestId('campaign-name-input').fill('Welcome Email');
    await page.getByTestId('trigger-type-select').selectOption('after_purchase');
    await page.getByTestId('days-offset-input').fill('0');
    await page.getByTestId('template-select').selectOption({ index: 1 });

    await expect(page.getByTestId('ticket-type-select')).toBeVisible();
    await expect(page.getByTestId('pdf-upload')).toBeVisible();

    await page.getByTestId('save-btn').click();

    await expect(page.getByTestId('automation-row')).toHaveCount(1);
    await expect(page.getByText('Welcome Email')).toBeVisible();
  });

  test('should create a "before event" automation with VIP filter', async ({ page }) => {
    await page.getByTestId('add-automation-btn').click();

    await page.getByTestId('campaign-name-input').fill('VIP Pre-Event Info');
    await page.getByTestId('trigger-type-select').selectOption('before_event');
    await page.getByTestId('days-offset-input').fill('3');
    await page.getByTestId('template-select').selectOption({ index: 1 });

    const ticketSelect = page.getByTestId('ticket-type-select');
    await ticketSelect.selectOption({ label: 'VIP' });

    await page.getByTestId('save-btn').click();

    await expect(page.getByText('VIP Pre-Event Info')).toBeVisible();
  });

  test('should hide days/ticket-filter/pdf for reminder type', async ({ page }) => {
    await page.getByTestId('add-automation-btn').click();

    await page.getByTestId('trigger-type-select').selectOption('reminder');

    await expect(page.getByTestId('days-offset-input')).not.toBeVisible();
    await expect(page.getByTestId('ticket-type-select')).not.toBeVisible();
    await expect(page.getByTestId('pdf-upload')).not.toBeVisible();
  });

  test('should toggle automation active/inactive', async ({ page }) => {
    // Create an automation first
    await page.getByTestId('add-automation-btn').click();
    await page.getByTestId('campaign-name-input').fill('Toggle Test');
    await page.getByTestId('trigger-type-select').selectOption('after_purchase');
    await page.getByTestId('days-offset-input').fill('1');
    await page.getByTestId('template-select').selectOption({ index: 1 });
    await page.getByTestId('save-btn').click();

    // Toggle it — the checkbox is visually hidden (opacity:0), click with force
    const toggle = page.getByTestId('automation-toggle').first();
    await toggle.click({ force: true });

    await expect(toggle).toBeChecked();
  });

  test('should delete an automation', async ({ page }) => {
    // Handle the confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Create one
    await page.getByTestId('add-automation-btn').click();
    await page.getByTestId('campaign-name-input').fill('Delete Me');
    await page.getByTestId('trigger-type-select').selectOption('after_purchase');
    await page.getByTestId('days-offset-input').fill('1');
    await page.getByTestId('template-select').selectOption({ index: 1 });
    await page.getByTestId('save-btn').click();

    await expect(page.getByText('Delete Me')).toBeVisible();

    // Delete it
    await page.getByTestId('automation-delete').first().click();

    await expect(page.getByText('Delete Me')).not.toBeVisible();
  });

  test('should reject PDF larger than 2MB', async ({ page }) => {
    await page.getByTestId('add-automation-btn').click();
    await page.getByTestId('trigger-type-select').selectOption('after_purchase');

    // Create a fake large file (3MB)
    const largeBuffer = Buffer.alloc(3 * 1024 * 1024);
    await page.getByTestId('pdf-upload').setInputFiles({
      name: 'large.pdf',
      mimeType: 'application/pdf',
      buffer: largeBuffer,
    });

    await expect(page.getByTestId('pdf-error')).toBeVisible();
    await expect(page.getByTestId('pdf-error')).toContainText(/2\s*MB/i);
  });

  test('should show sent count for automations', async ({ page }) => {
    await page.getByTestId('add-automation-btn').click();
    await page.getByTestId('campaign-name-input').fill('Count Test');
    await page.getByTestId('trigger-type-select').selectOption('after_purchase');
    await page.getByTestId('days-offset-input').fill('0');
    await page.getByTestId('template-select').selectOption({ index: 1 });
    await page.getByTestId('save-btn').click();

    await expect(page.getByTestId('sent-count').first()).toContainText('0');
  });

  test('should send test email preview', async ({ page }) => {
    await page.getByTestId('add-automation-btn').click();
    await page.getByTestId('campaign-name-input').fill('Test Preview');
    await page.getByTestId('trigger-type-select').selectOption('before_event');
    await page.getByTestId('days-offset-input').fill('2');
    await page.getByTestId('template-select').selectOption({ index: 1 });
    await page.getByTestId('save-btn').click();

    await expect(page.getByText('Test Preview')).toBeVisible();
  });
});
