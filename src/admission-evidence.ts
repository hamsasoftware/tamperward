import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { isRecord } from './narrow';
import { isSuiteExitAssurance, suiteExitAssurance, type OracleAssuranceReport } from './oracle-assurance';
import { parseVerdictBinding } from './verdict-attestation';

export interface AdmissionException {
  rule: 'verify';
  head: string;
  approval: string;
}
export interface AdmissionBinding {
  repository: string;
  head: string;
  base: string;
  tree: string;
  gate_version: string;
  policy_hash: string;
  verifier_hash: string;
  verdict: 'VERIFIED' | 'MASKED_FAILURE';
  assurance: 'suite-exit-only';
  exception: AdmissionException | null;
  audience: string;
  nonce: string;
}
export interface AdmissionPayload extends AdmissionBinding {
  schema_version: 2;
  issued_at: string;
  expires_at: string;
}
export interface AdmissionStatement extends AdmissionPayload {
  evidence_sha256: string;
  oracle_assurance: OracleAssuranceReport;
  stages: { candidate: 'PASS'; pristine: 'PASS' | 'FAIL'; integrity: 'CLEAN' };
}
export interface SignedAdmissionVerdict {
  schema_version: 2;
  algorithm: 'Ed25519';
  key_id: string;
  statement: AdmissionStatement;
  signature: string;
}

const BINDING_FIELDS = ['repository', 'head', 'base', 'tree', 'gate_version', 'policy_hash', 'verifier_hash', 'verdict', 'assurance', 'exception', 'audience', 'nonce'] as const;
const PAYLOAD_FIELDS = [...BINDING_FIELDS, 'schema_version', 'issued_at', 'expires_at'];
const IDENTITY_FIELDS = ['head', 'base', 'tree', 'gate_version', 'policy_hash', 'verifier_hash'] as const;
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function exactKeys(value: Record<string, unknown>, fields: readonly string[]): void {
  if (Object.keys(value).sort().join('\0') !== [...fields].sort().join('\0')) throw new Error('unexpected or missing admission evidence field');
}

export function parseAdmissionBinding(value: unknown): AdmissionBinding {
  if (!isRecord(value)) throw new Error('admission binding must be an object');
  exactKeys(value, BINDING_FIELDS);
  const common = parseVerdictBinding(Object.fromEntries(['head', 'base', 'gate_version', 'policy_hash', 'verdict', 'audience', 'nonce'].map(field => [field, value[field]])));
  if (typeof value.repository !== 'string' || !/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(value.repository)
    || !digest(value.tree) || !digest(value.verifier_hash)) throw new Error('invalid admission identity');
  if (value.assurance !== 'suite-exit-only') throw new Error('unsupported admission assurance; only suite-exit-only is supported');
  if (common.verdict !== 'VERIFIED' && common.verdict !== 'MASKED_FAILURE') throw new Error('admission requires VERIFIED or an explicit MASKED_FAILURE exception');
  let exception: AdmissionException | null = null;
  if (common.verdict === 'VERIFIED') {
    if (value.exception !== null) throw new Error('VERIFIED cannot carry an exception');
  } else {
    const candidate = value.exception;
    if (!isRecord(candidate)) throw new Error('MASKED_FAILURE requires an explicit exception');
    exactKeys(candidate, ['rule', 'head', 'approval']);
    if (candidate.rule !== 'verify' || candidate.head !== common.head
      || typeof candidate.approval !== 'string' || !/^[A-Za-z0-9:._/@-]{1,200}$/.test(candidate.approval)) throw new Error('invalid admission exception');
    exception = { rule: 'verify', head: common.head, approval: candidate.approval };
  }
  return {
    repository: value.repository, head: common.head, base: common.base, tree: value.tree,
    gate_version: common.gate_version, policy_hash: common.policy_hash, verifier_hash: value.verifier_hash,
    verdict: common.verdict, assurance: 'suite-exit-only', exception, audience: common.audience, nonce: common.nonce,
  };
}

function parsePayload(value: unknown): AdmissionPayload {
  if (!isRecord(value)) throw new Error('admission payload must be an object');
  exactKeys(value, PAYLOAD_FIELDS);
  const { schema_version, issued_at, expires_at, ...binding } = value;
  if (schema_version !== 2 || !timestamp(issued_at) || !timestamp(expires_at)) throw new Error('invalid admission payload timestamps');
  return { schema_version: 2, ...parseAdmissionBinding(binding), issued_at, expires_at };
}

function validTime(statement: AdmissionPayload, now: number): void {
  const issued = Date.parse(statement.issued_at), expires = Date.parse(statement.expires_at);
  if (!Number.isFinite(now) || issued > now + 60_000 || expires <= now || expires <= issued || expires - issued > 86_400_000) throw new Error('admission statement expired or outside its validity window');
}

function parseStatement(value: unknown): AdmissionStatement {
  if (!isRecord(value)) throw new Error('admission statement must be an object');
  exactKeys(value, [...PAYLOAD_FIELDS, 'evidence_sha256', 'oracle_assurance', 'stages']);
  const { evidence_sha256, oracle_assurance, stages, ...payload } = value;
  const statement = parsePayload(payload);
  if (!digest(evidence_sha256) || !isSuiteExitAssurance(oracle_assurance) || !isRecord(stages)) throw new Error('invalid admission completion evidence');
  exactKeys(stages, ['candidate', 'pristine', 'integrity']);
  const pristine = statement.verdict === 'VERIFIED' ? 'PASS' : 'FAIL';
  if (stages.candidate !== 'PASS' || stages.pristine !== pristine || stages.integrity !== 'CLEAN') throw new Error('admission stages contradict their verdict');
  return { ...statement, evidence_sha256, oracle_assurance: suiteExitAssurance(), stages: { candidate: 'PASS', pristine, integrity: 'CLEAN' } };
}

function completeProducer(value: Record<string, unknown>): boolean {
  const backend = value.verifier_backend, dependencies = value.dependency_environment;
  const count = (entry: unknown): entry is number => typeof entry === 'number' && Number.isInteger(entry) && entry >= 0;
  if (typeof value.command !== 'string' || value.command.trim().length === 0
    || typeof value.budget_secs !== 'number' || !Number.isFinite(value.budget_secs) || value.budget_secs <= 0
    || !count(value.protected_restored) || !count(value.added_protected_removed)
    || !isRecord(backend) || backend.available !== true || !isRecord(dependencies) || !Array.isArray(dependencies.roots)) return false;
  if (!dependencies.roots.every(root => isRecord(root) && (root.kind === 'node_modules' || root.kind === 'python-venv') && typeof root.path === 'string')) return false;
  if (backend.kind === 'local') return backend.trust === 'checkpointed-local' && (dependencies.status === 'none' || dependencies.status === 'attested');
  return backend.kind === 'container' && backend.trust === 'isolated-container' && backend.engine === 'docker'
    && typeof backend.image === 'string' && /^(?!-)[^\s@]+@sha256:[a-f0-9]{64}$/.test(backend.image)
    && dependencies.status === 'verifier-owned' && dependencies.image === backend.image;
}

function producerStages(value: unknown, payload: AdmissionPayload): AdmissionStatement['stages'] {
  if (!isRecord(value) || value.schema_version !== 1 || value.verdict !== payload.verdict
    || value.base !== payload.base || value.adjudicated_tree !== payload.tree
    || !isSuiteExitAssurance(value.oracle_assurance) || value.reason !== undefined || !completeProducer(value)) throw new Error('incomplete or mismatched verification evidence');
  const identity = value.evidence_binding;
  if (!isRecord(identity) || identity.completed !== true || identity.integrity !== 'CLEAN') throw new Error('verification evidence has no completed producer binding');
  for (const field of IDENTITY_FIELDS) if (identity[field] !== payload[field]) throw new Error(`verification producer binding mismatch: ${field}`);
  const visible = value.visible, pristine = value.pristine;
  const completeStage = (stage: unknown): stage is { exit: number; secs: number } => isRecord(stage)
    && typeof stage.exit === 'number' && Number.isInteger(stage.exit) && stage.exit >= 0 && stage.exit <= 255
    && typeof stage.secs === 'number' && Number.isFinite(stage.secs) && stage.secs >= 0
    && stage.failure === undefined && stage.reason === undefined && stage.pipeHeldOpen !== true;
  if (!completeStage(visible) || !completeStage(pristine) || visible.exit !== 0
    || (payload.verdict === 'VERIFIED' ? pristine.exit !== 0 : pristine.exit === 0)) throw new Error('verification stages are incomplete or contradict the verdict');
  if (payload.exception && value.oob_signoff !== payload.exception.approval) throw new Error('verification evidence does not establish the expected exception');
  if (!payload.exception && value.oob_signoff !== undefined) throw new Error('VERIFIED evidence cannot carry an exception');
  return { candidate: 'PASS', pristine: pristine.exit === 0 ? 'PASS' : 'FAIL', integrity: 'CLEAN' };
}

function keyId(key: KeyObject): string {
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('admission evidence requires an Ed25519 key');
  return createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex');
}

function signedBytes(statement: AdmissionStatement, key_id: string): Buffer {
  return Buffer.from('tamperward.verdict-statement.v2\0' + JSON.stringify({ algorithm: 'Ed25519', key_id, statement }), 'utf8');
}

export function signAdmissionVerdict(payload: unknown, evidence: Buffer, expectedSha256: string, privatePem: string | Buffer, now = Date.now()): SignedAdmissionVerdict {
  const parsed = parsePayload(payload);
  validTime(parsed, now);
  const evidence_sha256 = createHash('sha256').update(evidence).digest('hex');
  if (!digest(expectedSha256) || evidence_sha256 !== expectedSha256) throw new Error('verification evidence digest mismatch');
  const stages = producerStages(JSON.parse(evidence.toString('utf8')), parsed);
  const statement = { ...parsed, evidence_sha256, oracle_assurance: suiteExitAssurance(), stages };
  const key = createPrivateKey(privatePem), key_id = keyId(createPublicKey(key));
  return { schema_version: 2, algorithm: 'Ed25519', key_id, statement, signature: sign(null, signedBytes(statement, key_id), key).toString('base64url') };
}

export function admitVerdict(value: unknown, publicPem: string | Buffer, expected: unknown, now = Date.now()): AdmissionStatement {
  if (!isRecord(value)) throw new Error('signed admission verdict must be an object');
  exactKeys(value, ['schema_version', 'algorithm', 'key_id', 'statement', 'signature']);
  const binding = parseAdmissionBinding(expected), statement = parseStatement(value.statement);
  if (value.schema_version !== 2 || value.algorithm !== 'Ed25519' || typeof value.key_id !== 'string'
    || typeof value.signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(value.signature)) throw new Error('invalid signed admission envelope');
  const key = createPublicKey(publicPem);
  if (value.key_id !== keyId(key)) throw new Error('untrusted admission signing key');
  const signature = Buffer.from(value.signature, 'base64url');
  if (signature.length !== 64 || signature.toString('base64url') !== value.signature
    || !verify(null, signedBytes(statement, value.key_id), key, signature)) throw new Error('invalid admission signature');
  validTime(statement, now);
  for (const field of BINDING_FIELDS) if (JSON.stringify(statement[field]) !== JSON.stringify(binding[field])) throw new Error(`admission binding mismatch: ${field}`);
  return statement;
}
