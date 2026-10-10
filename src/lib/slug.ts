/** Lowercase, hyphen-separated, ASCII-safe. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

/** Suffix search; `isTaken` is async so uniqueness can be checked against the database. */
export async function uniqueSlug(
  desired: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(desired) || "untitled";
  if (!(await isTaken(base))) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error(`Could not derive a unique slug from "${desired}"`);
}

/** Strips a leading/trailing slash; used when the site reports redirect targets. */
export function normalizePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}