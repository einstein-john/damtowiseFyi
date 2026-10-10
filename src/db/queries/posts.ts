import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import {
  postTags,
  posts,
  tags,
  type NewPostRow,
  type PostRow,
  type TagRow,
} from "../schema.js";

export interface PostWithTags {
  post: PostRow;
  tags: TagRow[];
}

export interface ListPublishedOptions {
  tagSlug?: string;
  page: number;
  pageSize: number;
}

export async function listPublishedPosts(
  db: Database,
  options: ListPublishedOptions,
): Promise<{ items: PostWithTags[]; total: number }> {
  const tagFilter = options.tagSlug
    ? sql`exists (
         select 1 from ${postTags}
         join ${tags} on ${tags.id} = ${postTags.tagId}
         where ${postTags.postId} = ${posts.id} and ${tags.slug} = ${options.tagSlug}
       )`
    : sql`true`;

  const where = and(eq(posts.status, "published"), tagFilter);

  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(posts)
      .where(where)
      .orderBy(sql`${posts.publishedAt} desc nulls last`)
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(posts).where(where),
  ]);

  return { items: await attachTags(db, rows), total: counts[0]?.total ?? 0 };
}

export async function listAllPosts(
  db: Database,
  page: { page: number; pageSize: number },
): Promise<{ items: PostWithTags[]; total: number }> {
  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(posts)
      .orderBy(sql`${posts.updatedAt} desc`)
      .limit(page.pageSize)
      .offset((page.page - 1) * page.pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(posts),
  ]);

  return { items: await attachTags(db, rows), total: counts[0]?.total ?? 0 };
}

export async function findPostBySlug(db: Database, slug: string): Promise<PostWithTags | null> {
  const [row] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
  if (!row) return null;
  const [withTags] = await attachTags(db, [row]);
  return withTags ?? { post: row, tags: [] };
}

export async function findPostById(db: Database, id: string): Promise<PostWithTags | null> {
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) return null;
  const [withTags] = await attachTags(db, [row]);
  return withTags ?? { post: row, tags: [] };
}

export async function slugExists(db: Database, slug: string, excludingId?: string): Promise<boolean> {
  const where = excludingId
    ? and(eq(posts.slug, slug), ne(posts.id, excludingId))
    : eq(posts.slug, slug);
  const [row] = await db.select({ id: posts.id }).from(posts).where(where).limit(1);
  return row !== undefined;
}

/** Backs `uniqueSlug`; the desired slug is normalised before the lookup. */
export function makeSlugTakenCheck(db: Database, excludingId?: string) {
  return (candidate: string) => slugExists(db, candidate, excludingId);
}

export async function insertPost(db: Database, row: NewPostRow): Promise<PostRow> {
  const [inserted] = await db.insert(posts).values(row).returning();
  if (!inserted) throw new Error("Inserting post returned no row");
  return inserted;
}

export async function updatePostFields(
  db: Database,
  id: string,
  fields: Partial<NewPostRow>,
): Promise<PostRow | null> {
  const [updated] = await db
    .update(posts)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(posts.id, id))
    .returning();
  return updated ?? null;
}

export async function deletePost(db: Database, id: string): Promise<boolean> {
  const deleted = await db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
  return deleted.length > 0;
}

export async function setPostTags(db: Database, postId: string, tagIds: readonly string[]): Promise<void> {
  await db.delete(postTags).where(eq(postTags.postId, postId));
  if (tagIds.length === 0) return;
  await db.insert(postTags).values(tagIds.map((tagId) => ({ postId, tagId })));
}

export async function findPostsWithStatus(
  db: Database,
  status: PostRow["status"],
): Promise<PostRow[]> {
  return db.select().from(posts).where(eq(posts.status, status));
}

/** Earliest future `publishedAt` among scheduled posts; drives the in-memory timer. */
export async function findNextScheduledAt(db: Database, from: Date): Promise<Date | null> {
  const [row] = await db
    .select({ publishedAt: posts.publishedAt })
    .from(posts)
    .where(sql`${posts.status} = 'scheduled' and ${posts.publishedAt} is not null and ${posts.publishedAt} > ${from}`)
    .orderBy(asc(posts.publishedAt))
    .limit(1);

  return row?.publishedAt ?? null;
}

export async function findPostsDueForPublication(db: Database, now: Date): Promise<PostRow[]> {
  return db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.status, "scheduled"),
        sql`${posts.publishedAt} is not null and ${posts.publishedAt} <= ${now}`,
      ),
    )
    .orderBy(asc(posts.publishedAt));
}

async function attachTags(db: Database, rows: PostRow[]): Promise<PostWithTags[]> {
  if (rows.length === 0) return [];

  const links = await db
    .select({ postId: postTags.postId, tag: tags })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(inArray(postTags.postId, rows.map((row) => row.id)))
    .orderBy(asc(tags.name));

  const byPost = new Map<string, TagRow[]>();
  for (const link of links) {
    const existing = byPost.get(link.postId) ?? [];
    existing.push(link.tag);
    byPost.set(link.postId, existing);
  }

  return rows.map((post) => ({ post, tags: byPost.get(post.id) ?? [] }));
}