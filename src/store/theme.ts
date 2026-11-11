import { create } from 'zustand'

type Theme = 'dark' | 'light'

type ThemeState = {
  theme: Theme
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  // 처음 열면 항상 다크(미드나잇)로 시작한다. OS 설정은 따르지 않는다
  theme: 'dark',
  toggle: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
}))
