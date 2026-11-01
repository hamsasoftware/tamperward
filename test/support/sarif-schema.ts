import Ajv from 'ajv';
import { expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const officialSchema = JSON.parse(readFileSync(join(__dirname, '../fixtures/sarif/sarif-schema-2.1.0.json'), 'utf8'));
const { $schema, id, ...compatibleSchema } = officialSchema;
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addFormat('uri', value => !/[\s<>"{}|\\^`]/u.test(value) && URL.canParse(value));
ajv.addFormat('uri-reference', value => !/[\s<>"{}|\\^`]/u.test(value) && URL.canParse(value, 'https://example.com/'));
ajv.addFormat('date-time', value => Number.isFinite(Date.parse(value)));
const validateSarif = ajv.compile(compatibleSchema);

export function expectSarif(document: unknown): void {
  expect(validateSarif(document), JSON.stringify(validateSarif.errors)).toBe(true);
}
