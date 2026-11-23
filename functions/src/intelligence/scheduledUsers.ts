import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Each job keeps its own cursor so accounts beyond the first page are visited.
export async function scheduledUsers(job: string, count: number) {
  const ref = getFirestore().doc(`jobCursors/${job}`);
  const saved = await ref.get();
  const token = saved.get("pageToken");
  const page = await getAuth().listUsers(Math.max(1, Math.min(1000, count)), typeof token === "string" ? token : undefined);
  return {
    docs: page.users.filter(user => !user.disabled).map(user => ({ id: user.uid })),
    complete: () => ref.set({ pageToken: page.pageToken ?? null }),
  };
}
