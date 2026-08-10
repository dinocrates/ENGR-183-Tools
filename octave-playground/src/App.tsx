import { useState } from 'react'
import { units, scratchUnit, getUnit } from './units'
import { UnitIndex } from './components/UnitIndex'
import { PersistenceWarning } from './components/PersistenceWarning'
import { OnboardingOverlay } from './components/OnboardingOverlay'
import { ThemeProvider } from './theme'
import { ThemeToggle } from './components/ThemeToggle'
import Playground from './Playground'

function unitIdFromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get('unit')
  return id && getUnit(id) ? id : null
}

const PERSISTENCE_ACK_KEY = 'engr183-persistence-ack'
const ONBOARDING_SEEN_KEY = 'engr183-onboarding-seen'

function App() {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(unitIdFromUrl)
  const [persistenceAcked, setPersistenceAcked] = useState(
    () => localStorage.getItem(PERSISTENCE_ACK_KEY) === '1',
  )
  const [onboardingSeen, setOnboardingSeen] = useState(
    () => localStorage.getItem(ONBOARDING_SEEN_KEY) === '1',
  )
  // Separate from onboardingSeen: unchecking "Don't show this again" hides
  // the overlay for the rest of this tab session without writing the
  // localStorage flag, so it comes back on the next full page load instead
  // of being suppressed forever.
  const [onboardingDismissedThisSession, setOnboardingDismissedThisSession] = useState(false)

  function selectUnit(unitId: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('unit', unitId)
    window.history.pushState({}, '', url)
    setSelectedUnitId(unitId)
  }

  function backToUnits() {
    const url = new URL(window.location.href)
    url.searchParams.delete('unit')
    window.history.pushState({}, '', url)
    setSelectedUnitId(null)
  }

  const unit = selectedUnitId ? getUnit(selectedUnitId) : undefined

  return (
    <ThemeProvider>
      {unit ? (
        // key={unit.id}: force a full remount (fresh kernel, fresh state)
        // when switching units rather than trying to reuse Playground's
        // internal state across an entirely different unit. Its own
        // Toolbar renders the theme toggle inline -- see ThemeToggle.tsx.
        <Playground key={unit.id} unit={unit} onBackToUnits={backToUnits} />
      ) : (
        <>
          {/* UnitIndex has no header of its own, so the toggle floats at
              the corner here instead of rendering inline like Toolbar's. */}
          <ThemeToggle />
          <UnitIndex units={units} scratchUnit={scratchUnit} onSelect={selectUnit} />
        </>
      )}
      {!persistenceAcked && (
        <PersistenceWarning
          onAcknowledge={() => {
            localStorage.setItem(PERSISTENCE_ACK_KEY, '1')
            setPersistenceAcked(true)
          }}
        />
      )}
      {persistenceAcked && !onboardingSeen && !onboardingDismissedThisSession && (
        <OnboardingOverlay
          onDismiss={(remember) => {
            if (remember) {
              localStorage.setItem(ONBOARDING_SEEN_KEY, '1')
              setOnboardingSeen(true)
            } else {
              setOnboardingDismissedThisSession(true)
            }
          }}
        />
      )}
    </ThemeProvider>
  )
}

export default App
