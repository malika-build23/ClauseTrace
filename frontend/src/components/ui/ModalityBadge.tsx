import { ShieldAlert, ShieldCheck, HelpCircle, AlertOctagon } from 'lucide-react'
import type { Modality } from '../../lib/api'

interface ModalityConfig {
  label: string
  icon: typeof ShieldCheck
  badgeClass: string
  patternDesc: string
}

const MODALITY_CONFIG: Record<Modality, ModalityConfig> = {
  must: {
    label: 'MUST',
    icon: ShieldCheck,
    badgeClass: 'modality-badge-must',
    patternDesc: 'Mandatory obligation (solid border)',
  },
  must_not: {
    label: 'MUST NOT',
    icon: AlertOctagon,
    badgeClass: 'modality-badge-must_not',
    patternDesc: 'Strict prohibition (dashed border)',
  },
  should: {
    label: 'SHOULD',
    icon: ShieldAlert,
    badgeClass: 'modality-badge-should',
    patternDesc: 'Advisory requirement (dashed border)',
  },
  may: {
    label: 'MAY',
    icon: HelpCircle,
    badgeClass: 'modality-badge-may',
    patternDesc: 'Permissive guidance (dotted border)',
  },
}

export function ModalityBadge({
  modality,
  className = '',
}: {
  modality: Modality
  className?: string
}) {
  const cfg = MODALITY_CONFIG[modality] ?? MODALITY_CONFIG.must
  const Icon = cfg.icon

  return (
    <span
      title={`${cfg.label} - ${cfg.patternDesc}`}
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold tracking-wide uppercase shadow-2xs ${cfg.badgeClass} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  )
}
