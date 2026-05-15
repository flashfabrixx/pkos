import { onBeforeUnmount, onMounted, ref, watch, type Ref, type WatchSource } from 'vue'

export interface InfiniteFetchResult<T> {
  items: T[]
  hasMore: boolean
}

export interface InfiniteListOptions<T> {
  /**
   * Function that returns one page. Called with the current offset and the
   * configured page size; must resolve to { items, hasMore }.
   */
  fetcher: (params: { offset: number, limit: number }) => Promise<InfiniteFetchResult<T>>
  /** Items per page. Default 50. */
  pageSize?: number
  /** Reactive sources that should cause a full reset (e.g. filter state). */
  watch?: WatchSource[]
}

export interface InfiniteListBinding<T> {
  items: Ref<T[]>
  loading: Ref<boolean>
  loadingMore: Ref<boolean>
  hasMore: Ref<boolean>
  loadMore: () => Promise<void>
  reset: () => Promise<void>
  sentinelRef: Ref<HTMLElement | null>
}

export function useInfiniteList<T>(options: InfiniteListOptions<T>): InfiniteListBinding<T> {
  const pageSize = options.pageSize ?? 50
  const items = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasMore = ref(true)
  const sentinelRef = ref<HTMLElement | null>(null)
  let observer: IntersectionObserver | null = null

  async function fetchPage(offset: number) {
    return options.fetcher({ offset, limit: pageSize })
  }

  async function loadMore() {
    if (loading.value || loadingMore.value || !hasMore.value) return
    const isFirstPage = items.value.length === 0
    if (isFirstPage) loading.value = true
    else loadingMore.value = true
    try {
      const page = await fetchPage(items.value.length)
      items.value = items.value.concat(page.items)
      hasMore.value = page.hasMore && page.items.length === pageSize
    } finally {
      loading.value = false
      loadingMore.value = false
    }
  }

  async function reset() {
    items.value = []
    hasMore.value = true
    await loadMore()
  }

  function attachObserver() {
    if (!import.meta.client) return
    if (observer) observer.disconnect()
    if (!sentinelRef.value) return
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          void loadMore()
        }
      }
    }, { rootMargin: '320px 0px' })
    observer.observe(sentinelRef.value)
  }

  onMounted(() => {
    void loadMore().then(() => attachObserver())
  })

  watch(sentinelRef, () => attachObserver())

  if (options.watch?.length) {
    watch(options.watch as WatchSource[], () => {
      void reset().then(() => attachObserver())
    })
  }

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return { items, loading, loadingMore, hasMore, loadMore, reset, sentinelRef }
}
