import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public state: ErrorBoundaryState = {
        hasError: false,
    };

    public static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, info: ErrorInfo): void {
        if (import.meta.env.DEV) {
            console.error('React ErrorBoundary caught an error:', error, info);
        }
    }

    private handleReload = (): void => {
        window.location.reload();
    };

    public render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12 text-ink">
                    <div className="w-full max-w-md rounded-2xl border border-divider bg-surface p-8 text-center shadow-sm">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
                            <span className="text-xl font-bold" aria-hidden="true">!</span>
                        </div>
                        <h1 className="text-xl font-semibold text-ink">Terjadi kendala tampilan</h1>
                        <p className="mt-2 text-sm leading-relaxed text-mute">
                            Maaf, halaman mengalami gangguan sementara. Silakan muat ulang halaman atau kembali ke beranda.
                        </p>
                        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                            <button
                                type="button"
                                onClick={this.handleReload}
                                className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-canvas transition hover:opacity-90"
                            >
                                Muat Ulang Halaman
                            </button>
                            <a
                                href="/"
                                className="inline-flex items-center justify-center rounded-lg border border-divider px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-canvas"
                            >
                                Kembali ke Beranda
                            </a>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
