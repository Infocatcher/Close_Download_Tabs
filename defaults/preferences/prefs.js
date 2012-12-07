pref("extensions.closedownloadtabs.closeSelectedTab", true);
pref("extensions.closedownloadtabs.maxLoadingWait", 150000); // 2.5*60e3
pref("extensions.closedownloadtabs.waitDelay", 30);
pref("extensions.closedownloadtabs.waitLoadedTab", 80); // Additional delay for about:neterror?..
pref("extensions.closedownloadtabs.waitLoadedTab.greasemonkey", 1000); // Additional delay for *.user.js
pref("extensions.closedownloadtabs.waitDownload", 2000);
pref("extensions.closedownloadtabs.waitDownloadAction", 1000);
pref("extensions.closedownloadtabs.closeURIPrefs", "extensions.greasemonkey.scriptvals.dev/null/Direct Links.closeURI|greasemonkey.scriptvals.dev/null/Direct Links.closeURI");
// Use "|" as separator: prefName1|prefName2|prefName3
pref("extensions.closedownloadtabs.closeURIExpire", 10000);

pref("extensions.closedownloadtabs.debug", 1); // 2 - all messages, 1 - only info, 0 - nothing