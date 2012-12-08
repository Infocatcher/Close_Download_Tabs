pref("extensions.closedownloadtabs.closeSelectedTab", true);
pref("extensions.closedownloadtabs.maxLoadingWait", 150000); // 2.5*60e3, don't wait more than this time
pref("extensions.closedownloadtabs.waitDelay", 500); // Interval to periodically check browser.webProgress.isLoadingDocument
// Needs for custombutton://... links (https://addons.mozilla.org/firefox/addon/custom-buttons/)
// and any other custom protocols with nsIProtocolHandler.URI_DOES_NOT_RETURN_DATA flag
pref("extensions.closedownloadtabs.waitLoadedTab", 80); // Additional delay for about:neterror?..
pref("extensions.closedownloadtabs.waitLoadedTab.greasemonkey", 1000); // Additional delay for *.user.js
pref("extensions.closedownloadtabs.waitAfterStopProgress", 10); // Additional delay after STATE_STOP notification
pref("extensions.closedownloadtabs.waitDownload", 2000); // Delay before tab will be closed (if there is now "locker windows")
pref("extensions.closedownloadtabs.waitDownloadAction", 1000); // Wait after "locker window" will be closed

// API for another extensions:
// 1. Add extensions.closedownloadtabs.closeURI.pref.<full_pref_name> = true preference
// 2. Do following for new tab:
//   setPref("<full_pref_name>", location.href);
//   deletePref("<full_pref_name>"); // Don't save history :)
pref("extensions.closedownloadtabs.closeURI.pref.extensions.greasemonkey.scriptvals.dev/null/Direct Links.closeURI", true);
pref("extensions.closedownloadtabs.closeURI.pref.greasemonkey.scriptvals.dev/null/Direct Links.closeURI", true);
pref("extensions.closedownloadtabs.closeURI.pref.extensions.scriptish.scriptvals.DirectLinks@devnull.closeURI", true);
pref("extensions.closedownloadtabs.closeURI.expire", 10000);

pref("extensions.closedownloadtabs.debug", 1); // 2 - all messages, 1 - only info, 0 - nothing