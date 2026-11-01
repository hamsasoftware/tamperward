const fs = require('node:fs');
const { spawn } = require('node:child_process');

fs.appendFileSync(process.env.TW_PROCESS_PIDS, `${JSON.stringify({ pid: process.pid, detached: process.argv[2] === 'holder' })}\n`);
setTimeout(() => process.exit(99), 12000);

if (process.argv[2] !== 'holder' && process.env.TW_PROCESS_SCENARIO === 'inherited-pipes') {
  fs.writeSync(1, 'stdout:partial\n');
  fs.writeSync(2, 'stderr:partial\n');
  const holder = spawn(process.execPath, [__filename, 'holder'], {
    detached: true,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (!holder.pid) throw new Error('inherited-pipe holder did not start');
  fs.appendFileSync(process.env.TW_PROCESS_PIDS, `${JSON.stringify({ pid: holder.pid, detached: true })}\n`);
  holder.unref();
  fs.writeFileSync(process.env.TW_PROCESS_MAIN_EXITED, 'exit:0\n');
  process.exit(0);
} else if (process.argv[2] !== 'holder') {
  fs.writeSync(1, 'stdout:complete\n');
  fs.writeSync(2, 'stderr:complete\n');
  if (process.env.TW_PROCESS_SCENARIO === 'complete') process.exit(0);
  if (process.env.TW_PROCESS_SCENARIO === 'nonzero') process.exit(7);
  if (process.env.TW_PROCESS_SCENARIO === 'crash') process.kill(process.pid, 'SIGKILL');
  process.on('SIGTERM', () => {});
}
