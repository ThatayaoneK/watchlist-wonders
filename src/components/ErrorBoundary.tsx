import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { hardReloadApp, isChunkLoadError } from "@/lib/chunkLoadRecovery";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    if (isChunkLoadError(error?.message || "")) {
      void hardReloadApp(error.message);
    }
  }

  handleReload = () => {
    void hardReloadApp(this.state.error?.message || "Manual reload from error boundary");
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 shadow-lg text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle className="w-12 h-12 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              {isChunkLoadError(this.state.error?.message || "")
                ? "A stale app update was detected. We are refreshing your cache now."
                : import.meta.env.DEV && this.state.error
                  ? this.state.error.message
                  : "An unexpected error occurred. Try reloading the page."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={this.handleGoHome}>
                Go Home
              </Button>
              <Button onClick={this.handleReload}>Reload</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
