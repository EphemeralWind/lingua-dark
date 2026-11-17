// Boots the game and clears the first encounter (SPEC 10).
// The page never exposes answers. The test reads only the public phase and the
// question tag (id and seed, printed on screen for bug reports), then recomputes the
// correct direction in Node from the same pure content module (DECISIONS #30).
import { expect, test, type Page } from '@playwright/test';
import { buildQuestion, specById } from '../src/content/handwritten';
import type { Direction, Question } from '../src/content/types';

const KEY: Record<Direction, string> = { north: 'ArrowUp', east: 'ArrowRight', south: 'ArrowDown', west: 'ArrowLeft' };

async function dataset(page: Page): Promise<Record<string, string | undefined>> {
  return page.evaluate(() => ({ ...document.body.dataset }));
}

function questionFromTag(tag: string): Question {
  const [id, seed] = tag.split('#');
  return buildQuestion(specById(id!), Number(seed));
}

test('boots and clears a first encounter', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?seed=12345');
  await expect.poll(async () => (await dataset(page)).phase).toBe('ready');
  await page.keyboard.press('Enter');

  let answeredDeadline = '';
  let lastQuestion: Question | null = null;
  const deadlineAt = Date.now() + 100_000;

  while (Date.now() < deadlineAt) {
    const ds = await dataset(page);
    if (ds.phase === 'won' || ds.phase === 'lost') break;

    if (ds.phase === 'windup' && ds.deadline !== answeredDeadline && ds.question && ds.strike) {
      const q = questionFromTag(ds.question);
      const strike = q.strikes[Number(ds.strike)]!;
      await page.keyboard.press(KEY[strike.correct]);
      answeredDeadline = ds.deadline ?? '';
      lastQuestion = q;
    } else if (ds.phase === 'riposte' && lastQuestion) {
      for (const s of lastQuestion.strikes) {
        await page.keyboard.type(s.options[s.correct]);
        await page.keyboard.press('Enter');
      }
      await expect.poll(async () => (await dataset(page)).phase).not.toBe('riposte');
    }
    await page.waitForTimeout(30);
  }

  expect((await dataset(page)).phase).toBe('won');
  expect(errors).toEqual([]);
});
