export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoIcon className="h-9 w-9" />
      {!compact && (
        <div className="leading-none">
          <div className="text-lg font-bold tracking-tight text-foreground">Emmalva</div>
          <div className="eyebrow mt-1">workforce</div>
        </div>
      )}
    </div>
  );
}

export function LogoIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <g>
        {/* Top bar */}
        <path d="M18 18 L102 18 L78 40 L18 40 Z" fill="#29ABE2" />
        {/* Top bar shadow wedge */}
        <path d="M18 40 L78 40 L60 52 L18 52 Z" fill="#2B8BB0" />
        {/* Middle bar */}
        <path d="M18 52 L102 52 L78 74 L18 74 Z" fill="#29ABE2" />
        {/* Middle bar shadow wedge */}
        <path d="M18 74 L78 74 L60 86 L18 86 Z" fill="#2B8BB0" />
        {/* Bottom bar */}
        <path d="M18 86 L102 86 L78 108 L18 108 Z" fill="#29ABE2" />
      </g>
    </svg>
  );
}
