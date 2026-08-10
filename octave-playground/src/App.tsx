import { useState } from 'react'
import { units, scratchUnit, getUnit } from './units'
import { UnitIndex } from './components/UnitIndex'
import { PersistenceWarning } from './components/PersistenceWarning'
import { ThemeProvider } from './theme'
import { ThemeToggle } from './components/ThemeToggle'
import Playground from './Playground'

function unitIdFromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get('unit')
  return id && getUnit(id) ? id : null
}

const PERSISTENCE_ACK_KEY = 'engr183-persistence-ack'

function App() {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(unitIdFromUrl)
  const [persistenceAcked, setPersistenceAcked] = useState(
    () => localStorage.getItem(PERSISTENCE_ACK_KEY) === '1',
  )

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
      <ThemeToggle />
      {unit ? (
        // key={unit.id}: force a full remount (fresh kernel, fresh state)
        // when switching units rather than trying to reuse Playground's
        // internal state across an entirely different unit.
        <Playground key={unit.id} unit={unit} onBackToUnits={backToUnits} />
      ) : (
        <UnitIndex units={units} scratchUnit={scratchUnit} onSelect={selectUnit} />
      )}
      {!persistenceAcked && (
        <PersistenceWarning
          onAcknowledge={() => {
            localStorage.setItem(PERSISTENCE_ACK_KEY, '1')
            setPersistenceAcked(true)
          }}
        />
      )}
    </ThemeProvider>
  )
}

export default App
