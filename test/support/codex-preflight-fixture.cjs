#!/usr/bin/env node
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const mode = process.env.TW_CODEX_PREFLIGHT_FIXTURE_MODE;
const versionMarker = join(__dirname, 'version-executed');

if (process.argv[2] !== '--version') {
  writeFileSync(join(__dirname, 'runtime-executed'), 'unexpected');
} else {
  writeFileSync(join(__dirname, 'metadata-attempted'), 'started');
  if (mode === 'normal') {
    console.log('codex-cli 0.0.1');
  } else if (mode === 'mark') {
    writeFileSync(versionMarker, 'unexpected');
  } else if (mode === 'stall') {
    process.on('SIGTERM', () => {});
    setTimeout(() => {
      writeFileSync(versionMarker, 'late');
      console.log('codex-cli 0.0.1');
    }, 10000);
  } else {
    process.exitCode = 2;
  }
}
