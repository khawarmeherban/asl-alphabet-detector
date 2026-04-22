import React from 'react';

class FeatureBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`Feature boundary failure: ${this.props.title || 'Unknown feature'}`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-3xl border border-red-500/40 bg-red-500/10 p-5 text-red-100">
          <h3 className="text-lg font-semibold">{this.props.title || 'Feature unavailable'}</h3>
          <p className="mt-2 text-sm text-red-200">
            {this.state.error?.message || 'This panel failed to render.'}
          </p>
        </section>
      );
    }

    return this.props.children;
  }
}

export default FeatureBoundary;
