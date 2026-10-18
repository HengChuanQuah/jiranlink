import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Where this guard sits, shown in the message so testers can report it. */
  area: string;
  onBack?: () => void;
  compact?: boolean;
}
interface State {
  error: Error | null;
}

/**
 * If anything inside crashes while drawing, show what happened and a way out,
 * instead of React wiping the whole page.
 */
export class CrashGuard extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[JiranLink] ${this.props.area} crashed:`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className={this.props.compact ? "crash crash-compact" : "crash"} role="alert">
        <AlertTriangle size={22} />
        <div className="stack-sm" style={{ gap: 6 }}>
          <b>Something went wrong {this.props.compact ? "here" : "on this screen"}.</b>
          <span className="small muted">Please screenshot this for the team: {this.props.area}: {error.message || String(error)}</span>
          <div className="btn-row">
            {this.props.onBack && (
              <button className="btn btn-outline btn-sm" onClick={() => { this.setState({ error: null }); this.props.onBack!(); }}>Go back</button>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    );
  }
}
