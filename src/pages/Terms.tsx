import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background text-foreground pt-[68px]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: April 3, 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Use of WatchMarks</h2>
          <p className="text-muted-foreground">
            WatchMarks helps you save links and organize what to watch. You agree not to use the
            service for unlawful activity, abuse, or attempts to disrupt service operations.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Your Content</h2>
          <p className="text-muted-foreground">
            You are responsible for links, notes, and files you upload. You confirm you have the
            rights to upload and share the content you provide.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Availability and Changes</h2>
          <p className="text-muted-foreground">
            Features may change over time. We may update, pause, or remove functionality to improve
            reliability, performance, or security.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            For legal or account concerns, contact support through the WatchMarks project channels.
          </p>
        </section>

        <div className="flex gap-3 pt-2">
          <Button asChild variant="outline">
            <Link to="/privacy">Privacy Policy</Link>
          </Button>
          <Button asChild>
            <Link to="/auth">Back to Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Terms;
