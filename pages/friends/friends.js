console.log('Friend requests page script loaded');

window.addEventListener('load', function () {
  const currentUrl = window.location.href;

  // Check if on the friend requests page
  if (currentUrl === 'https://www.roblox.com/users/friends#!/friend-requests') {
    moveFooterToBottom();
  }
});

// Function to move the footer to the bottom of the screen
function moveFooterToBottom() {
  const footer = document.querySelector('.container-footer');
  if (footer) {
    footer.setAttribute(
      'style',
      'position: fixed !important; bottom: 0 !important; left: 0;'
    );
  } else {
    console.log('Footer not found');
  }
}
