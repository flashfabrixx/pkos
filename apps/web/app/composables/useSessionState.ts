import { onMounted, ref, watch } from 'vue'

export function useSessionState<T extends string>(key: string, defaultValue: T) {
  const state = ref<T>(defaultValue)

  onMounted(() => {
    const stored = window.sessionStorage.getItem(key)
    if (stored !== null) state.value = stored as T

    watch(state, (value) => {
      if (value === defaultValue) window.sessionStorage.removeItem(key)
      else window.sessionStorage.setItem(key, value as string)
    })
  })

  return state
}
