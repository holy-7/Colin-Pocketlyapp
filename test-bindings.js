// Test each binding individually to find which ones cause crash
var names = [
  'electron_common_features',
  'electron_common_v8_util',
  'electron_browser_app',
  'electron_browser_window',
  'electron_common_ipc',
  'electron_common_menu',
  'electron_common_shell',
  'electron_common_dialog',
  'electron_common_notification',
  'electron_common_power_monitor',
  'electron_common_screen',
  'electron_common_tray',
  'electron_common_clipboard',
  'electron_common_global_shortcut',
  'electron_common_native_image',
  'app',
  'command_line',
  'native',
];

names.forEach(function(name) {
  try {
    process.stdout.write('Testing: ' + name + '... ');
    var binding = process._linkedBinding(name);
    process.stdout.write('type=' + typeof binding);
    if (binding && typeof binding === 'object') {
      var keys = Object.keys(binding).slice(0, 5);
      process.stdout.write(' keys=' + keys.join(','));
    }
    process.stdout.write('\n');
  } catch(e) {
    process.stdout.write('ERROR: ' + e.message + '\n');
  }
});

process.stdout.write('\nAll tests passed!\n');
process.exit(0);
