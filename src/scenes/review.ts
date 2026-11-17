// Bonfire review round (SPEC 6): a few due components, asked as typed fill-ins with no cards,
// no enemy and no timer. These are untelegraphed answers, so they count toward mastery.
import { judgeWord } from '../combat/riposte';
import type { RiposteVerdict } from '../combat/types';
import type { Question } from '../content/types';
import type { InputEvent } from '../platform/input';
import type { Renderer } from '../platform/renderer';
import type { RiposteInput } from '../platform/riposteInput';
import { C } from './fight';

type Phase = 'asking' | 'feedback' | 'done';

interface Result {
  typed: string;
  answer: string;
  verdict: RiposteVerdict;
}

export class Review {
  private phase: Phase = 'asking';
  private index = 0;
  private open = false;
  private pending: string | null = null;
  private results: Result[] = [];
  finished = false;

  constructor(
    private readonly questions: readonly Question[],
    private readonly input: RiposteInput,
    private readonly setTextMode: (on: boolean) => void,
    /** Called once per answer with the question and whether it was right. */
    private readonly onAnswer: (q: Question, correct: boolean) => void,
    /** Zone 1 forgives a missing accent (DECISIONS #11). */
    private readonly forgiveAccents: boolean,
  ) {
    if (questions.length === 0) this.phase = 'done';
  }

  get correctCount(): number {
    return this.results.filter((r) => r.verdict !== 'wrong').length;
  }

  get answered(): number {
    return this.results.length;
  }

  update(events: InputEvent[]): void {
    const q = this.questions[this.index];
    if (this.phase === 'asking' && q) {
      if (!this.open) this.openInput();
      if (this.pending !== null) {
        const strike = q.strikes[0];
        if (!strike) throw new Error(`review question ${q.id} has no strike`);
        const answer = strike.options[strike.correct];
        const verdict = judgeWord(this.pending, answer, this.forgiveAccents);
        this.results.push({ typed: this.pending, answer, verdict });
        this.pending = null;
        this.closeInput();
        this.onAnswer(q, verdict !== 'wrong');
        this.phase = 'feedback';
      }
      return;
    }
    for (const ev of events) {
      if (ev.type !== 'confirm') continue;
      if (this.phase === 'feedback') {
        this.index += 1;
        this.phase = this.index < this.questions.length ? 'asking' : 'done';
      } else if (this.phase === 'done') {
        this.finished = true;
      }
      break;
    }
  }

  dispose(): void {
    if (this.open) this.closeInput();
  }

  private openInput(): void {
    this.open = true;
    this.setTextMode(true);
    this.input.open(() => {
      if (this.phase === 'asking' && this.pending === null) this.pending = this.input.value;
    });
  }

  private closeInput(): void {
    this.open = false;
    this.input.close();
    this.setTextMode(false);
  }

  render(r: Renderer, footer: string): void {
    r.begin(C.sky);
    const g = r.low;
    g.fillStyle = C.floor;
    g.fillRect(0, 120, 320, 60);
    // Bonfire: a stack of flame triangles.
    g.fillStyle = C.ember;
    for (let i = 0; i < 10; i++) g.fillRect(160 - (10 - i), 150 - i * 2, (10 - i) * 2, 2);
    g.fillStyle = C.barBack;
    g.fillRect(16, 26, 288, 84);
    r.present();

    const total = this.questions.length;
    if (this.phase === 'done') {
      r.text('REST COMPLETE', 160, 40, { size: 10, align: 'center', bold: true, color: C.signal });
      const line = total === 0 ? 'Nothing to review right now.' : `Review: ${this.correctCount} of ${this.answered} correct.`;
      r.text(line, 160, 56, { size: 7, align: 'center' });
      r.text('Vitality and flasks refilled. Enemies have risen again. Game saved.', 160, 70, { size: 6, align: 'center', color: C.dim, maxWidth: 280 });
      r.text(footer, 160, 84, { size: 6, align: 'center', color: C.dim, maxWidth: 280 });
      r.text('Press Enter', 160, 100, { size: 7, align: 'center', color: C.signal });
      return;
    }

    const q = this.questions[this.index];
    if (!q) return;
    r.text(`BONFIRE REVIEW ${this.index + 1}/${total}`, 160, 12, { size: 8, align: 'center', bold: true, color: C.ember });
    r.text('Type the missing word. No timer.', 160, 20, { size: 5, align: 'center', color: C.dim });
    const res = this.phase === 'feedback' ? this.results[this.results.length - 1] : undefined;
    const fill = res ? `[${res.answer}]` : `[${this.input.value}▌]`;
    r.text(q.sentence.replace('___', fill), 160, 44, { size: 8, align: 'center', maxWidth: 280 });
    r.text(q.prompt ?? '', 160, 58, { size: 6, align: 'center', color: C.dim, maxWidth: 280 });
    if (res) {
      const line =
        res.verdict === 'exact'
          ? `✓ ${res.answer}`
          : res.verdict === 'accent'
            ? `≈ ${res.typed} → ${res.answer} (mind the accent)`
            : `✗ ${res.typed || '(blank)'} → ${res.answer}`;
      r.text(line, 160, 76, { size: 7, align: 'center', color: res.verdict === 'wrong' ? C.hurt : C.signal });
      r.text('Press Enter', 160, 96, { size: 6, align: 'center', color: C.dim });
    } else {
      r.text('Enter to answer', 160, 96, { size: 6, align: 'center', color: C.dim });
    }
    r.text(`${q.id}#${q.seed}`, 316, 176, { size: 4, color: C.enemyDark, align: 'right' });
  }
}
