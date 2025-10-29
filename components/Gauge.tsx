
import React from 'react';

interface GaugeProps {
  score: number;
}

const Gauge: React.FC<GaugeProps> = ({ score }) => {
  const normalizedScore = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 40; // 2 * pi * radius
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  const getScoreColor = (value: number) => {
    if (value < 40) return '#ef4444'; // red-500
    if (value < 70) return '#f59e0b'; // amber-500
    return '#22c55e'; // green-500
  };

  const color = getScoreColor(normalizedScore);

  return (
    <div className="relative w-20 h-20" title={`Semantic Relevance Score: ${normalizedScore}%`}>
      <svg className="w-full h-full" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          className="text-gray-700"
          strokeWidth="10"
          stroke="currentColor"
          fill="transparent"
          r="40"
          cx="50"
          cy="50"
        />
        {/* Progress circle */}
        <circle
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke={color}
          fill="transparent"
          r="40"
          cx="50"
          cy="50"
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            transition: 'stroke-dashoffset 0.5s ease-in-out',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>
          {normalizedScore}
        </span>
        <span className="text-xs text-gray-400 -mt-1">%</span>
      </div>
    </div>
  );
};

export default Gauge;
