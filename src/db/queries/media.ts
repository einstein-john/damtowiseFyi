import { desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import { media, posts, worklogItems, type MediaRow, type NewMediaRow } from "../schema.js";

export interface MediaReferenceCounts {
  coverOfPosts: number;
  insidePostBodies: number;
  worklogItems: number;
}

export async function findMediaByIds(db: Database, ids: readonly string[]): Promise<MediaRow[]> {
  if (ids.length === 0) return [];
  return db.select().from(media).where(inArray(media.id, [...ids]));
}

export async function findMediaById(db: Database, id: string): Promise<MediaRow | null> {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return row ?? null;
}

export async function listMedia(
  db: Database,
  page: { page: number; pageSize: number },
): Promise<{ items: MediaRow[]; total: number }> {
  const [items, counts] = await Promise.all([
    db
      .select()
      .from(media)
      .orderBy(desc(media.createdAt), media.id)
      .limit(page.pageSize)
      .offset((page.page - 1) * page.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(media),
  ]);

  return { items, total: counts[0]?.count ?? 0 };
}

export async function insertMedia(db: Database, row: NewMediaRow): Promise<MediaRow> {
  const [inserted] = await db.insert(media).values(row).returning();
  if (!inserted) throw new Error("Inserting media returned no row");
  return inserted;
}

export async function updateMediaFields(
  db: Database,
  id: string,
  fields: Partial<Pick<MediaRow, "alt" | "caption" | "decorative">>,
): Promise<MediaRow | null> {
  const [updated] = await db.update(media).set(fields).where(eq(media.id, id)).returning();
  return updated ?? null;
}

export async function deleteMediaRow(db: Database, id: string): Promise<boolean> {
  const deleted = await db.delete(media).where(eq(media.id, id)).returning({ id: media.id });
  return deleted.length > 0;
}

/**
 * A media row can go only when nothing points at it: a post cover, an image
 * embedded in a post body, or a work log entry.
 */
export async function countMediaReferences(db: Database, id: string): Promise<MediaReferenceCounts> {
  const reference = `%media:${id}%`;

  const [cover, body, worklog] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(posts).where(eq(posts.coverMediaId, id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(sql`${posts.contentMd} LIKE ${reference}`),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(worklogItems)
      .where(eq(worklogItems.mediaId, id)),
  ]);

  return {
    coverOfPosts: cover[0]?.count ?? 0,
    insidePostBodies: body[0]?.count ?? 0,
    worklogItems: worklog[0]?.count ?? 0,
  };
}

export function totalMediaReferences(counts: MediaReferenceCounts): number {
  return counts.coverOfPosts + counts.insidePostBodies + counts.worklogItems;
}

/** Alt-text policy: either decorative, or given a non-empty description. */
export function hasUsableAlt(row: Pick<MediaRow, "alt" | "decorative">): boolean {
  return row.decorative || (typeof row.alt === "string" && row.alt.trim().length > 0);
}