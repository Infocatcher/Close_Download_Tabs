#### Description
Extension automatically close new tabs with downloadable links. And, as a side effect, close any tabs, that still empty after opening. Specially opened empty tabs shouldn't be closed.

#### Known issues
- Firefox can't save file, if tab was closed, so just hide tab. But tab is still visible in Panorama.
- Built-in extensions installation mechanism uses tab depend notifications, so ignore `application/x-xpinstall` content-type.
- We get empty tab in FTP and “550 Failed to change directory.” modal alert (it's bad to close this tab – site may be just down for now).
- Missing extension icon in Firefox 3.0 and 3.5 – we can't use &lt;em:iconURL&gt; in Firefox 4.0 - 7.0.

#### Preferences
See _extensions.closedownloadtabs.*_ in about:config (see <a href="defaults/preferences/prefs.js">defaults/preferences/prefs.js</a> for some descriptions)
<br>_extensions.closedownloadtabs.debug_:
<br>0 – don't show debug messages in Error Console
<br>1 – show only important messages
<br>2 – show all messages

#### API for other extensions
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

Also you can use `CloseDownloadTabs:TabHide` and `CloseDownloadTabs:TabShow` events, example:
```js
function logger(e) {
	var tab = e.originalTarget || e.target;
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