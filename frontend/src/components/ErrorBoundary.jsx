// src/components/ErrorBoundary.jsx
// Class component — function components can't catch render errors.
// Lives at the root so any uncaught error shows a recoverable panel
// instead of a blank white page.
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[SmartBuy] Uncaught render error:', error, info);
    this.setState({ info });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, info: null });
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-red-200 rounded-lg p-6 shadow">
          <h2 className="text-lg font-bold text-red-700 mb-2">Something broke</h2>
          <p className="text-sm text-gray-700 mb-3">
            The app hit an unexpected error. You can try again or reload — your
            data is safe.
          </p>
          <pre className="text-xs bg-red-50 border border-red-100 p-3 rounded overflow-auto max-h-40 text-red-900">
            {String(this.state.error)}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded"
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
