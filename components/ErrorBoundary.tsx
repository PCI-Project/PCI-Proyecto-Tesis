import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-base text-text-base p-8">
          <div className="bg-bg-surface p-6 rounded-xl border border-danger shadow-xl max-w-2xl w-full">
            <h1 className="text-2xl font-bold text-danger mb-4">Algo salió mal</h1>
            <p className="text-text-muted mb-4">La aplicación encontró un error inesperado.</p>
            <pre className="bg-bg-base p-4 rounded-lg overflow-auto text-sm text-text-base border border-border-base">
                {this.state.error?.toString()}
            </pre>
            <button 
                className="mt-6 px-4 py-2 bg-primary text-white rounded font-bold"
                onClick={() => {
                    localStorage.removeItem('asphalt-pci-pro-projects'); // Optional: clear storage if it's corrupt data
                    window.location.reload();
                }}
            >
                Recargar y borrar datos locales (si persiste el error)
            </button>
            <button 
                className="mt-6 ml-4 px-4 py-2 border border-border-base text-text-base rounded font-bold"
                onClick={() => window.location.reload()}
            >
                Sólo Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
