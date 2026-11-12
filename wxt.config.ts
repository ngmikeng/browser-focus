import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  manifest: {
    name: 'Browser Focus',
    description:
      'Focus on one zone of any video (e.g. just the subtitles) in a small always-on-top window.',
    permissions: ['storage', 'scripting'],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'Browser Focus: pick a zone (Alt+Shift+F)' },
    commands: {
      'toggle-focus': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Open the focus-zone editor on this tab',
      },
    },
  },
});
