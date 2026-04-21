interface SparkLogoProps {
  size?: number;
  className?: string;
}

export function SparkLogo({ size = 24, className = "" }: SparkLogoProps) {
  return (
    <svg
      viewBox="0 0 640 360"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size * (360 / 640)}
      className={className}
    >
      {/* Small top vertical line */}
      <line
        x1="320"
        y1="82"
        x2="320"
        y2="122"
        stroke="#f6d400"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <line
        x1="320"
        y1="82"
        x2="320"
        y2="122"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Main V logo */}
      <polygon
        points="225,80 320,180 415,80 320,315"
        fill="#f6d400"
        stroke="white"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
