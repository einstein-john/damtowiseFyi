import { asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../client.js";
import { tags, type TagRow } from "../schema.js";

export async function listTags(db: Database): Promise<TagRow[]> {
  return db.select().from(tags).orderBy(asc(tags.name));
}

export async function findTagById(db: Database, id: string): Promise<TagRow | null> {
  const [row] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return row ?? null;
}

export async function findTagBySlug(db: Database, slug: string): Promise<TagRow | null> {
  const [row] = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return row ?? null;
}

export async function insertTag(
  db: Database,
  row: { name: string; slug: string },
): Promise<TagRow> {
  const [inserted] = await db.insert(tags).values(row).returning();
  if (!inserted) throw new Error("Inserting tag returned no row");
  return inserted;
}

export async function updateTag(
  db: Database,
  id: string,
  fields: Partial<{ name: string; slug: string }>,
): Promise<TagRow | null> {
  const [updated] = await db.update(tags).set(fields).where(eq(tags.id, id)).returning();
  return updated ?? null;
}

export async function deleteTag(db: Database, id: string): Promise<boolean> {
  const deleted = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
  return deleted.length > 0;
}

/** Returns the subset of `tagIds` that exist, so callers can reject unknown ids. */
export async function resolveTagIds(db: Database, tagIds: readonly string[]): Promise<string[]> {
  if (tagIds.length === 0) return [];
  const rows = await db.select({ id: tags.id }).from(tags).where(inArray(tags.id, [...tagIds]));
  return rows.map((row) => row.id);
}