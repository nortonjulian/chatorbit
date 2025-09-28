import { ActionIcon, Tooltip } from '@mantine/core';
import { Sun, Moon } from 'lucide-react';
import { getTheme, setTheme, isDarkTheme } from '@/utils/themeManager';

export default function ThemeToggle({ onToggle }) {
  const theme = getTheme();
  const darkLike = isDarkTheme(theme);

  function handleToggle() {
    if (onToggle) return onToggle();
    // Flip between Light and Dark (keeping premium separate)
    setTheme(darkLike ? 'light' : 'dark');
  }

  return (
    <Tooltip label={`Switch to ${darkLike ? 'light' : 'dark'} mode`}>
      <ActionIcon
        aria-label="Toggle theme"
        aria-pressed={darkLike}
        role="switch"
        onClick={handleToggle}
        variant="light"
        size="lg"
      >
        {darkLike ? <Sun /> : <Moon />}
      </ActionIcon>
    </Tooltip>
  );
}
