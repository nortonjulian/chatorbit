import { ActionIcon, Tooltip } from '@mantine/core';
import { Sun, Moon } from 'lucide-react';
import { getTheme, setTheme, isDarkTheme } from '@/utils/themeManager';

export default function ThemeToggle({ onToggle }) {
  const theme = getTheme();
  const darkLike = isDarkTheme(theme);

  function handleToggle() {
    if (onToggle) return onToggle();
    // Flip Dawn <-> Midnight
    setTheme(darkLike ? 'dawn' : 'midnight');
  }

  return (
    <Tooltip label={`Switch to ${darkLike ? 'Dawn' : 'Midnight'} mode`}>
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
