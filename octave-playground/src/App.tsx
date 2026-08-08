import { useState } from 'react'
import { units, scratchUnit, getUnit } from './units'
import { UnitIndex } from './components/UnitIndex'
import Playground from './Playground'

function unitIdFromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get('unit')
  return id && getUnit(id) ? id : null
}

function App() {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(unitIdFromUrl)

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

  if (unit) {
    // key={unit.id}: force a full remount (fresh kernel, fresh state) when
    // switching units rather than trying to reuse Playground's internal state
    // across an entirely different unit.
    return <Playground key={unit.id} unit={unit} onBackToUnits={backToUnits} />
  }

  return <UnitIndex units={units} scratchUnit={scratchUnit} onSelect={selectUnit} />
}

export default App
