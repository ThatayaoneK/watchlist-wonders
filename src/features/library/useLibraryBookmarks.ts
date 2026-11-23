import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { bookmarkService, type BookmarkPageCursor } from "@/services/bookmarks";

export const LIBRARY_PAGE_SIZE = 40;

export function useLibraryBookmarks() {
  return useInfiniteQuery({
    queryKey: queryKeys.bookmarks.pages(LIBRARY_PAGE_SIZE),
    queryFn: ({ pageParam }) => bookmarkService.getBookmarksPage(LIBRARY_PAGE_SIZE, pageParam),
    initialPageParam: undefined as BookmarkPageCursor | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
