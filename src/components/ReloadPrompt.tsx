import { useRegisterSW } from 'virtual:pwa-register/react'

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW registered:', r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-line-strong bg-surface p-4 shadow-lg">
      <p className="mb-2 text-sm text-ink">
        {offlineReady
          ? 'App ready to work offline'
          : 'New content available, click reload to update.'}
      </p>
      <div className="flex gap-2">
        {needRefresh && (
          <button
            onClick={() => updateServiceWorker(true)}
            className="rounded bg-accent px-3 py-1 text-sm text-on-accent hover:opacity-90"
          >
            Reload
          </button>
        )}
        <button
          onClick={close}
          className="rounded border border-line-strong px-3 py-1 text-sm text-muted hover:bg-surface-2"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default ReloadPrompt
