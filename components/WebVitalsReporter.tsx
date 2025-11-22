'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitalsReporter() {
    useReportWebVitals((metric) => {
        // Log to console (can be sent to analytics service)
        console.log('[WEB_VITALS]', {
            name: metric.name,
            value: metric.value,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id,
        });

        // Send to analytics (example: Google Analytics)
        if (window.gtag) {
            window.gtag('event', metric.name, {
                value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
                event_label: metric.id,
                non_interaction: true,
            });
        }

        // Send to Sentry (if available)
        if (typeof window !== 'undefined' && (window as any).Sentry) {
            (window as any).Sentry.captureMessage(`Web Vital: ${metric.name}`, {
                level: metric.rating === 'good' ? 'info' : 'warning',
                extra: {
                    value: metric.value,
                    rating: metric.rating,
                    delta: metric.delta,
                },
            });
        }
    });

    return null; // This component doesn't render anything
}

// TypeScript declaration for gtag
declare global {
    interface Window {
        gtag?: (...args: any[]) => void;
    }
}
