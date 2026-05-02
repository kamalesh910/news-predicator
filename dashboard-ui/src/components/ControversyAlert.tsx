'use client';

import { BurstEvent } from '@/types';

interface ControversyAlertProps {
  events: BurstEvent[];
}

/**
 * Renders a notification banner for each BurstEvent received.
 * Renders immediately when the `events` prop changes, satisfying the
 * "within 1 second of receipt" requirement (9.2).
 */
export default function ControversyAlert({ events }: ControversyAlertProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-2"
      role="region"
      aria-label="Controversy alerts"
    >
      {events.map((event) => (
        <div
          key={event.eventId}
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-sm"
        >
          {/* Alert icon */}
          <span
            className="mt-0.5 flex-shrink-0 text-red-500"
            aria-hidden="true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </span>

          {/* Alert content */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-800">
              Controversy Detected: {event.topicName}
            </p>
            <p className="mt-0.5 text-sm text-red-700">
              {event.articleCount} articles in burst window
            </p>
            <p className="mt-0.5 text-xs text-red-600">
              Detected at{' '}
              <time dateTime={event.detectionTimestamp}>
                {new Date(event.detectionTimestamp).toLocaleString()}
              </time>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
