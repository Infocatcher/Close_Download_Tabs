pref("extensions.closedownloadtabs.closeSelectedTab", true);
pref("extensions.closedownloadtabs.maxLoadingWait", 150000); // 2.5*60e3
pref("extensions.closedownloadtabs.waitDelay", 30);
pref("extensions.closedownloadtabs.waitLoadedTab", 80); // Additional delay for about:neterror?..
pref("extensions.closedownloadtabs.waitLoadedTab.greasemonkey", 1000); // Additional delay for *.user.js
pref("extensions.closedownloadtabs.waitDownload", 2000);
pref("extensions.closedownloadtabs.waitDownloadAction", 1000);

// API for another extensions:
// 1. Add extensions.closedownloadtabs.closeURI.pref.<full_pref_name> = true preference
// 2. Do following for new tab:
//   setPref("<full_pref_name>", location.href);
//   deletePref("<full_pref_name>"); // Don't save history :)
pref("extensions.closedownloadtabs.closeURI.pref.extensions.greasemonkey.scriptvals.dev/null/Direct Links.closeURI", true);
pref("extensions.closedownloadtabs.closeURI.pref.greasemonkey.scriptvals.dev/null/Direct Links.closeURI", true);
pref("extensions.closedownloadtabs.closeURI.expire", 10000);

pref("extensions.closedownloadtabs.debug", 1); // 2 - all messages, 1 - only info, 0 - nothing