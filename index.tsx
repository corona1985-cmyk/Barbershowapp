import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

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
            <h1 className="text-xl font-bold text-slate-800 mb-2">Algo salió mal</h1>
            <p className="text-slate-600 mb-6">La aplicación tuvo un error. Recarga la página para intentar de nuevo.</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23]"
            >
              Recargar página
            </button>
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
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);