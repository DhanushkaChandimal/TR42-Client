import React from 'react';
import '../styles/loadingOverlay.css';

const LoadingOverlay = ({ show = false, text = 'Loading...' }) => {
  if (!show) return null;
  return (
    <div className="loading-overlay">
      <div className="loading-oiljack">
        {/* Animated SVG Oil Pump Jack */}
        <svg width="80" height="60" viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect y="50" width="80" height="10" fill="#bfa76a" />
          <rect x="35" y="40" width="10" height="10" fill="#888" />
          <rect x="39" y="20" width="2" height="20" fill="#555" />
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="-20 40 40; 20 40 40; -20 40 40"
              dur="1.5s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0; 0.5; 1"
              keySplines="0.42 0 0.58 1; 0.42 0 0.58 1"
            />
            <rect x="36" y="35" width="8" height="4" fill="#333" />
            <rect x="44" y="36" width="18" height="2" fill="#222" />
            <ellipse cx="62" cy="37" rx="3" ry="5" fill="#444" />
          </g>
          <ellipse cx="36" cy="37" rx="3" ry="2" fill="#222" />
        </svg>
      </div>
      <div className="loading-text">{text}</div>
      <div className="loading-spinner" />
    </div>
  );
};

export default LoadingOverlay;
