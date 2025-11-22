'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(_error: Error): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ERROR_BOUNDARY] Caught error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });

        // Log to external service if needed
        // logErrorToService(error, errorInfo);
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="w-screen h-screen bg-obsidian text-gray-200 flex items-center justify-center p-8">
                    <div className="max-w-2xl w-full bg-black border-2 border-alert-crimson p-8 rounded">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="material-icons text-alert-crimson text-5xl">error</span>
                            <div>
                                <h1 className="text-2xl font-bold text-alert-crimson font-mono">
                                    SYSTEM FAILURE DETECTED
                                </h1>
                                <p className="text-gray-400 text-sm mt-1">
                                    The application encountered an unexpected error
                                </p>
                            </div>
                        </div>

                        {this.state.error && (
                            <div className="bg-matrix-gray p-4 rounded mb-6 font-mono text-xs">
                                <div className="text-terminal-green mb-2">ERROR DETAILS:</div>
                                <div className="text-gray-300 mb-2">
                                    <strong>Message:</strong> {this.state.error.message}
                                </div>
                                {this.state.error.stack && (
                                    <details className="mt-2">
                                        <summary className="cursor-pointer text-gray-500 hover:text-gray-300">
                                            Stack Trace
                                        </summary>
                                        <pre className="mt-2 text-xs text-gray-500 overflow-x-auto">
                                            {this.state.error.stack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={this.handleReset}
                                className="px-6 py-3 bg-terminal-green text-black font-bold font-mono uppercase tracking-wider hover:bg-white transition-colors"
                            >
                                Attempt Recovery
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-transparent border border-gray-600 text-gray-300 font-bold font-mono uppercase tracking-wider hover:border-terminal-green hover:text-terminal-green transition-colors"
                            >
                                Full System Restart
                            </button>
                        </div>

                        <div className="mt-6 text-xs text-gray-500 font-mono">
                            <p>If this error persists, please check the browser console for additional details.</p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
