export function BrandLogo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#116466" />
      <path
        d="M24 9 L37 15 V25 C37 33 24 39 24 39 C24 39 11 33 11 25 V15 Z"
        stroke="#D1E8E2"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19 19 H29 M19 24 H29 M19 29 H25" stroke="#FFCB9A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="31.5" cy="28.5" r="4.5" fill="#D9B08C" />
      <path
        d="M30 28.5 L31.2 29.7 L33.2 27.2"
        stroke="#2C3531"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function HeroImage({ className = 'w-full max-w-lg' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Decorative ambient aura behind the transparent image */}
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-[#D1E8E2]/60 via-[#FFCB9A]/20 to-[#D9B08C]/30 blur-2xl -z-10" />
      <img
        src="/images/hero-regtech.png"
        alt="ClauseTrace RegTech AI Verification Workflow"
        className="w-full object-contain drop-shadow-md"
      />
    </div>
  )
}

export function RegTechBadge({ label, icon = 'shield' }: { label: string; icon?: 'shield' | 'check' | 'nodes' }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D1E8E2] bg-white/90 px-3 py-1 text-xs font-semibold text-[#116466] shadow-sm backdrop-blur-sm">
      {icon === 'shield' && (
        <svg className="h-3.5 w-3.5 text-[#D9B08C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )}
      {icon === 'check' && (
        <svg className="h-3.5 w-3.5 text-[#116466]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {icon === 'nodes' && (
        <svg className="h-3.5 w-3.5 text-[#FFCB9A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      )}
      <span>{label}</span>
    </div>
  )
}
