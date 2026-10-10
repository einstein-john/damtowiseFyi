import { asc, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { slugRedirects, type SlugRedirectRow } from "../schema.js";

export async function listRedirects(db: Database): Promise<SlugRedirectRow[]> {
  return db.select().from(slugRedirects).orderBy(asc(slugRedirects.oldSlug));
}

/**
 * Records a slug move. Re-pointing an existing redirect at the newest post keeps
 * chains from growing; the site only ever needs one hop.
 */
export async function recordRedirect(db: Database, oldSlug: string, newSlug: string): Promise<void> {
  if (oldSlug === newSlug) return;
  await db
    .insert(slugRedirects)
    .values({ oldSlug, newSlug })
    .onConflictDoUpdate({ target: slugRedirects.oldSlug, set: { newSlug } });
}

export async function deleteRedirect(db: Database, oldSlug: string): Promise<boolean> {
  const deleted = await db
    .delete(slugRedirects)
    .where(eq(slugRedirects.oldSlug, oldSlug))
    .returning({ oldSlug: slugRedirects.oldSlug });
  return deleted.length > 0;
}