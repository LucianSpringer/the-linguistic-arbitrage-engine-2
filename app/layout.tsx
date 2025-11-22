import type { Metadata } from 'next';
import { ErrorBoundary } from '../components/ErrorBoundary';
import './globals.css';

export const metadata: Metadata = {
    title: 'Linguistic Arbitrage Engine',
    description: 'AI-Powered Negotiation Training Platform',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link
                    href="https://fonts.googleapis.com/icon?family=Material+Icons"
                    rel="stylesheet"
                />
            </head>
            <body>
                <ErrorBoundary>
                    {children}
                </ErrorBoundary>
            </body>
        </html>
    );
}
