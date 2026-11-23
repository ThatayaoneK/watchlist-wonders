import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { getBookmark, type MobileBookmark } from "../../lib/bookmarks";

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  watching: "Watching",
  watched: "Watched",
  dropped: "Dropped",
};

export default function BookmarkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [bookmark, setBookmark] = useState<MobileBookmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void getBookmark(id)
      .then((b) => {
        if (!b) setError("Bookmark not found.");
        else setBookmark(b);
      })
      .catch(() => setError("Could not load bookmark."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fafafa" size="large" />
      </View>
    );
  }

  if (error || !bookmark) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Not found"}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const needsSelection = bookmark.metadata?.capture_status === "needs_selection";

  return (
    <>
      <Stack.Screen options={{ title: bookmark.title }} />
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        {bookmark.backdrop_url ? (
          <Image
            source={{ uri: bookmark.backdrop_url }}
            style={styles.backdrop}
            resizeMode="cover"
          />
        ) : bookmark.poster_url ? (
          <Image
            source={{ uri: bookmark.poster_url }}
            style={styles.backdrop}
            resizeMode="cover"
          />
        ) : null}

        <View style={styles.body}>
          <View style={styles.header}>
            {bookmark.poster_url ? (
              <Image source={{ uri: bookmark.poster_url }} style={styles.poster} />
            ) : (
              <View style={[styles.poster, styles.posterPlaceholder]}>
                <Text style={styles.posterPlaceholderText}>
                  {bookmark.title.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerMeta}>
              <Text style={styles.title}>{bookmark.title}</Text>
              <Text style={styles.meta}>
                {bookmark.type}
                {bookmark.release_year ? ` · ${bookmark.release_year}` : ""}
                {bookmark.runtime_minutes ? ` · ${bookmark.runtime_minutes}m` : ""}
              </Text>
              <Text style={styles.status}>
                {STATUS_LABELS[bookmark.status] ?? bookmark.status}
              </Text>
            </View>
          </View>

          {needsSelection ? (
            <TouchableOpacity
              style={styles.matchBanner}
              onPress={() =>
                router.push(`/capture/needs_selection?bookmarkId=${id}`)
              }
            >
              <Text style={styles.matchBannerText}>
                Tap to choose the right title match
              </Text>
            </TouchableOpacity>
          ) : null}

          {bookmark.notes ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.sectionText}>{bookmark.notes}</Text>
            </View>
          ) : null}

          {bookmark.tags?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tags</Text>
              <View style={styles.tags}>
                {bookmark.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {bookmark.source_url ? (
            <TouchableOpacity
              style={styles.sourceBtn}
              onPress={() => Linking.openURL(bookmark.source_url!)}
            >
              <Text style={styles.sourceBtnText}>Open source link</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090b" },
  content: { paddingBottom: 48 },
  center: {
    flex: 1,
    backgroundColor: "#09090b",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  errorText: { color: "#f87171", fontSize: 15, textAlign: "center" },
  backBtn: {
    backgroundColor: "#27272a",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: { color: "#fafafa", fontSize: 14 },
  backdrop: { width: "100%", height: 200, opacity: 0.5 },
  body: { padding: 16, gap: 20 },
  header: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  poster: { width: 72, height: 108, borderRadius: 10 },
  posterPlaceholder: {
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  posterPlaceholderText: { color: "#71717a", fontWeight: "700", fontSize: 18 },
  headerMeta: { flex: 1, gap: 6, paddingTop: 4 },
  title: { color: "#fafafa", fontSize: 18, fontWeight: "700", lineHeight: 24 },
  meta: { color: "#71717a", fontSize: 13 },
  status: {
    alignSelf: "flex-start",
    backgroundColor: "#27272a",
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  matchBanner: {
    backgroundColor: "#451a03",
    borderWidth: 1,
    borderColor: "#92400e",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  matchBannerText: { color: "#fbbf24", fontWeight: "600", fontSize: 14 },
  section: { gap: 6 },
  sectionLabel: { color: "#71717a", fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  sectionText: { color: "#d4d4d8", fontSize: 14, lineHeight: 21 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: "#27272a",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: { color: "#a1a1aa", fontSize: 12 },
  sourceBtn: {
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  sourceBtnText: { color: "#71717a", fontSize: 14 },
});
