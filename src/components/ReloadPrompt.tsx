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
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-gray-300 bg-white p-4 shadow-lg dark:border-gray-600 dark:bg-gray-800">
      <p className="mb-2 text-sm text-gray-700 dark:text-gray-200">
        {offlineReady
          ? 'App ready to work offline'
          : 'New content available, click reload to update.'}
      </p>
      <div className="flex gap-2">
        {needRefresh && (
          <button
            onClick={() => updateServiceWorker(true)}
            className="rounded bg-[#863bff] px-3 py-1 text-sm text-white hover:bg-[#6f2ed6]"
          >
            Reload
          </button>
        )}
        <button
          onClick={close}
          className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default ReloadPrompt
