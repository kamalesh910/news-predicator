'use client';

import { useState } from 'react';
import { useGeoStore } from '@/store/geoStore';
import AlertTag from '@/components/elements/AlertTag';

interface CityPin {
  id: string;
  label: string;
  cx: number;
  cy: number;
  risk: 'critical' | 'elevated' | 'stable';
}

const CITY_PINS: CityPin[] = [
  { id: 'new-delhi', label: 'NEW DELHI', cx: 145, cy: 95, risk: 'critical' },
  { id: 'mumbai', label: 'MUMBAI', cx: 100, cy: 175, risk: 'elevated' },
  { id: 'bengaluru', label: 'BENGALURU', cx: 140, cy: 230, risk: 'stable' },
];

const PIN_COLORS: Record<CityPin['risk'], string> = {
  critical: 'var(--color-alert)',
  elevated: '#FBBF24',
  stable: '#34D399',
};

const BASE_WIDTH = 300;
const BASE_HEIGHT = 340;
const MIN_WIDTH = 60;
const MIN_HEIGHT = 68;
const ZOOM_FACTOR = 0.2;

export default function IndiaMap() {
  const { setSelectedCityPin } = useGeoStore();
  const [vbWidth, setVbWidth] = useState(BASE_WIDTH);
  const [vbHeight, setVbHeight] = useState(BASE_HEIGHT);

  const viewBox = `0 0 ${vbWidth} ${vbHeight}`;

  function handleZoomIn() {
    setVbWidth((w) => Math.max(MIN_WIDTH, Math.round(w * (1 - ZOOM_FACTOR))));
    setVbHeight((h) => Math.max(MIN_HEIGHT, Math.round(h * (1 - ZOOM_FACTOR))));
  }

  function handleZoomOut() {
    setVbWidth((w) => Math.min(BASE_WIDTH, Math.round(w * (1 + ZOOM_FACTOR))));
    setVbHeight((h) => Math.min(BASE_HEIGHT, Math.round(h * (1 + ZOOM_FACTOR))));
  }

  return (
    <div className="relative flex flex-col items-center" aria-label="India map with city risk pins">
      {/* Zoom controls */}
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          className="w-8 h-8 rounded border text-sm font-bold"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text-primary)' }}
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          className="w-8 h-8 rounded border text-sm font-bold"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text-primary)' }}
        >
          −
        </button>
      </div>

      {/* SVG Map */}
      <svg
        viewBox={viewBox}
        width="100%"
        style={{ maxWidth: 400 }}
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Simplified India polygon */}
        <path
          d="M 150,10 L 200,20 L 240,50 L 260,80 L 270,110 L 265,140 L 250,160 L 240,185 L 220,210 L 200,240 L 175,270 L 155,300 L 145,320 L 135,300 L 115,270 L 95,240 L 75,210 L 60,185 L 50,160 L 40,140 L 35,110 L 45,80 L 65,50 L 100,25 Z"
          fill="var(--color-surface-2)"
          stroke="var(--color-border)"
          strokeWidth="2"
        />

        {/* City pins */}
        {CITY_PINS.map((pin) => (
          <g
            key={pin.id}
            onClick={() => setSelectedCityPin(pin.id)}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label={`${pin.label} — ${pin.risk} risk`}
          >
            <circle cx={pin.cx} cy={pin.cy} r={10} fill={PIN_COLORS[pin.risk]} opacity={0.2} />
            <circle cx={pin.cx} cy={pin.cy} r={6} fill={PIN_COLORS[pin.risk]} stroke="var(--color-bg-base)" strokeWidth={1.5} />
            <text x={pin.cx + 10} y={pin.cy + 4} fontSize="8" fill="var(--color-text-primary)" fontFamily="sans-serif" fontWeight="600">
              {pin.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {CITY_PINS.map((pin) => (
          <button
            key={pin.id}
            type="button"
            onClick={() => setSelectedCityPin(pin.id)}
            className="flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
            aria-label={`Select ${pin.label}`}
          >
            <span className="text-xs mr-1" style={{ color: 'var(--color-text-secondary)' }}>{pin.label}</span>
            <AlertTag label={pin.risk.toUpperCase()} variant={pin.risk} />
          </button>
        ))}
      </div>
    </div>
  );
}
