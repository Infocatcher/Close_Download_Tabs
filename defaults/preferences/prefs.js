pref("extensions.closeDownloadTabs.closeSelectedTab", true);
pref("extensions.closeDownloadTabs.maxLoadingWait", 150000); // 2.5*60e3, don't wait more than this time
pref("extensions.closeDownloadTabs.waitInterval", 500); // Interval to periodically check browser.webProgress.isLoadingDocument
// Needs for custombutton://... links (https://addons.mozilla.org/firefox/addon/custom-buttons/)
// and any other custom protocols with nsIProtocolHandler.URI_DOES_NOT_RETURN_DATA flag
pref("extensions.closeDownloadTabs.waitLoadedTab", 80); // Additional delay for about:neterror?..
pref("extensions.closeDownloadTabs.waitLoadedTab.greasemonkey", 1000); // Additional delay for *.user.js
pref("extensions.closeDownloadTabs.waitAfterStopProgress", 10); // Additional delay after STATE_STOP notification
pref("extensions.closeDownloadTabs.waitDownload", 2000); // Delay before tab will be closed (if there is now "locker windows")
pref("extensions.closeDownloadTabs.waitDownloadAction", 1000); // Wait after "locker window" will be closed
pref("extensions.closeDownloadTabs.checkModalInterval", 1500); // We don't remove tab, until opened modal dialog
// See https://github.com/Infocatcher/Close_Download_Tabs/issues/1 for details

/* API for other extensions:
1. Add extensions.closeDownloadTabs.events.pref.<pref_name> = true preference
2. Do following for new tab:
	setPref("<pref_name>", "?" + new Date().getTime());
	var evtType = getPref("<pref_name>", "");
	if(evtType && evtType.charAt(0) != "?") {
		clearPref("<pref_name>");
		var evt = document.createEvent("Events");
		evt.initEvent(evtType, true, false);
		document.dispatchEvent(evt);
	}
*/
pref("extensions.closeDownloadTabs.events.pref.extensions.greasemonkey.scriptvals.dev/null/Direct Links.event", true);
pref("extensions.closeDownloadTabs.events.pref.greasemonkey.scriptvals.dev/null/Direct Links.event", true);
pref("extensions.closeDownloadTabs.events.pref.extensions.scriptish.scriptvals.DirectLinks@devnull.event", true);
pref("extensions.closeDownloadTabs.events.pref.extensions.greasemonkey.scriptvals.dev/null/Direct Links Testcase.event", true);
pref("extensions.closeDownloadTabs.events.pref.greasemonkey.scriptvals.dev/null/Direct Links Testcase.event", true);
pref("extensions.closeDownloadTabs.events.pref.extensions.scriptish.scriptvals.DirectLinksTestcase@devnull.event", true);
pref("extensions.closeDownloadTabs.events.expire", 1000);
pref("extensions.closeDownloadTabs.events.delay", 150); // Delay between makeTabEmpty() and removeTab()
// We make tab empty to don't save it in undo close history.
// And without delay wrong state (not yet emptied) may be saved.

pref("extensions.closeDownloadTabs.debug", 1); // 2 - all messages, 1 - only info, 0 - nothing