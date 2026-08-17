document.addEventListener("DOMContentLoaded", () => {
  const webview = document.getElementById("fb-view");

  if (!webview) {
    console.error("Webview element not found");
    return;
  }

  const hiddenHeaderHeightRem = 1.8;
  const marketplaceSidebarOffsetRem = hiddenHeaderHeightRem + 1.2;

  const bannerRemovalScript = `
    (() => {
      const banner = document.querySelector('div[role="banner"]');
      if (banner) {
        banner.remove();
      }
      return Boolean(banner);
    })();
  `;

  const marketplaceLayoutCss = `
    html, body {
      margin-top: -${hiddenHeaderHeightRem}rem !important;
      height: calc(100% + ${hiddenHeaderHeightRem}rem) !important;
    }

    div[aria-label="Marketplace sidebar"] > div:first-of-type {
      margin-top: -${marketplaceSidebarOffsetRem}rem !important;
      height: calc(100% + ${marketplaceSidebarOffsetRem}rem) !important;
    }
  `;

  const safelyCustomize = (label, operation) => {
    try {
      return Promise.resolve(operation()).catch((error) => {
        console.warn(`[renderer] ${label} failed:`, error);
      });
    } catch (error) {
      console.warn(`[renderer] ${label} failed:`, error);
      return Promise.resolve();
    }
  };

  const customizeMarketplaceChrome = () => {
    void Promise.all([
      safelyCustomize("Facebook banner removal", () =>
        webview.executeJavaScript(bannerRemovalScript)
      ),
      safelyCustomize("Marketplace layout adjustment", () =>
        webview.insertCSS(marketplaceLayoutCss)
      ),
    ]);
  };

  webview.addEventListener("dom-ready", customizeMarketplaceChrome);
});
