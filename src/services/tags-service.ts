import type { TagInput, TagPatch } from "../contracts/index.js";
import {
  deleteTag as deleteTagRow,
  findTagById,
  findTagBySlug,
  insertTag,
  listTags,
  updateTag,
} from "../db/queries/tags.js";
import type { TagRow } from "../db/schema.js";
import { conflict, notFound } from "../lib/http/errors.js";
import { slugify } from "../lib/slug.js";
import type { ServiceContext } from "./context.js";

function deriveSlug(name: string, explicit: string | undefined): string {
  const slug = explicit ?? slugify(name);
  if (!slug) throw conflict("Tag name does not produce a usable slug");
  return slug;
}

export async function listAllTags(ctx: ServiceContext): Promise<TagRow[]> {
  return listTags(ctx.db);
}

export async function createTag(ctx: ServiceContext, input: TagInput): Promise<TagRow> {
  const slug = deriveSlug(input.name, input.slug);
  if (await findTagBySlug(ctx.db, slug)) throw conflict(`Tag slug "${slug}" is already in use`);

  return insertTag(ctx.db, { name: input.name, slug });
}

export async function updateTagById(
  ctx: ServiceContext,
  id: string,
  patch: TagPatch,
): Promise<TagRow> {
  const existing = await findTagById(ctx.db, id);
  if (!existing) throw notFound("Tag not found");

  const nextName = patch.name ?? existing.name;
  const nextSlug = deriveSlug(nextName, patch.slug);

  if (nextSlug !== existing.slug && (await findTagBySlug(ctx.db, nextSlug))) {
    throw conflict(`Tag slug "${nextSlug}" is already in use`);
  }

  const updated = await updateTag(ctx.db, id, { name: nextName, slug: nextSlug });
  if (!updated) throw notFound("Tag not found");
  return updated;
}

/** post_tags cascades in the database, so posts simply lose the tag. */
export async function deleteTag(ctx: ServiceContext, id: string): Promise<void> {
  const deleted = await deleteTagRow(ctx.db, id);
  if (!deleted) throw notFound("Tag not found");
  ctx.deployHook.trigger();
}