import React from 'react';

interface DriverPingLoaderProps {
  height?: string;
  className?: string;
}

export function DriverPingLoader({ height, className = '' }: DriverPingLoaderProps) {
  return (
    <div
      className={`loader ${className}`}
      role="img"
      aria-label="Driver Ping loading"
      style={height ? ({ '--h': height } as React.CSSProperties) : undefined}
    >
      {/* D */}
      <svg className="letter" viewBox="10 0 60 100" fill="none">
        <path
          className="dash"
          style={{ '--i': 0 } as React.CSSProperties}
          pathLength={360}
          d="M 20,25 L 38,25 C 53,25 60,36 60,50 C 60,64 53,75 38,75 L 20,75 Z"
        />
      </svg>

      {/* R */}
      <svg className="letter" viewBox="10 0 60 100" fill="none">
        <path
          className="dash"
          style={{ '--i': 1 } as React.CSSProperties}
          pathLength={360}
          d="M 20,80 L 20,25 L 40,25 C 53,25 58,32 58,40 C 58,48 53,55 40,55 L 20,55 M 40,55 L 57,77"
        />
      </svg>

      {/* I */}
      <svg className="letter" viewBox="30 0 20 100" fill="none">
        <path
          className="dash"
          style={{ '--i': 2 } as React.CSSProperties}
          pathLength={360}
          d="M 40,20 L 40,80"
        />
      </svg>

      {/* V */}
      <svg className="letter" viewBox="10 0 60 100" fill="none">
        <path
          className="dash join-bevel"
          style={{ '--i': 3 } as React.CSSProperties}
          pathLength={360}
          d="M 18,20 L 40,80 L 62,20"
        />
      </svg>

      {/* E */}
      <svg className="letter" viewBox="10 0 60 100" fill="none">
        <path
          className="dash"
          style={{ '--i': 4 } as React.CSSProperties}
          pathLength={360}
          d="M 60,25 L 20,25 L 20,75 L 60,75 M 20,50 L 55,50"
        />
      </svg>

      {/* R */}
      <svg className="letter" viewBox="10 0 60 100" fill="none">
        <path
          className="dash"
          style={{ '--i': 5 } as React.CSSProperties}
          pathLength={360}
          d="M 20,80 L 20,25 L 40,25 C 53,25 58,32 58,40 C 58,48 53,55 40,55 L 20,55 M 40,55 L 57,77"
        />
      </svg>

      <span className="space"></span>

      {/* P */}
      <svg className="letter" viewBox="10 0 60 100" fill="none">
        <path
          className="dash"
          style={{ '--i': 7 } as React.CSSProperties}
          pathLength={360}
          d="M 20,80 L 20,25 L 40,25 C 53,25 58,32 58,41 C 58,50 53,57 40,57 L 20,57"
        />
      </svg>

      {/* I */}
      <svg className="letter" viewBox="30 0 20 100" fill="none">
        <path
          className="dash"
          style={{ '--i': 8 } as React.CSSProperties}
          pathLength={360}
          d="M 40,20 L 40,80"
        />
      </svg>

      {/* N */}
      <svg className="letter" viewBox="10 0 60 100" fill="none">
        <path
          className="dash"
          style={{ '--i': 9 } as React.CSSProperties}
          pathLength={360}
          d="M 20,20 L 20,80 M 20,24 L 60,76 M 60,20 L 60,80"
        />
      </svg>

      {/* G */}
      <svg className="letter" viewBox="10 0 60 100" fill="none">
        <path
          className="dash"
          style={{ '--i': 10 } as React.CSSProperties}
          pathLength={360}
          d="M 57,33 C 52,27 46,25 40,25 C 27,25 20,36 20,50 C 20,64 27,75 40,75 C 54,75 60,66 60,50 L 44,50"
        />
      </svg>
    </div>
  );
}
