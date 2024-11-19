// preload.js

window.addEventListener('DOMContentLoaded', () => {
    const changeFavicon = (link) => {
      let $favicon = document.querySelector('link[rel="shortcut icon"]');
      if ($favicon !== null) {
        $favicon.href = link;
      } else {
        $favicon = document.createElement('link');
        $favicon.rel = 'shortcut icon';
        $favicon.href = link;
        document.head.appendChild($favicon);
      }
    };
  
    // Replace with the path or URL to your favicon
    changeFavicon('https://yourdomain.com/path/to/favicon.ico');
  });
  