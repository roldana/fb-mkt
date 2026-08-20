document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const FACEBOOK_ORIGIN = "https://www.facebook.com";
  const MAX_SEARCH_LENGTH = 200;
  const MAX_COPY_URL_LENGTH = 4096;
  const LIMITS = { searches: 20, listings: 30, recentListings: 15 };
  const STORAGE_KEYS = {
    searches: "marketplacePro.savedSearches.v1",
    listings: "marketplacePro.savedListings.v1",
    recentListings: "marketplacePro.recentListings.v1",
    collapsed: "marketplacePro.sidebarCollapsed.v1",
    theme: "marketplacePro.theme.v1",
  };
  const byId = (id) => document.getElementById(id);
  const listen = (element, eventName, handler) => {
    if (element) {
      element.addEventListener(eventName, handler);
    }
  };

  const ui = {
    sidebar: byId("sidebar"),
    toggle: byId("toggle-btn"),
    searchForm: byId("searchForm"),
    searchInput: byId("searchInput"),
    saveSearch: byId("saveSearch"),
    savedSearches: byId("savedSearchList"),
    searchesEmpty: byId("savedSearchesEmpty"),
    searchesCount: byId("savedSearchesCount"),
    searchesSummary: byId("saved-searches-title"),
    savedListings: byId("savedListingsList"),
    listingsEmpty: byId("savedListingsEmpty"),
    listingsCount: byId("savedListingsCount"),
    listingsSummary: byId("saved-listings-title"),
    recentListings: byId("recentListingsList"),
    recentListingsEmpty: byId("recentListingsEmpty"),
    recentListingsCount: byId("recentListingsCount"),
    recentListingsSummary: byId("recent-listings-title"),
    clearRecentListings: byId("clearRecentListings"),
    back: byId("back-btn"),
    forward: byId("forward-btn"),
    reload: byId("reload-btn"),
    loading: byId("loading-indicator"),
    pageTitle: byId("page-title"),
    currentUrl: byId("current-url"),
    theme: byId("theme-btn"),
    copyUrl: byId("copyUrlBtn"),
    saveListing: byId("saveListingBtn"),
    errorBanner: byId("error-banner"),
    errorMessage: byId("error-message"),
    retry: byId("retry-btn"),
    status: byId("status-message"),
    webview: byId("fb-view"),
  };

  const state = {
    searches: [],
    listings: [],
    recentListings: [],
    title: "Marketplace",
    titleUrl: "",
    recentTitle: "",
    recentTitleUrl: "",
    successfullyLoadedUrl: "",
    successfulVisitAt: "",
    loading: Boolean(ui.webview),
    loadFailed: false,
    failedUrl: "",
    statusTimer: null,
  };
  const systemDarkTheme =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  function parseUrl(value, base) {
    try {
      return new URL(value, base);
    } catch {
      return null;
    }
  }

  function isFacebookHttpsUrl(value) {
    if (
      typeof value !== "string" ||
      !value ||
      value.length > MAX_COPY_URL_LENGTH
    ) {
      return false;
    }

    const url = parseUrl(value);
    if (!url) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (hostname === "facebook.com" || hostname.endsWith(".facebook.com"))
    );
  }

  function marketplaceUrl(value) {
    const url = parseUrl(value, FACEBOOK_ORIGIN);
    if (!url) {
      return null;
    }

    const isMarketplacePath =
      url.pathname === "/marketplace" ||
      url.pathname.startsWith("/marketplace/");
    return url.origin === FACEBOOK_ORIGIN &&
      !url.username &&
      !url.password &&
      isMarketplacePath
      ? url
      : null;
  }

  function listingUrl(value) {
    const url = marketplaceUrl(value);
    if (!url || !/^\/marketplace\/item\/\d+\/?$/.test(url.pathname)) {
      return null;
    }

    return new URL(url.pathname.replace(/\/$/, ""), FACEBOOK_ORIGIN).toString();
  }

  function copyTargetUrl(value) {
    return listingUrl(value) || (isFacebookHttpsUrl(value) ? value : "");
  }

  function currentUrl() {
    if (!ui.webview) {
      return "";
    }

    try {
      const url = ui.webview.getURL();
      if (url) {
        return url;
      }
    } catch {
      // The guest may not be attached yet.
    }

    return (
      (ui.currentUrl && ui.currentUrl.value) ||
      ui.webview.getAttribute("src") ||
      ""
    );
  }

  function currentTitle() {
    if (!ui.webview) {
      return "";
    }

    try {
      return ui.webview.getTitle().trim();
    } catch {
      return "";
    }
  }

  function announce(message) {
    if (!ui.status) {
      console.info(message);
      return;
    }

    window.clearTimeout(state.statusTimer);
    ui.status.textContent = message;
    ui.status.classList.remove("is-hidden");
    state.statusTimer = window.setTimeout(() => {
      ui.status.classList.add("is-hidden");
    }, 2600);
  }

  function readList(key) {
    try {
      const value = localStorage.getItem(key);
      if (!value) {
        return [];
      }
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Ignoring invalid saved Marketplace data:", error);
      return [];
    }
  }

  function writeList(key, value, quiet = false) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Could not save Marketplace data:", error);
      if (!quiet) {
        announce("This change could not be saved.");
      }
      return false;
    }
  }

  function activeTheme() {
    const preference = document.documentElement.dataset.theme;
    if (preference === "light" || preference === "dark") {
      return preference;
    }
    return systemDarkTheme && systemDarkTheme.matches ? "dark" : "light";
  }

  function updateThemeButton() {
    if (!ui.theme) {
      return;
    }

    const dark = activeTheme() === "dark";
    const label = dark ? "Switch to light theme" : "Switch to dark theme";
    const icon = ui.theme.querySelector(".theme-icon");
    ui.theme.setAttribute("aria-label", label);
    ui.theme.setAttribute("aria-pressed", String(dark));
    ui.theme.title = label;
    if (icon) {
      icon.textContent = dark ? "☀" : "☾";
    }
  }

  function initializeTheme() {
    let preference = "";
    try {
      preference = localStorage.getItem(STORAGE_KEYS.theme) || "";
    } catch {
      // Use the operating-system preference when storage is unavailable.
    }

    if (preference === "light" || preference === "dark") {
      document.documentElement.dataset.theme = preference;
    } else {
      delete document.documentElement.dataset.theme;
    }
    updateThemeButton();
  }

  function toggleTheme() {
    const theme = activeTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;

    let persisted = true;
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch (error) {
      persisted = false;
      console.warn("Could not save theme preference:", error);
    }

    updateThemeButton();
    const name = theme === "dark" ? "Dark" : "Light";
    announce(
      persisted
        ? name + " theme enabled."
        : name + " theme enabled for this session."
    );
  }

  function loadSearches() {
    const searches = [];
    const seen = new Set();

    for (const value of readList(STORAGE_KEYS.searches)) {
      if (typeof value !== "string") {
        continue;
      }
      const search = value.trim().slice(0, MAX_SEARCH_LENGTH);
      const key = search.toLowerCase();
      if (search && !seen.has(key)) {
        searches.push(search);
        seen.add(key);
      }
      if (searches.length === LIMITS.searches) {
        break;
      }
    }

    writeList(STORAGE_KEYS.searches, searches, true);
    return searches;
  }

  function loadListings() {
    const listings = [];
    const seen = new Set();

    for (const value of readList(STORAGE_KEYS.listings)) {
      if (!value || typeof value !== "object") {
        continue;
      }

      const url = listingUrl(value.url);
      const date = new Date(value.savedAt);
      if (!url || seen.has(url) || Number.isNaN(date.getTime())) {
        continue;
      }

      const title =
        typeof value.title === "string" && value.title.trim()
          ? value.title.trim().slice(0, 180)
          : "Marketplace listing";
      listings.push({ url, title, savedAt: date.toISOString() });
      seen.add(url);

      if (listings.length === LIMITS.listings) {
        break;
      }
    }

    writeList(STORAGE_KEYS.listings, listings, true);
    return listings;
  }

  function loadRecentListings() {
    const byUrl = new Map();

    for (const value of readList(STORAGE_KEYS.recentListings)) {
      if (!value || typeof value !== "object") {
        continue;
      }

      const url = listingUrl(value.url);
      const date = new Date(value.visitedAt);
      const title =
        typeof value.title === "string"
          ? value.title.trim().slice(0, 180)
          : "";
      if (!url || !title || Number.isNaN(date.getTime())) {
        continue;
      }

      const item = { url, title, visitedAt: date.toISOString() };
      const existing = byUrl.get(url);
      if (!existing || item.visitedAt > existing.visitedAt) {
        byUrl.set(url, item);
      }
    }

    const listings = Array.from(byUrl.values())
      .sort((left, right) => right.visitedAt.localeCompare(left.visitedAt))
      .slice(0, LIMITS.recentListings);
    writeList(STORAGE_KEYS.recentListings, listings, true);
    return listings;
  }

  function commitList(name, nextValue, quiet = false) {
    if (!writeList(STORAGE_KEYS[name], nextValue, quiet)) {
      return false;
    }
    state[name] = nextValue;
    renderSavedLists();
    return true;
  }

  function setSidebarCollapsed(collapsed, persist = true) {
    if (!ui.sidebar) {
      return;
    }

    ui.sidebar.classList.toggle("collapsed", collapsed);
    ui.sidebar.inert = collapsed;
    if (collapsed) {
      ui.sidebar.setAttribute("aria-hidden", "true");
    } else {
      ui.sidebar.removeAttribute("aria-hidden");
    }

    if (ui.toggle) {
      const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
      ui.toggle.setAttribute("aria-expanded", String(!collapsed));
      ui.toggle.setAttribute("aria-label", label);
      ui.toggle.title = label;
    }

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEYS.collapsed, String(collapsed));
      } catch (error) {
        console.warn("Could not save sidebar state:", error);
      }
    }
  }

  function restoreFocus(list, removedIndex) {
    const buttons = list
      ? list.querySelectorAll(".saved-item-main")
      : [];
    const next = buttons[Math.min(removedIndex, buttons.length - 1)];
    if (next) {
      next.focus();
    } else if (ui.toggle) {
      ui.toggle.focus();
    }
  }

  function createSavedRow({ title, meta, open, remove, removeLabel }) {
    const item = document.createElement("li");
    item.className = "saved-item";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "saved-item-main";
    openButton.title = title;

    const titleElement = document.createElement("span");
    titleElement.className = "saved-item-title";
    titleElement.textContent = title;
    const metaElement = document.createElement("span");
    metaElement.className = "saved-item-meta";
    metaElement.textContent = meta;
    openButton.append(titleElement, metaElement);
    openButton.addEventListener("click", open);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "saved-item-remove";
    removeButton.textContent = "×";
    removeButton.title = removeLabel;
    removeButton.setAttribute("aria-label", removeLabel);
    removeButton.addEventListener("click", remove);

    item.append(openButton, removeButton);
    return item;
  }

  function updateSectionCount(badge, summary, count, label) {
    if (badge) {
      badge.textContent = String(count);
    }
    if (summary) {
      summary.setAttribute(
        "aria-label",
        label + ", " + count + (count === 1 ? " item" : " items")
      );
    }
  }

  function renderSavedLists() {
    if (ui.savedSearches) {
      const fragment = document.createDocumentFragment();
      state.searches.forEach((search) => {
        fragment.append(
          createSavedRow({
            title: search,
            meta: "Saved search",
            open: () => runSearch(search),
            remove: () => removeSearch(search),
            removeLabel: "Remove saved search: " + search,
          })
        );
      });
      ui.savedSearches.replaceChildren(fragment);
    }
    if (ui.searchesEmpty) {
      ui.searchesEmpty.classList.toggle("is-hidden", state.searches.length > 0);
    }
    updateSectionCount(
      ui.searchesCount,
      ui.searchesSummary,
      state.searches.length,
      "Saved searches"
    );

    if (ui.savedListings) {
      const fragment = document.createDocumentFragment();
      state.listings.forEach((listing) => {
        fragment.append(
          createSavedRow({
            title: listing.title,
            meta: "Saved " + new Date(listing.savedAt).toLocaleDateString(),
            open: () => navigateMarketplace(listing.url),
            remove: () => removeListing(listing.url),
            removeLabel: "Remove saved listing: " + listing.title,
          })
        );
      });
      ui.savedListings.replaceChildren(fragment);
    }
    if (ui.listingsEmpty) {
      ui.listingsEmpty.classList.toggle("is-hidden", state.listings.length > 0);
    }
    updateSectionCount(
      ui.listingsCount,
      ui.listingsSummary,
      state.listings.length,
      "Saved listings"
    );

    if (ui.recentListings) {
      const fragment = document.createDocumentFragment();
      state.recentListings.forEach((listing) => {
        fragment.append(
          createSavedRow({
            title: listing.title,
            meta:
              "Viewed " + new Date(listing.visitedAt).toLocaleDateString(),
            open: () => navigateMarketplace(listing.url),
            remove: () => removeRecentListing(listing.url),
            removeLabel: "Remove recent listing: " + listing.title,
          })
        );
      });
      ui.recentListings.replaceChildren(fragment);
    }
    if (ui.recentListingsEmpty) {
      ui.recentListingsEmpty.classList.toggle(
        "is-hidden",
        state.recentListings.length > 0
      );
    }
    if (ui.clearRecentListings) {
      ui.clearRecentListings.disabled = state.recentListings.length === 0;
    }
    updateSectionCount(
      ui.recentListingsCount,
      ui.recentListingsSummary,
      state.recentListings.length,
      "Recent listings"
    );
  }

  function runSearch(value) {
    const query =
      typeof value === "string"
        ? value.trim().slice(0, MAX_SEARCH_LENGTH)
        : "";
    if (!query) {
      announce("Enter something to search for.");
      if (ui.searchInput) {
        ui.searchInput.focus();
      }
      return;
    }

    if (ui.searchInput) {
      ui.searchInput.value = query;
      updateSearchButton();
    }
    const url = new URL("/marketplace/search/", FACEBOOK_ORIGIN);
    url.searchParams.set("query", query);
    navigateMarketplace(url.toString());
  }

  function saveSearch() {
    const search = ui.searchInput
      ? ui.searchInput.value.trim().slice(0, MAX_SEARCH_LENGTH)
      : "";
    if (!search) {
      announce("Enter a search before saving it.");
      return;
    }

    const key = search.toLowerCase();
    const next = [
      search,
      ...state.searches.filter((item) => item.toLowerCase() !== key),
    ].slice(0, LIMITS.searches);
    if (commitList("searches", next)) {
      announce("Search saved.");
    }
  }

  function removeSearch(search) {
    const index = state.searches.indexOf(search);
    const next = state.searches.filter((item) => item !== search);
    if (commitList("searches", next)) {
      restoreFocus(ui.savedSearches, index);
      announce("Saved search removed.");
    }
  }

  function saveListing() {
    const pageUrl = currentUrl();
    const url = listingUrl(pageUrl);
    if (!url) {
      announce("Open a Marketplace listing before saving it.");
      return;
    }
    if (state.titleUrl !== pageUrl || !state.title) {
      announce("Wait for the listing to finish loading before saving it.");
      return;
    }

    const next = [
      {
        url,
        title: state.title.slice(0, 180),
        savedAt: new Date().toISOString(),
      },
      ...state.listings.filter((item) => item.url !== url),
    ].slice(0, LIMITS.listings);
    if (commitList("listings", next)) {
      updateSaveListingButton(pageUrl);
      announce("Listing saved.");
    }
  }

  function removeListing(url) {
    const index = state.listings.findIndex((item) => item.url === url);
    const next = state.listings.filter((item) => item.url !== url);
    if (commitList("listings", next)) {
      restoreFocus(ui.savedListings, index);
      updateSaveListingButton(currentUrl());
      announce("Saved listing removed.");
    }
  }

  function recordRecentListing(pageUrl, visitedAt) {
    const url = listingUrl(pageUrl);
    const title = state.recentTitle.trim().slice(0, 180);
    const visitDate = new Date(visitedAt);
    if (
      !url ||
      !title ||
      state.loadFailed ||
      state.successfullyLoadedUrl !== pageUrl ||
      state.successfulVisitAt !== visitedAt ||
      state.recentTitleUrl !== pageUrl ||
      Number.isNaN(visitDate.getTime())
    ) {
      return;
    }

    const item = {
      url,
      title,
      visitedAt: visitDate.toISOString(),
    };
    const next = [
      item,
      ...state.recentListings.filter((listing) => listing.url !== url),
    ].slice(0, LIMITS.recentListings);
    const current = state.recentListings[0];
    if (
      current &&
      current.url === item.url &&
      current.title === item.title &&
      current.visitedAt === item.visitedAt
    ) {
      return;
    }
    commitList("recentListings", next, true);
  }

  function removeRecentListing(url) {
    const index = state.recentListings.findIndex((item) => item.url === url);
    const next = state.recentListings.filter((item) => item.url !== url);
    if (commitList("recentListings", next)) {
      restoreFocus(ui.recentListings, index);
      announce("Recent listing removed.");
    }
  }

  function clearRecentListings() {
    if (state.recentListings.length === 0) {
      return;
    }
    if (commitList("recentListings", [])) {
      if (ui.recentListingsSummary) {
        ui.recentListingsSummary.focus();
      }
      announce("Recent listing history cleared.");
    }
  }

  function updateSearchButton() {
    if (ui.saveSearch) {
      ui.saveSearch.disabled = !(ui.searchInput && ui.searchInput.value.trim());
    }
  }

  function updateHistoryButtons() {
    try {
      if (ui.back) {
        ui.back.disabled = !ui.webview || !ui.webview.canGoBack();
      }
      if (ui.forward) {
        ui.forward.disabled = !ui.webview || !ui.webview.canGoForward();
      }
    } catch {
      if (ui.back) {
        ui.back.disabled = true;
      }
      if (ui.forward) {
        ui.forward.disabled = true;
      }
    }
  }

  function updateActiveRoute(value) {
    if (!ui.sidebar) {
      return;
    }

    const url = marketplaceUrl(value);
    const links = Array.from(ui.sidebar.querySelectorAll("a[data-route]"));
    const active = url
      ? links
          .filter((link) => {
            const route = link.dataset.route;
            return (
              url.pathname === route ||
              url.pathname.startsWith(route + "/")
            );
          })
          .sort((a, b) => b.dataset.route.length - a.dataset.route.length)[0]
      : null;

    links.forEach((link) => {
      const selected = link === active;
      link.classList.toggle("is-active", selected);
      if (selected) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function updateSaveListingButton(value) {
    if (!ui.saveListing) {
      return;
    }

    const url = listingUrl(value);
    const saved = Boolean(url) && state.listings.some((item) => item.url === url);
    const titleReady = state.titleUrl === value && Boolean(state.title);
    const unavailable =
      !ui.webview ||
      state.loading ||
      state.loadFailed ||
      !url ||
      !titleReady;
    const label = ui.saveListing.querySelector(".button-label");
    const icon = ui.saveListing.querySelector('[aria-hidden="true"]');

    ui.saveListing.disabled = unavailable || saved;
    ui.saveListing.setAttribute(
      "aria-label",
      saved ? "Listing saved" : "Save current listing"
    );
    if (label) {
      label.textContent = saved ? "Saved" : "Save listing";
    }
    if (icon) {
      icon.textContent = saved ? "★" : "☆";
    }

    if (saved) {
      ui.saveListing.title = "This listing is saved";
    } else if (state.loading || (url && !titleReady)) {
      ui.saveListing.title = "Wait for the listing to finish loading";
    } else if (url) {
      ui.saveListing.title = "Save current listing";
    } else {
      ui.saveListing.title = "Open a Marketplace listing to save it";
    }
  }

  function updateCopyButton(value) {
    if (!ui.copyUrl) {
      return;
    }

    const cleanListingUrl = listingUrl(value);
    const canCopy = Boolean(ui.webview) && isFacebookHttpsUrl(value);
    const label = cleanListingUrl
      ? "Copy clean listing link"
      : "Copy current URL";
    ui.copyUrl.disabled = !canCopy;
    ui.copyUrl.setAttribute("aria-label", label);
    ui.copyUrl.title = label;
  }

  function syncPage(url = currentUrl(), title = "") {
    const previousUrl = ui.currentUrl ? ui.currentUrl.value : "";
    const sameListing =
      listingUrl(previousUrl) &&
      listingUrl(previousUrl) === listingUrl(url);

    if (url && url !== previousUrl) {
      if (sameListing && state.titleUrl === previousUrl) {
        state.titleUrl = url;
      } else {
        state.title = "Marketplace";
        state.titleUrl = "";
      }
    }
    if (title && title.trim()) {
      state.title = title.trim();
      state.titleUrl = url;
    }

    if (ui.pageTitle) {
      ui.pageTitle.textContent = state.title;
      ui.pageTitle.title = state.title;
    }
    if (ui.currentUrl) {
      ui.currentUrl.value = url;
      ui.currentUrl.title = url;
    }
    updateCopyButton(url);
    updateActiveRoute(url);
    updateSaveListingButton(url);
    window.setTimeout(updateHistoryButtons, 0);
  }

  function setLoading(loading) {
    state.loading = loading;
    if (ui.loading) {
      ui.loading.classList.toggle("is-hidden", !loading);
      ui.loading.setAttribute("aria-hidden", String(!loading));
    }
    if (ui.webview) {
      ui.webview.setAttribute("aria-busy", String(loading));
    }
    updateSaveListingButton(currentUrl());
  }

  function clearLoadError() {
    state.loadFailed = false;
    if (ui.errorBanner) {
      ui.errorBanner.classList.add("is-hidden");
    }
    updateSaveListingButton(currentUrl());
  }

  function showLoadError(message, url = "") {
    state.loadFailed = true;
    state.failedUrl = url || state.failedUrl;
    resetSuccessfulLoad();
    if (ui.errorMessage) {
      ui.errorMessage.textContent = message;
    }
    if (ui.errorBanner) {
      ui.errorBanner.classList.remove("is-hidden");
    }
    setLoading(false);
  }

  function resetSuccessfulLoad() {
    state.recentTitle = "";
    state.recentTitleUrl = "";
    state.successfullyLoadedUrl = "";
    state.successfulVisitAt = "";
  }

  function markSuccessfulLoad() {
    if (state.loadFailed) {
      return;
    }

    const pageUrl = currentUrl();
    if (!pageUrl) {
      return;
    }
    if (
      state.successfullyLoadedUrl !== pageUrl ||
      !state.successfulVisitAt
    ) {
      state.successfullyLoadedUrl = pageUrl;
      state.successfulVisitAt = new Date().toISOString();
    }

    syncPage(pageUrl, currentTitle());
    recordRecentListing(pageUrl, state.successfulVisitAt);
  }

  function isAborted(error) {
    return Boolean(
      error &&
        (error.code === "ERR_ABORTED" ||
          error.errno === -3 ||
          String(error.message || "").includes("ERR_ABORTED"))
    );
  }

  function reconcileLoadingAfterAbort() {
    window.setTimeout(() => {
      try {
        setLoading(Boolean(ui.webview && ui.webview.isLoading()));
      } catch {
        setLoading(false);
      }
    }, 0);
  }

  function loadViewUrl(url, failureMessage) {
    try {
      const result = ui.webview.loadURL(url);
      Promise.resolve(result).catch((error) => {
        if (isAborted(error)) {
          reconcileLoadingAfterAbort();
        } else {
          console.error("Marketplace navigation failed:", error);
          showLoadError(failureMessage, url);
        }
      });
      return true;
    } catch (error) {
      if (isAborted(error)) {
        reconcileLoadingAfterAbort();
      } else {
        console.error("Marketplace navigation failed:", error);
        showLoadError(failureMessage, url);
      }
      return false;
    }
  }

  function navigateMarketplace(value) {
    const url = marketplaceUrl(value);
    if (!url || !ui.webview) {
      announce("That Marketplace destination cannot be opened.");
      return false;
    }

    clearLoadError();
    setLoading(true);
    return loadViewUrl(url.toString(), "Marketplace could not open that page.");
  }

  function reloadPage() {
    if (!ui.webview) {
      return;
    }
    clearLoadError();
    setLoading(true);
    try {
      ui.webview.reload();
    } catch {
      setLoading(false);
      announce("This page cannot be reloaded yet.");
    }
  }

  function retryPage() {
    if (!ui.webview) {
      return;
    }
    clearLoadError();
    setLoading(true);
    if (state.failedUrl && isFacebookHttpsUrl(state.failedUrl)) {
      loadViewUrl(
        state.failedUrl,
        "Marketplace still could not be loaded."
      );
    } else {
      reloadPage();
    }
  }

  function initializeLoadingState() {
    if (!ui.webview) {
      setLoading(false);
      return;
    }
    try {
      setLoading(ui.webview.isLoading());
    } catch {
      setLoading(true);
    }
  }

  listen(ui.sidebar, "click", (event) => {
    const link =
      event.target instanceof Element
        ? event.target.closest("a[data-route]")
        : null;
    if (link && ui.sidebar.contains(link)) {
      event.preventDefault();
      navigateMarketplace(link.dataset.route);
    }
  });
  listen(ui.toggle, "click", () => {
    const collapsed = ui.sidebar && ui.sidebar.classList.contains("collapsed");
    setSidebarCollapsed(!collapsed);
  });
  listen(ui.searchForm, "submit", (event) => {
    event.preventDefault();
    runSearch(ui.searchInput ? ui.searchInput.value : "");
  });
  listen(ui.searchInput, "input", updateSearchButton);
  listen(ui.saveSearch, "click", saveSearch);
  listen(ui.saveListing, "click", saveListing);
  listen(ui.clearRecentListings, "click", clearRecentListings);
  listen(ui.theme, "click", toggleTheme);
  listen(systemDarkTheme, "change", () => {
    if (!document.documentElement.dataset.theme) {
      updateThemeButton();
    }
  });
  listen(ui.reload, "click", reloadPage);
  listen(ui.retry, "click", retryPage);
  listen(ui.back, "click", () => {
    try {
      if (ui.webview && ui.webview.canGoBack()) {
        ui.webview.goBack();
      }
    } catch {
      announce("Back navigation is not available yet.");
    }
  });
  listen(ui.forward, "click", () => {
    try {
      if (ui.webview && ui.webview.canGoForward()) {
        ui.webview.goForward();
      }
    } catch {
      announce("Forward navigation is not available yet.");
    }
  });
  listen(ui.copyUrl, "click", async () => {
    const pageUrl = currentUrl();
    const cleanListingUrl = listingUrl(pageUrl);
    const url = copyTargetUrl(pageUrl);
    if (
      !isFacebookHttpsUrl(url) ||
      !window.electronAPI ||
      typeof window.electronAPI.copyUrl !== "function"
    ) {
      announce("This URL cannot be copied.");
      return;
    }
    try {
      await window.electronAPI.copyUrl(url);
      announce(
        cleanListingUrl ? "Clean listing link copied." : "Link copied."
      );
    } catch (error) {
      console.error("Could not copy the Marketplace URL:", error);
      announce("The link could not be copied.");
    }
  });

  if (ui.webview) {
    listen(ui.webview, "did-start-loading", () => {
      resetSuccessfulLoad();
      clearLoadError();
      setLoading(true);
    });
    listen(ui.webview, "did-stop-loading", () => {
      setLoading(false);
      markSuccessfulLoad();
    });
    listen(ui.webview, "did-navigate", (event) => {
      resetSuccessfulLoad();
      syncPage(event.url || currentUrl());
    });
    listen(ui.webview, "did-navigate-in-page", (event) => {
      resetSuccessfulLoad();
      syncPage(event.url || currentUrl());
    });
    listen(ui.webview, "page-title-updated", (event) => {
      const pageUrl = currentUrl();
      const title = (event.title || "").trim();
      syncPage(pageUrl, title);
      state.recentTitle = title;
      state.recentTitleUrl = title ? pageUrl : "";
      if (state.successfullyLoadedUrl === pageUrl) {
        recordRecentListing(pageUrl, state.successfulVisitAt);
      }
    });
    listen(ui.webview, "dom-ready", () => {
      syncPage(currentUrl(), currentTitle());
    });
    listen(ui.webview, "did-finish-load", () => {
      if (state.loadFailed) {
        setLoading(false);
        updateHistoryButtons();
        return;
      }
      state.failedUrl = "";
      clearLoadError();
      setLoading(false);
      markSuccessfulLoad();
    });
    listen(ui.webview, "did-fail-load", (event) => {
      if (event.errorCode === -3) {
        reconcileLoadingAfterAbort();
        return;
      }
      if (event.isMainFrame === false) {
        return;
      }
      const detail = event.errorDescription
        ? " " + event.errorDescription
        : "";
      showLoadError(
        "Marketplace could not be loaded." + detail,
        event.validatedURL || currentUrl()
      );
    });
    listen(ui.webview, "render-process-gone", () => {
      showLoadError(
        "Marketplace stopped responding. Try loading it again.",
        currentUrl()
      );
    });
  } else {
    [ui.reload, ui.copyUrl, ui.saveListing, ui.retry].forEach((button) => {
      if (button) {
        button.disabled = true;
      }
    });
    showLoadError("The Marketplace browser could not be initialized.");
  }

  initializeTheme();
  state.searches = loadSearches();
  state.listings = loadListings();
  state.recentListings = loadRecentListings();
  renderSavedLists();
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(STORAGE_KEYS.collapsed) === "true";
  } catch {
    // Keep the sidebar open when storage is unavailable.
  }
  setSidebarCollapsed(collapsed, false);
  updateSearchButton();
  initializeLoadingState();
  syncPage(currentUrl(), state.loading ? "" : currentTitle());
  updateHistoryButtons();
});
