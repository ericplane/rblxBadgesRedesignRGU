document.addEventListener('DOMContentLoaded', () => {
  const scrollInput = document.getElementById('scrollAmountStep');
  const saveButton = document.getElementById('saveSettings');
  const clearButton = document.getElementById('clearLocalStorage');
  const status = document.getElementById('status');

  // Restore settings when the options page is loaded
  chrome.storage.local.get(['scrollAmountStep'], (result) => {
    scrollInput.value = result.scrollAmountStep || 100; // Default to 50 if not set
  });

  // Save settings when the "Save Settings" button is clicked
  saveButton.addEventListener('click', () => {
    const scrollAmountStep = parseInt(scrollInput.value, 10);
    chrome.storage.local.set({ scrollAmountStep }, () => {
      status.textContent = 'Settings saved successfully!';
      setTimeout(() => (status.textContent = ''), 2000);
    });
  });

  // Clear local storage when the "Clear Local Storage" button is clicked
  clearButton.addEventListener('click', () => {
    chrome.storage.local.clear(() => {
      status.textContent = 'Local storage cleared successfully!';
      setTimeout(() => (status.textContent = ''), 2000);
    });
  });
});
