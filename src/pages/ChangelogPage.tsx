import FeltHero from '../components/FeltHero'
import { CHANGELOG } from '../changelog'

function formatDate(date: string): string {
  // Noon local time, so the day doesn't shift in any time zone.
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** What's new: every changelog entry, newest first. */
export default function ChangelogPage() {
  return (
    <>
      <FeltHero>
        <div className="pt-1 pb-5">
          <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">What's new</h1>
          <p className="mt-0.5 text-sm text-on-felt/85">Recent updates to Cardz</p>
        </div>
      </FeltHero>

      <div className="space-y-3">
        {CHANGELOG.map((entry) => (
          <article
            key={entry.id}
            data-testid="changelog-entry"
            className="rounded-2xl border border-line bg-surface p-4"
          >
            <p className="text-[13px] font-bold text-muted">
              <time dateTime={entry.date}>{formatDate(entry.date)}</time>
            </p>
            <h2 className="mt-0.5 text-[17px] font-bold text-ink">{entry.title}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink">
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </>
  )
}
