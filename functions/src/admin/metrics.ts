import { FieldValue, getFirestore } from "firebase-admin/firestore";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function incrementMetric(name: string, by = 1): Promise<void> {
  if (!name || by === 0) return;
  try {
    const ref = getFirestore().collection("analytics").doc(todayKey());
    await ref.set(
      {
        date: todayKey(),
        updated_at: new Date().toISOString(),
        [`counters.${name}`]: FieldValue.increment(by),
      },
      { merge: true },
    );
  } catch (err) {
    // analytics writes must never break the calling path
    console.warn("[metrics.increment] failed", name, err instanceof Error ? err.message : err);
  }
}

export interface DailyCounters {
  date: string;
  counters: Record<string, number>;
}

export async function readDaily(date: string): Promise<DailyCounters | null> {
  try {
    const snap = await getFirestore().collection("analytics").doc(date).get();
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    return { date, counters: (data.counters as Record<string, number>) ?? {} };
  } catch {
    return null;
  }
}

export async function readRange(days = 7): Promise<DailyCounters[]> {
  const out: DailyCounters[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const daily = await readDaily(date);
    out.push(daily ?? { date, counters: {} });
  }
  return out.reverse();
}
