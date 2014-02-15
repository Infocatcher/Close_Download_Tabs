##### Description:
Extension automatically close new tabs with downloadable links. And, as a side effect, close any tabs, that still empty after opening. Specially opened empty tabs shouldn't be closed.
<br>
##### Preferences:
See _extensions.closedownloadtabs.*_ in about:config
<br>_extensions.closedownloadtabs.debug_:
<br>0 – don't show debug messages in Error Console
<br>1 – show only important messages
<br>2 – show all messages
<br>
##### API for other extensions:
You can post special message using <a href="https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIConsoleService#logStringMessage%28%29">nsIConsoleService.logStringMessage()</a>, example:
```js
var uri = ...; // URI of some just opened tab
Services.console.logStringMessage("[Close Download Tabs] Mark URI as empty:\n" + uri);
```
Example for <a href="https://addons.mozilla.org/firefox/addon/greasemonkey/">Greasemonkey</a>/<a href="https://addons.mozilla.org/firefox/addon/scriptish/">Scriptish</a>:
```js
// ==UserScript==
// @name      User script example for Close Download Tabs extension
// @namespace dev/null
// @run-at    document-start
// @include   http://example.com/
// @grant     GM_log
// ==/UserScript==
GM_log("[Close Download Tabs] Mark URI as empty:\n" + location.href);
```
Yet another user script example: <a href="https://github.com/Infocatcher/UserScripts/tree/master/Direct_Links">Direct Links</a>.

Also you can use “CloseDownloadTabs:TabHide” and “CloseDownloadTabs:TabShow” events, example:
```javascript
function logger(e) {
	var tab = e.target;
	Services.console.logStringMessage(
		e.type
		+ "\nLabel: " + tab.getAttribute("label")
		+ "\nURI: " + tab.linkedBrowser.currentURI.spec
		+ "\nclosedownloadtabs-closed: " + tab.hasAttribute("closedownloadtabs-closed")
	);
}
window.addEventListener("CloseDownloadTabs:TabHide", logger, false);
window.addEventListener("CloseDownloadTabs:TabShow", logger, false);
```