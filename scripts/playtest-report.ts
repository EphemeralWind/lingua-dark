/// <reference types="node" />
// Tuning report over exported playtest logs (Prompt 5, docs/PLAYTEST.md).
//   npm run playtest-report -- <log.json> [more.json ...]    report on exported logs
//   npm run playtest-report -- --sample                       report on simulated players
//   npm run playtest-report -- --write-sample <out.json>      write the simulated log to a file
//   add --json to print the report as JSON instead of tables
import { readFileSync, writeFileSync } from 'node:fs';
import { parsePlaytestFile, PLAYTEST_FORMAT, type PlaytestEvent, type PlaytestFile } from '../src/playtest/log';
import { buildReport, formatReport } from '../src/playtest/report';
import { sampleLog } from '../src/playtest/sample';

const args = process.argv.slice(2);
const json = args.includes('--json');
const files = args.filter((a) => !a.startsWith('--'));

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

let events: PlaytestEvent[] = [];
if (args.includes('--write-sample')) {
  const out = files[0] ?? fail('usage: --write-sample <out.json>');
  const file: PlaytestFile = { game: 'lingua-dark', format: PLAYTEST_FORMAT, exportedAt: new Date(0).toISOString(), events: sampleLog() };
  writeFileSync(out, `${JSON.stringify(file, null, 1)}\n`);
  console.log(`wrote ${file.events.length} sample events to ${out}`);
  process.exit(0);
} else if (args.includes('--sample')) {
  events = sampleLog();
} else {
  if (files.length === 0) fail('usage: npm run playtest-report -- <log.json> [...]  (or --sample)');
  for (const f of files) {
    try {
      events.push(...parsePlaytestFile(readFileSync(f, 'utf8')));
    } catch (e) {
      fail(`${f}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

const report = buildReport(events);
console.log(json ? JSON.stringify(report, null, 2) : formatReport(report));
