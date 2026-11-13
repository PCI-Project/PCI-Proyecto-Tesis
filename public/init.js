// This script handles service worker registration and the PWA install prompt.

// 1. Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(err => {
        console.error('Service Worker registration failed:', err);
      });
  });
}

// 2. PWA Installation Prompt Handling
let deferredPrompt;
const installButtonContainer = document.getElementById('install-app-button-container');

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Update UI to notify the user they can install the PWA
  if (installButtonContainer) {
    installButtonContainer.style.display = 'block';
  }
});

if (installButtonContainer) {
  const installButton = installButtonContainer.querySelector('button');
  if (installButton) {
      installButton.addEventListener('click', async () => {
        if (deferredPrompt) {
          // Show the prompt
          deferredPrompt.prompt();
          // Wait for the user to respond to the prompt
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`User response to the install prompt: ${outcome}`);
          // We've used the prompt, and can't use it again, throw it away
          deferredPrompt = null;
          // Hide the install button
          installButtonContainer.style.display = 'none';
        }
      });
  }
}

// Listen for the appinstalled event
window.addEventListener('appinstalled', () => {
  console.log('AsphaltPCI Pro was installed.');
  // Hide the install button as it's no longer needed
  if (installButtonContainer) {
    installButtonContainer.style.display = 'none';
  }
  deferredPrompt = null;
});
