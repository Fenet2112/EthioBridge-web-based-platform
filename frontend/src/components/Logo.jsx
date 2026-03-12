import React from 'react';

function Logo({ size = 40, color = "#667eea" }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 2px 6px rgba(102, 126, 234, 0.3))' }}
    >
      {/* Crane */}
      <g id="crane">
        {/* Crane base */}
        <rect x="10" y="70" width="8" height="25" fill={color} />
        
        {/* Crane tower */}
        <rect x="11" y="30" width="6" height="40" fill={color} />
        
        {/* Crane arm */}
        <rect x="17" y="28" width="35" height="4" fill={color} />
        
        {/* Crane hook line */}
        <line x1="45" y1="32" x2="45" y2="45" stroke={color} strokeWidth="2" />
        
        {/* Crane hook */}
        <circle cx="45" cy="47" r="2" fill={color} />
        
        {/* Crane counterweight */}
        <rect x="5" y="28" width="8" height="6" fill={color} />
      </g>

      {/* House */}
      <g id="house">
        {/* House base */}
        <rect x="50" y="55" width="35" height="30" fill={color} opacity="0.9" />
        
        {/* House roof */}
        <polygon points="48,55 67.5,35 87,55" fill={color} />
        
        {/* Roof details */}
        <line x1="52" y1="50" x2="60" y2="42" stroke="white" strokeWidth="1.5" opacity="0.6" />
        <line x1="60" y1="50" x2="68" y2="42" stroke="white" strokeWidth="1.5" opacity="0.6" />
        <line x1="68" y1="50" x2="76" y2="42" stroke="white" strokeWidth="1.5" opacity="0.6" />
        
        {/* Window */}
        <rect x="72" y="62" width="8" height="8" fill="white" opacity="0.8" />
        <line x1="76" y1="62" x2="76" y2="70" stroke={color} strokeWidth="1" />
        <line x1="72" y1="66" x2="80" y2="66" stroke={color} strokeWidth="1" />
        
        {/* Door */}
        <rect x="55" y="70" width="10" height="15" fill="white" opacity="0.8" />
        <circle cx="63" cy="77" r="1" fill={color} />
      </g>
      
      {/* Bridge/Connection element */}
      <g id="bridge">
        <path 
          d="M 20 85 Q 40 80, 60 85" 
          stroke={color} 
          strokeWidth="2" 
          fill="none" 
          opacity="0.7"
        />
        <circle cx="20" cy="85" r="2" fill={color} />
        <circle cx="40" cy="80" r="2" fill={color} />
        <circle cx="60" cy="85" r="2" fill={color} />
      </g>
    </svg>
  );
}

export default Logo;
