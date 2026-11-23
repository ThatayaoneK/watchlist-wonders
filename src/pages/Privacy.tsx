import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground pt-[68px]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: April 3, 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Data We Store</h2>
          <p className="text-muted-foreground">
            We store account identifiers, watchlist entries, schedules, and optional profile details
            to provide WatchMarks features.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">How Data Is Used</h2>
          <p className="text-muted-foreground">
            Data is used to save your list, improve recommendation quality, and send reminders you
            explicitly enable.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Sharing and Visibility</h2>
          <p className="text-muted-foreground">
            Your bookmarks remain private unless you explicitly make them public with sharing
            controls. You can reverse that at any time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Data Export</h2>
          <p className="text-muted-foreground">
            You can export your watchlist as CSV from Settings for portability and backup.
          </p>
        </section>

        <div className="flex gap-3 pt-2">
          <Button asChild variant="outline">
            <Link to="/terms">Terms of Service</Link>
          </Button>
          <Button asChild>
            <Link to="/auth">Back to Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
