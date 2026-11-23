import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { getBookmark, selectCandidate, skipSelection } from "../../lib/bookmarks";

interface Candidate {
  tmdbId: number;
  title: string;
  mediaType: "movie" | "tv";
  releaseYear?: number;
  posterUrl?: string;
  overview?: string;
}

function parseCandidates(raw: unknown): Candidate[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is Candidate =>
      c !== null &&
      typeof c === "object" &&
      typeof (c as Candidate).tmdbId === "number" &&
      typeof (c as Candidate).title === "string",
  );
}

export default function CaptureResolutionScreen() {
  const { status } = useLocalSearchParams<{ status: string }>();
  const bookmarkId = useLocalSearchParams<{ bookmarkId: string }>().bookmarkId ?? "";
  const router = useRouter();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [extractedTitle, setExtractedTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookmarkHref = bookmarkId ? (`/bookmark/${bookmarkId}` as const) : ("/" as const);

  useEffect(() => {
    if (!bookmarkId) {
      setLoading(false);
      return;
    }
    void getBookmark(bookmarkId)
      .then((b) => {
        if (!b) { setError("Capture not found."); return; }
        setCandidates(parseCandidates(b.metadata?.match_candidates));
        setExtractedTitle(
          (b.metadata?.raw_title as string | undefined) ?? b.title ?? "",
        );
      })
      .catch(() => setError("Could not load candidates."))
      .finally(() => setLoading(false));
  }, [bookmarkId]);

  const handleSelect = async (candidate: Candidate) => {
    if (!bookmarkId) return;
    setSaving(true);
    try {
      await selectCandidate(bookmarkId, candidate);
      router.replace(bookmarkHref);
    } catch {
      setError("Could not apply match. Tap a title to retry.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (bookmarkId) {
      try { await skipSelection(bookmarkId); } catch { /* non-fatal */ }
    }
    router.replace(bookmarkHref);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fafafa" size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Choose title" }} />
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Matches for "{extractedTitle || "your capture"}"
          </Text>
          <Text style={styles.subtitle}>
            Tap the correct title to finish saving.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {saving ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fafafa" />
            <Text style={styles.savingText}>Saving…</Text>
          </View>
        ) : candidates.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No candidates found.</Text>
          </View>
        ) : (
          <FlatList
            data={candidates}
            keyExtractor={(c) => `${c.tmdbId}-${c.mediaType}`}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.candidate}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                {item.posterUrl ? (
                  <Image source={{ uri: item.posterUrl }} style={styles.poster} />
                ) : (
                  <View style={[styles.poster, styles.posterPlaceholder]}>
                    <Text style={styles.posterPlaceholderText}>
                      {item.title.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.meta}>
                  <Text style={styles.candidateTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.candidateSub}>
                    {item.mediaType === "tv" ? "Series" : "Movie"}
                    {item.releaseYear ? ` · ${item.releaseYear}` : ""}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip — match later</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090b" },
  center: {
    flex: 1,
    backgroundColor: "#09090b",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  header: { padding: 20, gap: 4 },
  title: { color: "#fafafa", fontSize: 17, fontWeight: "700" },
  subtitle: { color: "#71717a", fontSize: 13 },
  error: { color: "#f87171", fontSize: 13, paddingHorizontal: 20 },
  savingText: { color: "#71717a", fontSize: 14 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#71717a", fontSize: 14 },
  list: { paddingHorizontal: 16, gap: 2 },
  candidate: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#18181b",
    marginBottom: 8,
    alignItems: "center",
  },
  poster: { width: 48, height: 72, borderRadius: 6 },
  posterPlaceholder: {
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  posterPlaceholderText: { color: "#71717a", fontWeight: "700", fontSize: 13 },
  meta: { flex: 1, gap: 4 },
  candidateTitle: { color: "#fafafa", fontSize: 15, fontWeight: "600" },
  candidateSub: { color: "#71717a", fontSize: 12 },
  skipBtn: {
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    alignItems: "center",
  },
  skipText: { color: "#71717a", fontSize: 14 },
});
