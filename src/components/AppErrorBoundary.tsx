import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected application error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a console trail so production debugging is still possible.
    console.error('AppErrorBoundary', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container py-12 max-w-2xl">
          <div className="panel p-6 space-y-3">
            <h1 className="font-display text-3xl text-primary">SBBL HQ</h1>
            <p className="text-sm text-muted-foreground">We hit a runtime issue and recovered safely.</p>
            <p className="text-xs text-destructive break-words">{this.state.message}</p>
            <p className="text-xs text-muted-foreground">If login is unavailable, verify VITE_SUPABASE_URL and either VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY.</p>
          </div>
        </div>
      </div>
    );
  }
}
