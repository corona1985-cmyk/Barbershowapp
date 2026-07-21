import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider, translate } from './i18n';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error('Error en la aplicación:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
            <h1 className="text-xl font-bold text-slate-800 mb-2">{translate('errors.appCrashTitle')}</h1>
            <p className="text-slate-600 mb-6">{translate('errors.appCrashMessage')}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { this.setState({ hasError: false }); window.location.href = window.location.pathname; }}
                className="w-full py-3 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23]"
              >
                {translate('common.goHome')}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-slate-200 text-slate-800 font-medium rounded-lg hover:bg-slate-300"
              >
                {translate('common.reloadPage')}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (this as React.Component<{ children: React.ReactNode }, { hasError: boolean }>).props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <I18nProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </I18nProvider>
  </React.StrictMode>
);
