/**
 * Items (persons or relationships) packed into bucket documents, so loading everything takes a
 * few document reads instead of one per item. Each bucket is stored as one JSON string. New items
 * go into the first bucket with room up to TARGET_BYTES; an item that grows stays in its bucket
 * up to MAX_BYTES and otherwise moves to a bucket with room. Room freed by deletions is reused.
 */

/** New items fill a bucket up to this size, leaving room for edits that make items larger */
export const TARGET_BYTES = 700_000;
/** No bucket grows past this; Firestore allows 1 MiB per document */
export const MAX_BYTES = 950_000;

export interface Item {
  id: string;
}

/** Bytes an item adds to its bucket's JSON: the item and the comma before it */
const sizeOf = (item: Item) => Buffer.byteLength(JSON.stringify(item), 'utf8') + 1;

export class BucketTable<T extends Item> {
  private items = new Map<string, T>();
  private bucketOf = new Map<string, string>();
  private sizes = new Map<string, number>();
  /** Bytes of each bucket's JSON array: 2 for the brackets plus its items */
  private bucketBytes = new Map<string, number>();
  /** Buckets changed since the table was loaded or cloned */
  readonly dirty = new Set<string>();

  constructor(private readonly newBucketId: () => string) {}

  /** A table from stored buckets: each bucket's id and its JSON array of items */
  static fromBuckets<T extends Item>(buckets: { id: string; data: string }[], newBucketId: () => string): BucketTable<T> {
    const table = new BucketTable<T>(newBucketId);
    for (const bucket of buckets) {
      table.bucketBytes.set(bucket.id, 2);
      for (const item of JSON.parse(bucket.data) as T[]) table.add(item, bucket.id);
    }
    table.dirty.clear();
    return table;
  }

  /** A copy that can be changed without changing this table; items themselves are shared */
  clone(): BucketTable<T> {
    const copy = new BucketTable<T>(this.newBucketId);
    copy.items = new Map(this.items);
    copy.bucketOf = new Map(this.bucketOf);
    copy.sizes = new Map(this.sizes);
    copy.bucketBytes = new Map(this.bucketBytes);
    return copy;
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  all(): T[] {
    return [...this.items.values()];
  }

  get size(): number {
    return this.items.size;
  }

  /** Add or replace an item; items are replaced whole, never changed in place */
  put(item: T): void {
    const size = sizeOf(item);
    if (size + 2 > MAX_BYTES) throw new Error(`An item is too large to store (${size} bytes).`);
    const current = this.bucketOf.get(item.id);
    if (current !== undefined) {
      const bytes = this.bucketBytes.get(current)! - this.sizes.get(item.id)! + size;
      if (bytes <= MAX_BYTES) {
        this.items.set(item.id, item);
        this.sizes.set(item.id, size);
        this.bucketBytes.set(current, bytes);
        this.dirty.add(current);
        return;
      }
      this.remove(item.id);
    }
    this.add(item, this.bucketWithRoom(size));
  }

  remove(id: string): void {
    const bucket = this.bucketOf.get(id);
    if (bucket === undefined) return;
    this.bucketBytes.set(bucket, this.bucketBytes.get(bucket)! - this.sizes.get(id)!);
    this.items.delete(id);
    this.bucketOf.delete(id);
    this.sizes.delete(id);
    this.dirty.add(bucket);
  }

  /** Bucket ids with their JSON, or null for a bucket left empty (to be deleted) */
  serialize(bucketId: string): string | null {
    const items = [...this.items.values()].filter((item) => this.bucketOf.get(item.id) === bucketId);
    return items.length > 0 ? JSON.stringify(items) : null;
  }

  /** Each bucket's size in bytes, for checks and tests */
  bucketSizes(): Map<string, number> {
    return new Map(this.bucketBytes);
  }

  private add(item: T, bucket: string): void {
    const size = sizeOf(item);
    this.items.set(item.id, item);
    this.bucketOf.set(item.id, bucket);
    this.sizes.set(item.id, size);
    this.bucketBytes.set(bucket, (this.bucketBytes.get(bucket) ?? 2) + size);
    this.dirty.add(bucket);
  }

  /** The first bucket (by id) with room for `size` more bytes, or a new one */
  private bucketWithRoom(size: number): string {
    const ids = [...this.bucketBytes.keys()].sort();
    const found = ids.find((id) => this.bucketBytes.get(id)! + size <= TARGET_BYTES);
    if (found !== undefined) return found;
    const id = this.newBucketId();
    this.bucketBytes.set(id, 2);
    return id;
  }
}
