import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/errorReporting";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled error:", error, info.componentStack);
    reportError(error, { componentStack: info.componentStack });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center p-6">
          <div
            role="alert"
            className="glass flex w-full max-w-md flex-col items-center gap-4 rounded-2xl p-6 text-center"
          >
            <div className="space-y-2">
              <h1 className="text-base font-semibold text-foreground">
                Something went wrong
              </h1>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. Try reloading the page.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="glass" onClick={this.handleReset}>
                Try again
              </Button>
              <Button
                type="button"
                variant="glass"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
