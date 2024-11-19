// renderer.js

document.getElementById('copyUrlBtn').addEventListener('click', () => {
    const webview = document.getElementById('webview');
    webview.executeJavaScript('window.location.href').then((url) => {
        navigator.clipboard.writeText(url);
    });
});

document.getElementById('addFavoriteBtn').addEventListener('click', () => {
    const webview = document.getElementById('webview');
    webview.executeJavaScript('window.location.href').then((url) => {
    window.favorites = window.favorites || [];
    window.favorites.push(url);
    // Optionally, store favorites persistently
    alert('Added to favorites!');
  });
});

document.getElementById('viewFavoritesBtn').addEventListener('click', () => {
    const favoriteList = window.favorites || [];
    alert('Favorites:\n' + favoriteList.join('\n'));
});

document.getElementById('goToChatBtn').addEventListener('click', () => {
    const webview = document.getElementById('webview');
    webview.loadURL('https://www.facebook.com/messages/t/');
});
