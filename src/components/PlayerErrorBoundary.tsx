import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Play } from 'lucide-react';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

/**
 * Lightweight error boundary for the live stream player area.
 * Catches uncaught throws in LiveStreamPlayer and its children
 * (ReactPlayer, invite flows, PPV checkout) and shows a retry UI
 * instead of blanking the entire page via the global boundary.
 */
export class PlayerErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, message: error.message || 'Player error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PlayerErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-center px-6">
        <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
          <Play className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-sm text-white/80 font-medium mb-1">Something went wrong</p>
        <p className="text-xs text-white/40 mb-4 max-w-xs">{this.state.message}</p>
        <button
          onClick={() => this.setState({ hasError: false, message: '' })}
          className="px-4 py-2 text-xs font-display font-bold uppercase tracking-wider bg-amber-500 text-black rounded hover:bg-amber-400 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }
}
