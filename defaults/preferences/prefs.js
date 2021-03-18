pref("extensions.closeDownloadTabs.closeSelectedTab", true);
pref("extensions.closeDownloadTabs.maxLoadingWait", 150000); // 2.5*60e3, don't wait more than this time
pref("extensions.closeDownloadTabs.waitInterval", 500); // Interval to periodically check browser.webProgress.isLoadingDocument
// Needs for custombutton://... links (https://addons.mozilla.org/addon/custom-buttons/)
// and any other custom protocols with nsIProtocolHandler.URI_DOES_NOT_RETURN_DATA flag
pref("extensions.closeDownloadTabs.waitLoadedTab", 80); // Additional delay for about:neterror?..
pref("extensions.closeDownloadTabs.waitLoadedTab.greasemonkey", 1000); // Additional delay for *.user.js
pref("extensions.closeDownloadTabs.waitAfterStopProgress", 10); // Additional delay after STATE_STOP notification
pref("extensions.closeDownloadTabs.waitDownload", 2500); // Delay before tab will be closed (if there is no "locker windows")
pref("extensions.closeDownloadTabs.waitDownloadAction", 1500); // Wait after "locker window" will be closed
pref("extensions.closeDownloadTabs.checkModalInterval", 1500); // We don't remove tab until opened modal dialog
// See https://github.com/Infocatcher/Close_Download_Tabs/issues/1 for details

// API for other extensions (example for Greasemonkey script):
// GM_log("[Close Download Tabs] Mark URI as empty:\n" + location.href);
pref("extensions.closeDownloadTabs.closeURI.expire", 10000);
pref("extensions.closeDownloadTabs.closeURI.delay", 150); // Delay between makeTabEmpty() and removeTab()
// We make tab empty to don't save it in undo close history.
// And without delay wrong state (not yet emptied) may be saved.

pref("extensions.closeDownloadTabs.debug", false);