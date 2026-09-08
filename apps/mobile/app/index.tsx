import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { getSavedBookmarksPage, type MobileBookmarkCursor, type MobileBookmark } from "../lib/bookmarks";

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  watching: "Watching",
  done: "Watched",
  dropped: "Dropped",
};

export default function SavedItemsScreen() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<MobileBookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cursor, setCursor] = useState<MobileBookmarkCursor>();
  const [loadingMore, setLoadingMore] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = await getSavedBookmarksPage();
      setBookmarks(data.bookmarks);
      setCursor(data.nextCursor);
      setError(null);
    } catch {
      setError("Could not load bookmarks.");
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: MobileBookmark }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push(`/bookmark/${item.id}`)}
      activeOpacity={0.7}
    >
      {item.poster_url ? (
        <Image source={{ uri: item.poster_url }} style={styles.poster} />
      ) : (
        <View style={[styles.poster, styles.posterPlaceholder]}>
          <Text style={styles.posterPlaceholderText}>
            {item.title.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.itemMeta}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.itemSub}>
          {item.type} · {STATUS_LABELS[item.status] ?? item.status}
          {item.release_year ? ` · ${item.release_year}` : ""}
        </Text>
        {item.metadata?.resolution_status === "needs_selection" ? (
          <Text style={styles.needsSelection}>Needs title match</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fafafa" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={bookmarks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          bookmarks.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#fafafa"
          />
        }
        ListFooterComponent={cursor ? (
          <TouchableOpacity disabled={loadingMore} style={styles.signOut} onPress={async () => {
            setLoadingMore(true);
            try {
              const page = await getSavedBookmarksPage(40, cursor);
              setBookmarks(previous => [...new Map([...previous, ...page.bookmarks].map(b => [b.id, b])).values()]);
              setCursor(page.nextCursor);
              setError(null);
            } catch { setError("Could not load more bookmarks. Please retry."); }
            finally { setLoadingMore(false); }
          }}><Text style={styles.signOutText}>{loadingMore ? "Loading…" : "Load more saved titles"}</Text></TouchableOpacity>
        ) : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptySub}>
              Share links to Watchmarks to save movies and shows.
            </Text>
          </View>
        }
        ListHeaderComponent={
          error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null
        }
      />
      <TouchableOpacity
        style={styles.signOut}
        onPress={() => signOut(auth)}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090b" },
  center: { flex: 1, backgroundColor: "#09090b", alignItems: "center", justifyContent: "center" },
  listContent: { paddingVertical: 8 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  empty: { alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#fafafa" },
  emptySub: { fontSize: 14, color: "#71717a", textAlign: "center" },
  error: { color: "#f87171", fontSize: 13, padding: 16 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#27272a",
  },
  poster: { width: 52, height: 78, borderRadius: 8 },
  posterPlaceholder: {
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  posterPlaceholderText: { color: "#71717a", fontWeight: "700", fontSize: 14 },
  itemMeta: { flex: 1, gap: 4 },
  itemTitle: { color: "#fafafa", fontSize: 15, fontWeight: "600", lineHeight: 20 },
  itemSub: { color: "#71717a", fontSize: 12 },
  needsSelection: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  signOut: { padding: 16, alignItems: "center" },
  signOutText: { color: "#71717a", fontSize: 14 },
});

