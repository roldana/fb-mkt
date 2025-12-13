document.addEventListener("DOMContentLoaded", () => {
  // Grab main elements
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("toggle-btn");
  const webview = document.getElementById("fb-view");

  const BASE_URL = "https://www.facebook.com";

  // Sidebar navigation: handle clicks on links in the sidebar.
  sidebar.addEventListener("click", (event) => {
    if (event.target.tagName.toLowerCase() === "a") {
      event.preventDefault();
      const clickHref = event.target.getAttribute("href");
      const targetHref =  BASE_URL + (clickHref.startsWith("/") ? clickHref : "/" + clickHref);
      console.log("Navigating to:", targetHref);
      // Instruct the webview to navigate.
      if (webview && typeof webview.loadURL === "function") {
        webview.loadURL(targetHref);
      } else {
        // As a fallback, update the `src` attribute.
        webview.src = targetHref;
      }
    }
  });

  // Toggle sidebar on button click.
  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    // Notify the main process.
    if (
      window.electronAPI &&
      typeof window.electronAPI.toggleSidebar === "function"
    ) {
      window.electronAPI.toggleSidebar(sidebar.classList.contains("collapsed"));
    }
  });

  // Current URL display: update the current URL when the webview navigates.
  const currentUrlElement = document.getElementById("current-url");
  const updateCurrentUrl = (event) => {
    if (currentUrlElement) {
      currentUrlElement.innerText = event.url || webview.getURL();
    }
  };
  // attach event listeners to the webview for navigation events, and update the current url display
  if (webview) {
    webview.addEventListener("did-navigate", updateCurrentUrl);
    webview.addEventListener("did-navigate-in-page", updateCurrentUrl);
    webview.addEventListener("did-finish-load", () => {
      // Update the current URL when the webview finishes loading, fallback
      if (currentUrlElement) {
        currentUrlElement.innerText = webview.getURL();
      }
    });
   } else {
      console.error("Webview element not found or does not support navigation events.");  
    }
  
  // Handle copy URL button click.
  const copyUrlBtn = document.getElementById("copyUrlBtn");
  if (copyUrlBtn) {
    copyUrlBtn.addEventListener("click", () => {
      const urlText = currentUrlElement ? currentUrlElement.innerText : "";
      if (
        window.electronAPI &&
        typeof window.electronAPI.copyText === "function"
      ) {
        window.electronAPI.copyText(urlText);
        alert("URL copied to clipboard!");
      } else if (navigator.clipboard) {
        navigator.clipboard
          .writeText(urlText)
          .then(() => alert("URL copied to clipboard!"))
          .catch((err) => console.error("Failed to copy URL:", err));
      } else {
        console.error("Clipboard API not available.");
      }
    });
  } else {
    console.error("Copy URL element not found.");
  };

  // Handle search input focus when the sidebar is collapsed.
  const searchInput = sidebar.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("focus", () => {
      if (sidebar.classList.contains("collapsed")) {
        sidebar.classList.remove("collapsed");
        // Notify the main process to update the sidebar state.
        if (
          window.electronAPI &&
          typeof window.electronAPI.toggleSidebar === "function"
        ) {
          window.electronAPI.toggleSidebar(false);
        }
      }
    });
  }

  // Handle search execution.
  document.getElementById("executeSearch").addEventListener("click", () => {
    const query = document.getElementById("searchInput").value;
    console.log("Search query:", query);
    if (query.trim() !== "" && window.electronAPI.navigate) {
      window.electronAPI.navigate(
        "/marketplace/search/?query=" + encodeURIComponent(query)
      );
    }
  });

  // Handle saving search actions.
  document.getElementById("saveSearch").addEventListener("click", () => {
    const query = document.getElementById("searchInput").value;
    if (query.trim() !== "" && window.electronAPI.saveSearch) {
      window.electronAPI.saveSearch(query);
    }
  });

  // IPC listeners for updating saved searches.
  window.electronAPI.onSearchSaved((data) => {
    updateSavedSearches(data);
  });
  window.electronAPI.onReceiveSavedSearches((data) => {
    updateSavedSearches(data);
  });
  window.electronAPI.requestSavedSearches();

  // Helper: update saved searches list
  function updateSavedSearches(searches) {
    const list = document.getElementById("savedSearchList");
    if (!list) return;
    list.innerHTML = "";
    searches.forEach((search) => {
      const li = document.createElement("li");
      li.innerText = search;
      li.addEventListener("click", () => {
        if (window.electronAPI.navigate) {
          window.electronAPI.navigate(
            "/marketplace/search/?query=" + encodeURIComponent(search)
          );
        }
      });
      list.appendChild(li);
    });
  }

  // Initial layout update.
  // updateLayout();
});