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
See notes about _extensions.closedownloadtabs.closeURI.pref.*_ in [defaults/preferences/prefs.js](defaults/preferences/prefs.js#files)
<br>Example: [direct_links.user.js](https://github.com/Infocatcher/UserScripts/blob/62ddfe043ac807ceea3fe374c00dda3dcde16447/Direct_Links/direct_links.user.js#L70) for [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/)

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