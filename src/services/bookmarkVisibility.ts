import type { Bookmark } from "@/types/database";

type VisibilityFlags = Pick<Partial<Bookmark>, "is_vaulted" | "is_public">;

function coerceFlag(value: boolean | undefined): boolean {
  return value === true;
}

export function assertBookmarkVisibilityExclusive(
  flags: VisibilityFlags,
  context = "bookmark",
): void {
  if (coerceFlag(flags.is_vaulted) && coerceFlag(flags.is_public)) {
    throw new Error(
      `${context} visibility is invalid: is_vaulted and is_public cannot both be true.`,
    );
  }
}

export function validateBookmarkCreateVisibility(flags: VisibilityFlags): void {
  assertBookmarkVisibilityExclusive(
    {
      is_vaulted: coerceFlag(flags.is_vaulted),
      is_public: coerceFlag(flags.is_public),
    },
    "Bookmark create",
  );
}

export function validateBookmarkUpdateVisibility(
  current: VisibilityFlags,
  updates: VisibilityFlags,
): void {
  assertBookmarkVisibilityExclusive(
    {
      is_vaulted:
        updates.is_vaulted !== undefined ? coerceFlag(updates.is_vaulted) : coerceFlag(current.is_vaulted),
      is_public:
        updates.is_public !== undefined ? coerceFlag(updates.is_public) : coerceFlag(current.is_public),
    },
    "Bookmark update",
  );
}
