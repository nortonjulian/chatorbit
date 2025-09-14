import { ActionIcon, Tooltip } from '@mantine/core'
import { useMantineColorScheme } from '@mantine/core'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ onToggle }) {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  function handleToggle() {
    if (onToggle) return onToggle()
    setColorScheme(isDark ? 'light' : 'dark')
    try {
      localStorage.setItem('co-theme', isDark ? 'light' : 'dark')
      document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark')
    } catch {}
  }

  return (
    <Tooltip label={`Switch to ${isDark ? 'light' : 'dark'} mode`}>
      <ActionIcon
        aria-label="Toggle theme"
        aria-pressed={isDark}
        role="switch"
        onClick={handleToggle}
        variant="light"
        size="lg"
      >
        {isDark ? <Sun /> : <Moon />}
      </ActionIcon>
    </Tooltip>
  )
}
