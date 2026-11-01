import { inspectPath, readStateFile } from '../src/disk';
import { materialize } from '../src/candidate-snapshot';
import { join } from 'node:path';
import { candidateEntryContracts, type CandidateEntryFixture } from './support/candidate-entry-contract';

function copiedEntry(copy: typeof materialize, fixture: CandidateEntryFixture): string | null {
  copy(fixture.cwd, fixture.destination, null);
  const entry = inspectPath(join(fixture.destination, fixture.relative));
  if (entry.kind === 'absent') return null;
  if (entry.kind !== 'file' || entry.content === null) throw new Error('copy did not retain a regular entry');
  return entry.content.toString('utf8');
}

candidateEntryContracts('guarded state reads', fixture => readStateFile(fixture.path));
candidateEntryContracts('shared candidate materialization', fixture => copiedEntry(materialize, fixture));
