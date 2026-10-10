import { findNextScheduledAt, findPostsDueForPublication } from "../db/queries/posts.js";
import { PostScheduler } from "../lib/scheduler/post-scheduler.js";
import type { ServiceContext } from "./context.js";
import { publishPost } from "./publish-service.js";

/** Binds the generic scheduler to the database and publish pipeline. */
export function createPostScheduler(ctx: ServiceContext): PostScheduler {
  return new PostScheduler({
    findNextDueAt: (after) => findNextScheduledAt(ctx.db, after),
    findDuePostIds: async (now) => (await findPostsDueForPublication(ctx.db, now)).map((post) => post.id),
    publish: async (postId) => {
      await publishPost(ctx, postId);
    },
    onError: (error, context) => console.error(`[scheduler] ${context}`, error),
  });
}