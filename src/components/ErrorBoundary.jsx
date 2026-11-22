import { Component } from 'react'

function sanitizeErrorMessage(err) {
  const raw = String(err?.message || err || 'Bilinmeyen hata')
  return raw
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[token]')
    .replace(/sb_publishable_[a-zA-Z0-9_]+/gi, '[key]')
    .replace(/sb_secret_[a-zA-Z0-9_]+/gi, '[key]')
    .replace(/apikey[=:]\s*[^\s&]+/gi, 'apikey=[redacted]')
    .replace(/password[=:]\s*[^\s&]+/gi, 'password=[redacted]')
    .slice(0, 280)
}

export function BootErrorScreen({ message, onRetry }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#f9fafb',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 4,
          padding: 20,
        }}
      >
        <h1 style={{ fontSize: 16, margin: '0 0 8px', color: '#111827' }}>
          Uygulama başlatılamadı
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
          Beklenmeyen bir hata oluştu. Aşağıdaki kısa bilgi destek için kullanılabilir.
        </p>
        <pre
          style={{
            fontSize: 11,
            color: '#991b1b',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 4,
            padding: 10,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: '0 0 16px',
          }}
        >
          {sanitizeErrorMessage(message)}
        </pre>
        <button
          type="button"
          onClick={onRetry}
          style={{
            width: '100%',
            minHeight: 44,
            background: '#580F1C',
            color: '#fff',
            border: 0,
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Yeniden dene
        </button>
      </div>
    </div>
  )
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    try {
      window.__APP_LAST_ERROR__ = sanitizeErrorMessage(error)
    } catch {
      /* ignore */
    }
  }

  render() {
    if (this.state.error) {
      return (
        <BootErrorScreen
          message={this.state.error}
          onRetry={() => {
            this.setState({ error: null })
            window.location.reload()
          }}
        />
      )
    }
    return this.props.children
  }
}

export { sanitizeErrorMessage }
