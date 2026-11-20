export function BrandLogo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="brandLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6281DC" />
          <stop offset="100%" stopColor="#1B2D52" />
        </linearGradient>
        <linearGradient id="brandAccentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0BACF" />
          <stop offset="100%" stopColor="#9FB0E8" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#brandLogoGrad)" />
      <path
        d="M24 8 L37 14 V24 C37 32 24 39 24 39 C24 39 11 32 11 24 V14 Z"
        stroke="#9FB0E8"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19 18 H29 M19 23 H29 M19 28 H25" stroke="#E0BACF" strokeWidth="2" strokeLinecap="round" />
      <circle cx="31" cy="28" r="4.5" fill="url(#brandAccentGrad)" />
      <path
        d="M29.5 28 L30.8 29.3 L32.8 26.8"
        stroke="#1B2D52"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Transparent 4-point geometric sparkle icon for subtle floating accents
 */
export function FloatingSparkle({ className = 'h-4 w-4', color = '#9FB0E8' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" />
    </svg>
  )
}

/**
 * Transparent floating compliance shield with glowing halo (no solid background)
 */
export function FloatingShieldElement({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="shieldGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6281DC" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6281DC" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shieldStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9FB0E8" />
          <stop offset="100%" stopColor="#6281DC" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill="url(#shieldGlow)" />
      <path
        d="M40 16 L60 25 V42 C60 55 40 65 40 65 C40 65 20 55 20 42 V25 Z"
        stroke="url(#shieldStroke)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-sm"
      />
      <path
        d="M32 40 L37.5 45.5 L48.5 34.5"
        stroke="#E0BACF"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Transparent floating audit chain constellation (no solid background)
 */
export function FloatingTraceGraph({ className = 'w-24 h-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 70" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 45 C45 15, 75 60, 100 25"
        stroke="#9FB0E8"
        strokeWidth="2.5"
        strokeDasharray="4 3"
        opacity="0.8"
      />
      <circle cx="20" cy="45" r="7" fill="#6281DC" />
      <circle cx="20" cy="45" r="3" fill="#ffffff" />
      <circle cx="62" cy="36" r="6" fill="#E0BACF" />
      <circle cx="62" cy="36" r="2.5" fill="#1B2D52" />
      <circle cx="100" cy="25" r="8" fill="#1B2D52" stroke="#6281DC" strokeWidth="2.5" />
      <path d="M96 25 L99 28 L104 22" stroke="#9FB0E8" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Transparent circular Guilloche RegTech Security Seal
 */
export function FloatingSecuritySealElement({ className = 'h-24 w-24' }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 140" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sealRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6281DC" />
          <stop offset="50%" stopColor="#9FB0E8" />
          <stop offset="100%" stopColor="#E0BACF" />
        </linearGradient>
      </defs>
      {/* Outer concentric dashed regulatory rings */}
      <circle cx="70" cy="70" r="64" stroke="url(#sealRingGrad)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
      <circle cx="70" cy="70" r="58" stroke="#6281DC" strokeWidth="2" opacity="0.8" />
      <circle cx="70" cy="70" r="52" stroke="#9FB0E8" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />

      {/* Decorative Star Points */}
      <polygon
        points="70,22 73,32 83,32 75,38 78,48 70,42 62,48 65,38 57,32 67,32"
        fill="#E0BACF"
      />
      <polygon
        points="70,118 73,108 83,108 75,102 78,92 70,98 62,92 65,102 57,108 67,108"
        fill="#E0BACF"
      />
      <polygon
        points="22,70 32,73 32,83 38,75 48,78 42,70 48,62 38,65 32,57 32,67"
        fill="#9FB0E8"
      />
      <polygon
        points="118,70 108,73 108,83 102,75 92,78 98,70 92,62 102,65 108,57 108,67"
        fill="#9FB0E8"
      />

      {/* Inner Central Shield */}
      <path
        d="M70 46 L86 54 V70 C86 82 70 90 70 90 C70 90 54 82 54 70 V54 Z"
        fill="#1B2D52"
        stroke="#6281DC"
        strokeWidth="2"
      />
      {/* Verified checkmark */}
      <path
        d="M63 68 L68 73 L77 63"
        stroke="#E0BACF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Transparent Floating Clause Snippet Card (Glassmorphic mini-element)
 */
export function FloatingClauseCardElement({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-2xl border border-mist/40 bg-panel/75 px-3.5 py-2 text-xs shadow-lg shadow-brand/10 backdrop-blur-md transition-transform hover:scale-105 select-none ${className}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-ink">Clause 4(1)</span>
          <span className="rounded-full bg-rose/20 px-1.5 py-0.2 text-[9px] font-bold text-[#6B3254] dark:text-rose">
            IFSCA
          </span>
        </div>
        <p className="text-[10px] text-muted">Maintenance of Net Worth</p>
      </div>
      <div className="h-2 w-2 rounded-full bg-pass animate-ping" />
    </div>
  )
}

/**
 * Transparent Floating Live Rule Evaluation Card (Glassmorphic metric pill)
 */
export function FloatingRuleMetricElement({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-2xl border border-brand/30 bg-panel/80 px-4 py-2.5 text-xs shadow-xl shadow-brand/10 backdrop-blur-md transition-transform hover:scale-105 select-none ${className}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand to-mist text-white">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-ink">Net Worth ≥ ₹50,000,000</span>
          <span className="rounded-md bg-pass-bg px-1.5 py-0.5 text-[9px] font-extrabold text-pass border border-pass-border">
            PASS ✓
          </span>
        </div>
        <p className="text-[10px] text-muted">Deterministic Rule Engine v2.0</p>
      </div>
    </div>
  )
}

/**
 * Transparent AI-to-Deterministic Pipeline Diagram (Visual micro-element)
 */
export function FloatingAIPipelineElement({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-2xl border border-line bg-panel/85 px-4 py-2 text-xs shadow-md backdrop-blur-md ${className}`}
    >
      <div className="flex items-center gap-1 font-semibold text-ink">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-mist/20 text-brand text-[10px]">
          📄
        </span>
        <span className="text-[11px]">PDF Clause</span>
      </div>
      <svg className="h-3 w-4 text-mist" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
      <div className="flex items-center gap-1 font-semibold text-ink">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose/25 text-[#6B3254] dark:text-rose text-[10px]">
          ✦
        </span>
        <span className="text-[11px]">AI Extraction</span>
      </div>
      <svg className="h-3 w-4 text-mist" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
      <div className="flex items-center gap-1 font-bold text-pass">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-pass-bg text-pass text-[10px] border border-pass-border">
          ✓
        </span>
        <span className="text-[11px]">Human Verified</span>
      </div>
    </div>
  )
}

/**
 * Floating Angled Regulatory Clearance Stamp
 */
export function FloatingRegulatoryStamp({ className = 'h-16 w-36' }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 70" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(-6 80 35)">
        <rect
          x="4"
          y="4"
          width="152"
          height="62"
          rx="12"
          stroke="#6281DC"
          strokeWidth="2"
          strokeDasharray="6 3"
          fill="none"
          opacity="0.85"
        />
        <rect
          x="9"
          y="9"
          width="142"
          height="52"
          rx="8"
          stroke="#E0BACF"
          strokeWidth="1.2"
          fill="none"
          opacity="0.7"
        />
        <text
          x="80"
          y="28"
          fill="#6281DC"
          fontSize="9.5"
          fontWeight="900"
          letterSpacing="1.2"
          textAnchor="middle"
          fontFamily="sans-serif"
        >
          IFSC GIFT CITY
        </text>
        <text
          x="80"
          y="44"
          fill="#1B2D52"
          fontSize="11"
          fontWeight="800"
          letterSpacing="0.8"
          textAnchor="middle"
          fontFamily="sans-serif"
          className="dark:fill-white"
        >
          RULE COMPLIANT
        </text>
        <text
          x="80"
          y="54"
          fill="#9FB0E8"
          fontSize="7"
          fontWeight="600"
          letterSpacing="0.5"
          textAnchor="middle"
          fontFamily="sans-serif"
        >
          DETERMINISTIC EVALUATION
        </text>
      </g>
    </svg>
  )
}

/**
 * Full Transparent Hero Illustration representing Clause-to-Rule verification
 * Zero solid container background, purely transparent vectors with soft glow!
 */
export function HeroImage({ className = 'w-full max-w-lg' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Soft ambient light aura (pure radial blur) */}
      <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-[#6281DC]/25 via-[#E0BACF]/15 to-[#9FB0E8]/20 blur-3xl -z-10 pointer-events-none" />

      <svg
        viewBox="0 0 540 390"
        className="w-full h-auto drop-shadow-xl select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="docGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#EEF3FD" stopOpacity="0.88" />
          </linearGradient>
          <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6281DC" />
            <stop offset="50%" stopColor="#9FB0E8" />
            <stop offset="100%" stopColor="#E0BACF" />
          </linearGradient>
          <linearGradient id="shieldFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6281DC" />
            <stop offset="100%" stopColor="#1B2D52" />
          </linearGradient>
          <filter id="shadowFilter" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#1B2D52" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Floating Connecting Waves (Audit Trail Flow) */}
        <path
          d="M175 190 C 235 190, 245 140, 315 140"
          stroke="url(#flowGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="6 4"
        />
        <path
          d="M175 230 C 255 230, 265 260, 325 260"
          stroke="#9FB0E8"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* ── Document Card (Regulatory Source) ── */}
        <g filter="url(#shadowFilter)">
          <rect
            x="35"
            y="65"
            width="175"
            height="240"
            rx="18"
            fill="url(#docGrad)"
            stroke="#9FB0E8"
            strokeWidth="1.6"
          />
          {/* Document Header */}
          <rect x="55" y="90" width="50" height="8" rx="4" fill="#6281DC" />
          <circle cx="185" cy="94" r="5" fill="#E0BACF" />

          {/* Regular text lines */}
          <rect x="55" y="112" width="135" height="4.5" rx="2.25" fill="#4D608E" opacity="0.3" />
          <rect x="55" y="125" width="120" height="4.5" rx="2.25" fill="#4D608E" opacity="0.3" />
          <rect x="55" y="138" width="130" height="4.5" rx="2.25" fill="#4D608E" opacity="0.3" />

          {/* Highlighted Clause (Live Source Quote) */}
          <rect x="50" y="154" width="145" height="36" rx="8" fill="#6281DC" fillOpacity="0.12" stroke="#6281DC" strokeWidth="1.2" />
          <rect x="58" y="163" width="130" height="5.5" rx="2.75" fill="#6281DC" />
          <rect x="58" y="175" width="100" height="5.5" rx="2.75" fill="#6281DC" />

          {/* More text lines */}
          <rect x="55" y="204" width="135" height="4.5" rx="2.25" fill="#4D608E" opacity="0.3" />
          <rect x="55" y="217" width="105" height="4.5" rx="2.25" fill="#4D608E" opacity="0.3" />
          <rect x="55" y="230" width="125" height="4.5" rx="2.25" fill="#4D608E" opacity="0.3" />

          {/* Quote Badge Tag */}
          <rect x="55" y="254" width="82" height="20" rx="10" fill="#E0BACF" />
          <text x="66" y="268" fill="#1B2D52" fontSize="9.5" fontWeight="bold" fontFamily="sans-serif">
            Clause 3(1)
          </text>
        </g>

        {/* ── Center Pulse Ring & Node ── */}
        <circle cx="245" cy="165" r="20" fill="#6281DC" fillOpacity="0.12" />
        <circle cx="245" cy="165" r="9" fill="#6281DC" />
        <circle cx="245" cy="165" r="4" fill="#FFFFFF" />

        {/* ── Rule Engine Node (Middle Upper) ── */}
        <g filter="url(#shadowFilter)">
          <rect
            x="295"
            y="90"
            width="190"
            height="90"
            rx="18"
            fill="#FFFFFF"
            stroke="#6281DC"
            strokeWidth="1.8"
          />
          {/* Header pill */}
          <rect x="312" y="108" width="156" height="20" rx="10" fill="#EEF3FD" />
          <circle cx="323" cy="118" r="4" fill="#6281DC" />
          <text x="333" y="121" fill="#1B2D52" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
            Deterministic Rule v1.2
          </text>

          {/* Rule expression */}
          <text x="312" y="146" fill="#4D608E" fontSize="9.5" fontFamily="monospace">
            fme.net_worth &gt;= 50000000
          </text>
          <text x="312" y="163" fill="#6281DC" fontSize="9" fontWeight="600" fontFamily="sans-serif">
            Condition verified (IFSCA Reg)
          </text>
        </g>

        {/* ── Result Compliance Shield Card (Right Bottom) ── */}
        <g filter="url(#shadowFilter)">
          <rect
            x="305"
            y="215"
            width="185"
            height="100"
            rx="18"
            fill="url(#shieldFill)"
            stroke="#9FB0E8"
            strokeWidth="1.6"
          />
          {/* Big Shield Badge */}
          <circle cx="342" cy="265" r="24" fill="#FFFFFF" fillOpacity="0.14" />
          <path
            d="M342 248 L356 255 V268 C356 279 342 287 342 287 C342 287 328 279 328 268 V255 Z"
            fill="url(#flowGrad)"
          />
          <path
            d="M338 265 L341 268 L347 262"
            stroke="#1B2D52"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Status Text */}
          <text x="376" y="254" fill="#E0BACF" fontSize="11" fontWeight="800" fontFamily="sans-serif" letterSpacing="0.5">
            DETERMINISTIC
          </text>
          <text x="376" y="274" fill="#FFFFFF" fontSize="16" fontWeight="900" fontFamily="sans-serif">
            PASS ✓
          </text>
          <text x="376" y="293" fill="#9FB0E8" fontSize="9" fontWeight="500" fontFamily="sans-serif">
            100% Traceable to Page 1
          </text>
        </g>

        {/* ── Small Floating Decorative Sparkles & Nodes ── */}
        <path d="M505 190 C505 193 502 195 499 195 C502 195 505 197 505 200 C505 197 508 195 511 195 C508 195 505 193 505 190 Z" fill="#E0BACF" />
        <path d="M22 150 C22 154 18 157 14 157 C18 157 22 160 22 164 C22 160 26 157 30 157 C26 157 22 154 22 150 Z" fill="#9FB0E8" />
        <path d="M270 45 C270 48 267 50 264 50 C267 50 270 52 270 55 C270 52 273 50 276 50 C273 50 270 48 270 45 Z" fill="#6281DC" />
        <circle cx="220" cy="285" r="4.5" fill="#E0BACF" opacity="0.8" />
        <circle cx="495" cy="80" r="5.5" fill="#9FB0E8" opacity="0.6" />
      </svg>
    </div>
  )
}

/**
 * RegTech Badge with dual-coding (icon + text) and new color palette tokens
 */
export function RegTechBadge({ label, icon = 'shield' }: { label: string; icon?: 'shield' | 'check' | 'nodes' }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel/80 px-3 py-1 text-xs font-semibold text-ink shadow-2xs backdrop-blur-md">
      {icon === 'shield' && (
        <svg className="h-3.5 w-3.5 text-periwinkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )}
      {icon === 'check' && (
        <svg className="h-3.5 w-3.5 text-mist" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {icon === 'nodes' && (
        <svg className="h-3.5 w-3.5 text-rose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
