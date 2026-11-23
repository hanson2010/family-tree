import { describe, expect, it } from 'vitest';
import { BucketTable, MAX_BYTES, TARGET_BYTES } from '../bucket-table';

type Row = { id: string; pad?: string };

const table = () => {
  let n = 0;
  return new BucketTable<Row>(() => `b${String(n++).padStart(3, '0')}`);
};
const pad = 'x'.repeat(10_000);

describe('BucketTable', () => {
  it('fills buckets up to the target size', () => {
    const t = table();
    for (let i = 0; i < 200; i++) t.put({ id: `p${i}`, pad });
    const sizes = [...t.bucketSizes().values()];
    expect(sizes).toHaveLength(3);
    sizes.forEach((s) => expect(s).toBeLessThanOrEqual(TARGET_BYTES));
  });

  it('reuses room freed by deletions', () => {
    const t = table();
    for (let i = 0; i < 200; i++) t.put({ id: `p${i}`, pad });
    for (let i = 0; i < 20; i++) t.remove(`p${i}`);
    for (let i = 0; i < 20; i++) t.put({ id: `q${i}`, pad });
    expect(t.bucketSizes().size).toBe(3);
  });

  it('moves an item that grows past the largest bucket size', () => {
    const t = table();
    for (let i = 0; i < 200; i++) t.put({ id: `p${i}`, pad });
    t.put({ id: 'p50', pad: 'y'.repeat(400_000) });
    [...t.bucketSizes().values()].forEach((s) => expect(s).toBeLessThanOrEqual(MAX_BYTES));
    expect(t.get('p50')?.pad).toHaveLength(400_000);
  });

  it('round-trips through stored buckets, with nothing marked changed', () => {
    const t = table();
    for (let i = 0; i < 100; i++) t.put({ id: `p${i}`, pad });
    const stored = [...t.bucketSizes().keys()].map((id) => ({ id, data: t.serialize(id) ?? '[]' }));
    const back = BucketTable.fromBuckets<Row>(stored, () => 'new');
    expect(back.size).toBe(100);
    expect(back.dirty.size).toBe(0);
  });

  it('marks an emptied bucket for deletion', () => {
    const t = table();
    t.put({ id: 'a' });
    t.remove('a');
    expect(t.serialize('b000')).toBeNull();
  });

  it('refuses an item larger than a bucket', () => {
    expect(() => table().put({ id: 'huge', pad: 'z'.repeat(MAX_BYTES) })).toThrow();
  });

  it('leaves the original unchanged when a clone changes', () => {
    const t = table();
    t.put({ id: 'a' });
    const copy = t.clone();
    copy.put({ id: 'b' });
    copy.remove('a');
    expect(t.get('a')).toBeDefined();
    expect(t.get('b')).toBeUndefined();
  });
});
