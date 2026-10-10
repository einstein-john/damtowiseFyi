import { asc, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { worklogItems, type WorklogRow } from "../schema.js";

export async function listWorklogItems(
  db: Database,
  options: { publishedOnly: boolean },
): Promise<WorklogRow[]> {
  const where = options.publishedOnly ? eq(worklogItems.published, true) : undefined;
  return db
    .select()
    .from(worklogItems)
    .where(where)
    .orderBy(asc(worklogItems.sortOrder), asc(worklogItems.createdAt));
}

export async function findWorklogItemById(db: Database, id: string): Promise<WorklogRow | null> {
  const [row] = await db.select().from(worklogItems).where(eq(worklogItems.id, id)).limit(1);
  return row ?? null;
}

export async function insertWorklogItem(
  db: Database,
  row: Omit<WorklogRow, "id" | "createdAt">,
): Promise<WorklogRow> {
  const [inserted] = await db.insert(worklogItems).values(row).returning();
  if (!inserted) throw new Error("Inserting work log item returned no row");
  return inserted;
}

export async function updateWorklogItem(
  db: Database,
  id: string,
  fields: Partial<Omit<WorklogRow, "id" | "createdAt">>,
): Promise<WorklogRow | null> {
  const [updated] = await db.update(worklogItems).set(fields).where(eq(worklogItems.id, id)).returning();
  return updated ?? null;
}

export async function deleteWorklogItem(db: Database, id: string): Promise<boolean> {
  const deleted = await db
    .delete(worklogItems)
    .where(eq(worklogItems.id, id))
    .returning({ id: worklogItems.id });
  return deleted.length > 0;
}

/** Used by the reorder endpoint in the admin UI. */
export async function updateWorklogOrder(
  db: Database,
  entries: ReadonlyArray<{ id: string; sortOrder: number }>,
): Promise<void> {
  if (entries.length === 0) return;
  await db.transaction(async (tx) => {
    for (const entry of entries) {
      await tx.update(worklogItems).set({ sortOrder: entry.sortOrder }).where(eq(worklogItems.id, entry.id));
    }
  });
}