import { useState } from 'react'

interface OnboardingOverlayProps {
  // remember=true persists the dismissal (localStorage, never shows again);
  // remember=false only hides it for this tab session -- it'll show again
  // on the next full page load, for a student who wants the checklist back
  // without digging through the browser's site-data settings to clear it.
  onDismiss: (remember: boolean) => void
}

const STEPS: { icon: string; title: string; body: string }[] = [
  {
    icon: '\u{1F4C1}',
    title: 'Your files are in the File Browser',
    body: 'Every file for this unit is listed on the left. Click one to open it in the editor.',
  },
  {
    icon: '\u{25B6}\u{FE0F}',
    title: 'Run Tests checks your work against the rubric',
    body:
      'Run Tests grades your code against every criterion for this unit -- run it as many times as you like, nothing is submitted. Run File just runs whichever file is open, the same as typing run at the Octave prompt.',
  },
  {
    icon: '\u{1F4CB}',
    title: 'Reading the rubric report',
    body:
      'Results print in the Command Window below: [ PASS ] or [ FAIL ] for each criterion, with a -> hint under anything that failed, and a score line at the bottom.',
  },
  {
    icon: '\u{2B07}\u{FE0F}',
    title: 'Download before you submit',
    body:
      'Download File or Download All (.zip) in the toolbar save your own copy -- the same files you upload to Canvas. Nothing here submits automatically.',
  },
]

// Shown once per browser (App.tsx tracks it in localStorage, separately
// from the persistence-ack flag -- that one has to reappear if storage was
// cleared, since it's warning about exactly that risk; this one doesn't,
// since a student who already knows the UI still knows it after a clear).
// Not dismissable via backdrop/Escape, matching PersistenceWarning -- one
// short read, one click through.
export function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
  const [remember, setRemember] = useState(true)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-app/85 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-line bg-surface p-6 shadow-2xl shadow-black/50">
        <div className="mb-4 text-sm font-semibold text-primary">Quick orientation</div>
        <ul className="mb-5 flex flex-col gap-3">
          {STEPS.map((step) => (
            <li key={step.title} className="flex gap-3">
              <span className="text-base" aria-hidden="true">
                {step.icon}
              </span>
              <div>
                <div className="text-xs font-semibold text-secondary">{step.title}</div>
                <p className="text-xs leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-accent"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Don't show this again
          </label>
          <button
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-on-accent hover:bg-accent-hover"
            onClick={() => onDismiss(remember)}
          >
            Let's go
          </button>
        </div>
      </div>
    </div>
  )
}
