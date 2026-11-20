export const TOUR_EVENT = 'clausetrace:open-tour'

export function openTour(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TOUR_EVENT))
  }
}
