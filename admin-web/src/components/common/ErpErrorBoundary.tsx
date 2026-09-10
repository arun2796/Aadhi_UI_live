import React from 'react';
import { AlertOctagon, RefreshCw, LayoutDashboard, ChevronDown } from 'lucide-react';

interface ErpErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * Changing this value clears a caught error — the shell passes the current pathname so
   * navigating to any other screen recovers automatically instead of staying stuck.
   */
  resetKey?: string;
  /** Sends the admin back to a known-good screen from inside the error panel. */
  onGoHome?: () => void;
}

interface ErpErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
  isDetailOpen: boolean;
}

/**
 * Contains a render/lifecycle throw from any routed module.
 *
 * Without this, one bad field read (e.g. `health.database.status` on a flat DTO) unmounts the
 * entire React tree and leaves a blank document with no sidebar and no way back. The boundary
 * keeps the ERP chrome mounted and renders a readable panel with retry + escape hatches.
 */
export class ErpErrorBoundary extends React.Component<ErpErrorBoundaryProps, ErpErrorBoundaryState> {
  state: ErpErrorBoundaryState = { error: null, componentStack: null, isDetailOpen: false };

  static getDerivedStateFromError(error: Error): Partial<ErpErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    // Keep the real stack in the console for support/correlation purposes.
    console.error('[ERP] Module render failed:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErpErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, componentStack: null, isDetailOpen: false });
    }
  }

  private handleRetry = () => {
    this.setState({ error: null, componentStack: null, isDetailOpen: false });
  };

  render() {
    const { error, componentStack, isDetailOpen } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="max-w-2xl mx-auto my-8 animate-fade-in">
        <div className="p-8 rounded-3xl bg-white border border-red-200/80 shadow-2xs space-y-5">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-inner">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <h3 className="text-base font-black text-navy">This screen could not be displayed</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                The module hit an unexpected error while rendering. Nothing was saved or changed —
                the rest of the console is still working, so you can retry or move to another screen.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
              Error
            </div>
            <div className="font-mono text-[11px] text-red-700 break-words">
              {error.name}: {error.message || 'Unknown error'}
            </div>
          </div>

          {componentStack && (
            <div>
              <button
                type="button"
                onClick={() => this.setState({ isDetailOpen: !isDetailOpen })}
                className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-500 hover:text-navy transition-colors"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${isDetailOpen ? 'rotate-180' : ''}`}
                />
                <span>{isDetailOpen ? 'Hide technical detail' : 'Show technical detail'}</span>
              </button>
              {isDetailOpen && (
                <pre className="mt-2 max-h-52 overflow-auto rounded-xl bg-slate-900 text-slate-200 p-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                  {componentStack.trim()}
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-5 py-2.5 rounded-xl bg-navy hover:bg-navy-dark text-white text-xs font-black inline-flex items-center space-x-2 shadow-md shadow-navy/20 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry this screen</span>
            </button>
            {this.props.onGoHome && (
              <button
                type="button"
                onClick={this.props.onGoHome}
                className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-navy text-xs font-black inline-flex items-center space-x-2 transition-all"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-purple" />
                <span>Back to Dashboard</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-navy text-xs font-bold transition-colors"
            >
              Reload the console
            </button>
          </div>
        </div>
      </div>
    );
  }
}
