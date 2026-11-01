import { closeSync, readSync, writeFileSync } from 'node:fs';
import { openRegular } from '../disk';
import { signVerdict, verifyVerdict } from '../verdict-attestation';
import { signAdmissionVerdict, admitVerdict } from '../admission-evidence';

function readBounded(file: string, cap = 64 * 1024): Buffer {
  const fd = openRegular(file, '; attestation inputs must be regular files');
  if (fd === null) throw new Error('attestation input not found');
  try {
    const buffer = Buffer.alloc(cap + 1);
    let total = 0;
    while (total < buffer.length) {
      const n = readSync(fd, buffer, total, buffer.length - total, null);
      if (n === 0) break;
      total += n;
    }
    if (total === buffer.length) throw new Error(`attestation input exceeds ${cap / 1024} KiB`);
    return buffer.subarray(0, total);
  } finally { closeSync(fd); }
}
export function runAttestation(args: string[]): number {
  const [sub, ...rest] = args;
  if (sub !== 'sign' && sub !== 'verify' && sub !== 'admit') throw new Error('attestation requires sign | verify | admit');
  const flags = new Map<string, string>();
  const allowed = sub === 'sign' ? ['--payload', '--key', '--out', '--schema-version', '--evidence', '--sha256'] : ['--statement', '--key', '--expect'];
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i], value = rest[i + 1];
    if (!allowed.includes(name) || flags.has(name) || !value || value.startsWith('--')) throw new Error('invalid or duplicate attestation argument');
    flags.set(name, value);
  }
  const required = (name: string): string => { const value = flags.get(name); if (!value) throw new Error(`attestation ${sub} requires ${name}`); return value; };
  if (sub === 'sign') {
    const out = required('--out');
    const version = flags.get('--schema-version') ?? '1';
    if (version !== '1' && version !== '2') throw new Error('attestation schema-version must be 1 or 2');
    if (version === '1' && (flags.has('--evidence') || flags.has('--sha256'))) throw new Error('verification evidence requires attestation schema-version 2');
    const payload = JSON.parse(readBounded(required('--payload')).toString('utf8'));
    const key = readBounded(required('--key'));
    const signed = version === '2'
      ? signAdmissionVerdict(payload, readBounded(required('--evidence'), 256 * 1024), required('--sha256'), key)
      : signVerdict(payload, key);
    // Fresh output only: do not overwrite an existing claim or follow a link.
    writeFileSync(out, JSON.stringify(signed) + '\n', { flag: 'wx', mode: 0o600 });
    process.stdout.write(signed.schema_version === 2
      ? `suite evidence signed; oracle assurance: ${signed.statement.assurance}; ${signed.statement.oracle_assurance.limitation}\n`
      : 'verdict statement signed\n');
  } else if (sub === 'admit') {
    const admitted = admitVerdict(JSON.parse(readBounded(required('--statement')).toString('utf8')), readBounded(required('--key')), JSON.parse(readBounded(required('--expect')).toString('utf8')));
    process.stdout.write(`admission accepted: ${admitted.verdict}; oracle assurance: ${admitted.assurance}; ${admitted.oracle_assurance.limitation}\n`);
  } else {
    verifyVerdict(JSON.parse(readBounded(required('--statement')).toString('utf8')), readBounded(required('--key')), JSON.parse(readBounded(required('--expect')).toString('utf8')));
    process.stdout.write('verdict statement valid for the expected binding\n');
  }
  return 0;
}
