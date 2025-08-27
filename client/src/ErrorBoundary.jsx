import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(err, info) { console.error('App crash:', err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
          <h2>Something broke 😬</h2>
          <pre>{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
