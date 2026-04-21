export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary via-primary to-accent shadow-glow">
        <div className="absolute inset-[3px] rounded-[9px] border border-white/20 bg-background/60 grid place-items-center">
          <span className="mono text-[10px] font-semibold tracking-[0.2em] text-primary">CS</span>
        </div>
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight">Checkin System</div>
        <div className="eyebrow">workforce ops</div>
      </div>
    </div>
  );
}
