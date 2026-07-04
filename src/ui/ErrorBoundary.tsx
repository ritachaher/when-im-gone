import { Component, type ReactNode } from 'react';

/**
 * Top-level error boundary. Without it, any render error is a silent
 * white screen - unacceptable for a non-technical audience. We show a
 * calm message and a reload button. No error details are rendered or
 * logged beyond the error name: the tree can contain decrypted journal
 * content, and exception objects/component stacks must never leak it.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    // Log only the error class - never the message or stack - so nothing
    // sensitive can leak via DevTools or screen capture.
    const name =
      error && typeof error === 'object' && 'name' in error
        ? String((error as { name: unknown }).name)
        : 'Error';
    console.error('Render error:', name);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="centre">
          <div className="centre-card stack" style={{ textAlign: 'center' }}>
            <h2>Something went wrong</h2>
            <p className="muted">
              Your journal is safe - nothing has been lost. Please reload the
              page to continue.
            </p>
            <button className="btn" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
