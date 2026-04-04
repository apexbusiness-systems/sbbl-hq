import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string; eventId: string | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '', eventId: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, message: error.message || 'Unexpected application error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AppErrorBoundary', error, info.componentStack);
    // Report to Sentry with full component stack for React 18
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
    this.setState({ eventId });
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
