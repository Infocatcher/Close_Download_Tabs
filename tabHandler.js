const _cdt = "__closeDownloadTabs_";
function TabHandler(tab) {
	var window = tab.ownerDocument.defaultView;
	var gBrowser = window.gBrowser;
	if(this.isEmptyTab(tab, gBrowser)) {
		_log("Opened tab is empty, ignore");
		return;
	}
	_log("Opened new tab: " + (tab.getAttribute("label") || "").substr(0, 256));

	this.tab = tab;
	this.window = window;
	this.gBrowser = gBrowser;
	this.prevTab = gBrowser.selectedTab;
	this.browser = tab.linkedBrowser;
	this.init();
}
TabHandler.prototype = {
	cdt: closeDownloadTabs,

	id: -1,
	origTab: null,
	_stop: false,
	_forceStop: false,
	_hasProgressListener: false,
	_waitedLoad: false,
	_waitTimer: 0,

	init: function() {
		var cdt = this.cdt;
		var id = this.id = ++cdt._handlerId;
		cdt._handlers[id] = this;

		this._maxLoadingWait     = prefs.get("maxLoadingWait",             2.5*60e3);
		this._waitInterval       = prefs.get("waitInterval",               500);
		this._waitLoaded         = prefs.get("waitLoadedTab",              80);
		this._waitLoadedGM       = prefs.get("waitLoadedTab.greasemonkey", 1000);
		this._waitStopProgress   = prefs.get("waitAfterStopProgress",      10);
		this._waitDownload       = prefs.get("waitDownload",               2500);
		this._waitDownloadAction = prefs.get("waitDownloadAction",         1500);

		this.startWait();
	},
	startWait: function() {
		this._stopWait = Date.now() + this._maxLoadingWait;
		this.wait();
		if(!this._hasProgressListener) {
			this._hasProgressListener = true;
			this.browser.addProgressListener(this);
			//_log("TabHandler.addProgressListener()");
		}
	},
	destroy: function(reason) {
		this.window.removeEventListener("unload", this, false);
		this.window.removeEventListener("TabSelect", this, false);
		this.destroyProgress();
		if("destroyModalChecker" in this)
			this.destroyModalChecker();
		if(reason) {
			var tab = this.tab;
			if(tab.hasAttribute(this.cdt.closedAttr)) {
				_log("Try restore not yet closed tab");
				this.showTab(tab);
			}
		}
		this.window = this.tab = this.prevTab = this.gBrowser = this.browser = null;
		delete this.cdt._handlers[this.id];
		_log("TabHandler.destroy()");
	},
	destroyProgress: function() {
		if(!this._hasProgressListener)
			return;
		this._hasProgressListener = false;
		if(!this.browser.removeProgressListener)
			_log("TabHandler.destroyProgress(): browser looks already destroyed");
		else {
			this.browser.removeProgressListener(this);
			_log("TabHandler.destroyProgress() => browser.removeProgressListener()");
		}
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "TabSelect": this.dontSelectHiddenTab(e); break;
			case "unload":    this.closeTab(e);
		}
	},

	isEmptyTab: function(tab, gBrowser) {
		// See "addTab" method in chrome://browser/content/tabbrowser.xml
		var tabLabel = tab.getAttribute("label") || "";
		// See https://github.com/Infocatcher/Private_Tab/issues/152
		if(!tabLabel && platformVersion >= 33 && !this.isSeaMonkey)
			return false;
		if(
			!tabLabel
			|| tabLabel == "undefined"
			|| tabLabel == "about:blank"
			|| tabLabel == "private:///#about:blank" // Private Tab https://addons.mozilla.org/addon/private-tab/
			|| tabLabel == "private:about:blank"
		)
			return true;
		if(/^\w+:\S*$/.test(tabLabel))
			return false;
		// We should check tab label for SeaMonkey and old Firefox
		var emptyTabLabel = this.getTabBrowserString("tabs.emptyTabTitle", gBrowser)
			|| this.getTabBrowserString("tabs.untitled", gBrowser);
		!emptyTabLabel && _log("isEmptyTab(): can't get empty tab label");
		return tabLabel == emptyTabLabel;
	},
	getTabBrowserString: function(id, gBrowser) {
		try {
			return gBrowser.mStringBundle.getString(id);
		}
		catch(e) {
		}
		return undefined;
	},

	QueryInterface: function(iid) {
		if(
			iid.equals(Components.interfaces.nsIWebProgressListener)
			|| iid.equals(Components.interfaces.nsISupportsWeakReference)
			|| iid.equals(Components.interfaces.nsISupports)
		)
			return this;
		throw Components.results.NS_ERROR_NO_INTERFACE;
	},
	// nsIWebProgressListener interface
	onStateChange: function(webProgress, request, stateFlags, status) {
		if(!(request instanceof Components.interfaces.nsIChannel))
			return;
		var wpl = Components.interfaces.nsIWebProgressListener;
		if(!(stateFlags & wpl.STATE_STOP && stateFlags & wpl.STATE_IS_NETWORK))
			return;
		this.destroyProgress();
		try {
			var contentType = request.contentType;
		}
		catch(e) { // Component returned failure code: 0x80040111 (NS_ERROR_NOT_AVAILABLE) [nsIChannel.contentType]
		}
		if(contentType == "application/x-xpinstall") {
			// Built-in extension installation mechanism uses tab-depended notifications,
			// so ignore this content-type.
			// And we can get xpinstallConfirm.xul dialog without download-in-progress notification.
			_info("Opened " + contentType + " => set stop flag");
			this._stop = true;
		}
		else if(
			contentType == "application/x-unknown-content-type"
			&& request instanceof Components.interfaces.nsIFTPChannel
		) {
			// 550 Failed to change directory?
			_log("Opened FTP with " + contentType + ', looks like "550 Failed to change directory" => set stop flag');
			this._stop = true;
		}
		var spec = request.URI.spec;
		if(
			"@mozilla.org/network/protocol;1?name=private" in Components.classes
			&& spec.substr(0, 9) == "jar:file:"
			&& spec.indexOf("/privateTab@infocatcher.xpi!/protocolRedirect.html#") != -1
		) {
			_log("Detected private: protocol");
			this._forceStop = true;
		}
		this.stopWait();
		this.wait(this._waitStopProgress);
		_log("onStateChange() + STATE_STOP => wait " + this._waitStopProgress + " ms");
	},
	onLocationChange: function(webProgress, request, uri, flags) {
	},
	onProgressChange: function(webProgress, request, curProgress, maxProgress, curTotalProgress, maxTotalProgress) {
	},
	onSecurityChange: function(webProgress, request, state) {
	},
	onStatusChange: function(webProgress, request, status, message) {
	},

	wait: function(delay) {
		this._waitTimer = this.window.setTimeout(this.fixedWait, delay || this._waitInterval);
	},
	stopWait: function() {
		this.window.clearTimeout(this._waitTimer);
	},
	get fixedWait() {
		return setProperty(this, "fixedWait", this.waitProceed.bind(this));
	},
	WAIT: {
		PROCEED: 0,
		CLOSING: 1,
		DONE:    2
	},
	waitProceed: function() {
		const WAIT = this.WAIT;
		switch(this.waitCheck()) {
			case WAIT.CLOSING: this.destroyProgress(); break;
			case WAIT.DONE:    this.destroy();
		}
	},
	waitCheck: function() {
		const WAIT = this.WAIT;
		var tab = this.tab;
		if(!tab.parentNode || !tab.linkedBrowser) // Tab closed
			return WAIT.DONE;

		if(this.isLoading) {
			if(Date.now() < this._stopWait) {
				this.wait();
				return WAIT.PROCEED;
			}
			return WAIT.DONE;
		}
		if(this._forceStop) {
			_log("Force stop flag, ignore");
			return WAIT.DONE;
		}
		_log("Tab looks like loaded");
		var browser = this.browser;
		var window = this.window;
		if(browser.currentURI.spec == "about:blank") {
			if(!this._waitedLoad) {
				this._waitedLoad = true;
				var delay = (tab.getAttribute("label") || "").substr(-8) == ".user.js" && this.hasGreasemonkey
					? this._waitLoadedGM
					: this._waitLoaded;
				this.wait(delay);
				_log("Wait loaded tab: " + delay + "ms");
				return WAIT.PROCEED;
			}
		}
		else {
			var canClose = this.canClose(browser);
			if(!canClose) {
				_log("Opened regular tab, ignore");
				return WAIT.DONE;
			}
		}
		if(this._stop) {
			_log("Stop flag, ignore");
			return WAIT.DONE;
		}

		var gBrowser = this.gBrowser;
		if("getNotificationBox" in gBrowser) {
			var nb = gBrowser.getNotificationBox(browser);
			if(nb && nb.currentNotification) {
				_info("Found notification in <notificationbox>, ignore tab");
				return WAIT.DONE;
			}
		}
		if(
			"PopupNotifications" in window // resource://gre/modules/PopupNotifications.jsm
			&& "_getNotificationsForBrowser" in window.PopupNotifications
		) {
			var ns = window.PopupNotifications._getNotificationsForBrowser(browser);
			if(ns && ns.length) {
				_info("Found doorhanger notification, ignore tab");
				return WAIT.DONE;
			}
		}
		if(this.hasSingleTab(gBrowser)) {
			_log("Don't hide last tab");
			return WAIT.DONE;
		}

		if(gBrowser.selectedTab == tab) {
			if(!prefs.get("closeSelectedTab", true))
				return WAIT.DONE;
			this.unSelectTab(tab);
		}

		// We can't save file w/o tab :(
		// And Panorama still show this tab
		this.hideTab(tab, canClose);

		window.addEventListener("unload", this, false); //~ todo: tab closed, but can be restored :(
		window.setTimeout(this.delayedClose.bind(this), this._waitDownload);
		return WAIT.CLOSING;
	},
	suspendBrowser: function(browser, suspend) {
		if(suspend == _cdt + "suspended" in browser)
			return;
		if(suspend) {
			browser[_cdt + "suspended"] = true;
			browser.stop();
		}
		else {
			delete browser[_cdt + "suspended"];
		}
		var ds = browser.docShell || null;
		_log("suspendBrowser(), browser.docShell: " + ds + (ds ? "" : ", e10s?"));
		if(ds) {
			var ds = browser.docShell;
			if(suspend) {
				browser[_cdt + "docShell"] = {
					allowJavascript:    ds.allowJavascript,
					allowMetaRedirects: ds.allowMetaRedirects,
					__proto__: null
				};
				ds.allowJavascript = ds.allowMetaRedirects = false;
				ds.suspendRefreshURIs();
			}
			else {
				var origs = browser[_cdt + "docShell"];
				delete browser[_cdt + "docShell"];
				for(var p in origs)
					ds[p] = origs[p];
				ds.resumeRefreshURIs();
			}
		}
		try {
			var contentWindow = browser.contentWindow || browser.contentWindowAsCPOW;
			var dwu = contentWindow
				.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIDOMWindowUtils);
		}
		catch(e) {
			Components.utils.reportError(LOG_PREFIX + "Can't get nsIDOMWindowUtils");
			Components.utils.reportError(e);
		}
		if(dwu && "suppressEventHandling" in dwu) // Firefox 3.5+
			dwu.suppressEventHandling(suspend);
		if(dwu && "suspendTimeouts" in dwu) { // Firefox 4+
			if(suspend)
				dwu.suspendTimeouts();
			else
				dwu.resumeTimeouts();
		}
		_log((suspend ? "Suspend" : "Resume") + " browser: " + browser.currentURI.spec);
	},

	makeTabEmpty: function(tab) {
		// Based on code from Multiple Tab Handler extension
		// chrome://multipletab/content/multipletab.js -> makeTabBlank()
		// https://github.com/piroor/multipletab/blob/master/content/multipletab/multipletab.js
		try {
			var browser = tab.linkedBrowser;
			browser.loadURI("about:blank");
			browser.stop();
			var sh = browser.sessionHistory;
			if(sh instanceof Components.interfaces.nsISHistory)
				sh.PurgeHistory(sh.count);
			delete tab.__SS_extdata;
			delete browser.__SS_data;
			delete browser.__SS_formDataSaved;
			delete browser.__SS_hostSchemeData;
			try {
				var ssGlobal = Components.utils.import("resource:///modules/sessionstore/SessionStore.jsm", {});
			}
			catch(e2) {
			}
			if(ssGlobal && "RestoringTabsData" in ssGlobal) // Firefox 23+
				ssGlobal.RestoringTabsData.remove(browser);
			_log("Make tab empty " + (tab.getAttribute("label") || "").substr(0, 256));
		}
		catch(e) {
			Components.utils.reportError(LOG_PREFIX + "Can't make tab empty");
			Components.utils.reportError(e);
		}
	},
	get isLoading() {
		var browser = this.browser;
		var isLoading = !browser.currentURI
			|| !browser.webProgress
			|| browser.webProgress.isLoadingDocument;
		if(isLoading || platformVersion <= 60)
			return isLoading;
		return this.tab.getAttribute("busy") == "true";
	},
	canClose: function(browser) {
		if(_cdt + "canClose" in browser)
			return true;
		if(browser.currentURI && this.cdt.hasKey(browser.currentURI.spec))
			return browser[_cdt + "canClose"] = true;
		return false;
	},
	delayedClose: function() {
		var ws = Services.wm.getEnumerator(null);
		while(ws.hasMoreElements()) {
			var w = ws.getNext();
			if(!this.isLockerWindow(w))
				continue;
			_log(w.location + " opened => wait");
			var _this = this;
			w.addEventListener("unload", function unload() {
				w.removeEventListener("unload", unload, false);
				_log(w.location + " closed => closeTab()");
				_this.window.setTimeout(function() {
					_this.closeTab();
				}, _this._waitDownloadAction);
			}, false);
			return;
		}
		_log("Initial delay => closeTab()");
		this.closeTab();
	},
	isLockerWindow: function(win) {
		var loc = win.location.href;
		try {
			if(loc == "chrome://mozapps/content/downloads/unknownContentType.xul") {
				_log("Found opened unknownContentType.xul");
				var content = win.dialog.mContext
					.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
					.getInterface(Components.interfaces.nsIDOMWindow);
				return content == (this.browser.contentWindow || this.browser.contentWindowAsCPOW);
			}
			else if(loc == "chrome://greasemonkey/content/install.xul") {
				_log("Found opened Greasemonkey's install.xul");
				// chrome://greasemonkey/content/install.js
				var browser = win.arguments[0].wrappedJSObject[1];
				return browser == this.browser;
			}
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		return false;
	},
	unSelectTab: function(tab) {
		var gBrowser = this.gBrowser;
		var selectedTab = gBrowser.selectedTab;
		if(selectedTab != tab)
			return;
		var prevTab = this.prevTab;
		if(prevTab == selectedTab || !this.tabVisible(prevTab))
			prevTab = this.getOwnerTab(tab) || this.getNearestTab(tab);
		if(prevTab) {
			this.origTab = tab;
			gBrowser.selectedTab = prevTab;
		}
	},
	dontSelectHiddenTab: function(e) {
		var tab = this.tab;
		var selectedTab = e.originalTarget || e.target;
		if(selectedTab != tab || !tab.closing)
			return;
		// <tab /><tab collapsed="true" />
		// Close first tab: collapsed tab becomes selected
		var t = this.getNearestTab(tab);
		_log("Selected hidden tab" + (t
			? ', select "' + t.getAttribute("label") + '" instead'
			: ", but getNearestTab() failed"
		));
		if(!t)
			return;
		e.preventDefault();
		e.stopPropagation();
		this.gBrowser.selectedTab = t;
	},
	getOwnerTab: function(tab) {
		// See <method name="_blurTab"> in chrome://browser/content/tabbrowser.xml
		var owner = "owner" in tab && tab.owner;
		if(owner && this.tabVisible(owner))
			return owner;
		return null;
	},
	getNearestTab: function(tab) {
		return this.getSiblingTab(tab, "nextSibling") || this.getSiblingTab(tab, "previousSibling");
	},
	getSiblingTab: function(tab, sibling) {
		for(var t = tab[sibling]; t; t = t[sibling])
			if(this.tabVisible(t))
				return t;
		return null;
	},
	tabVisible: function(tab) {
		if(tab.hidden || tab.closing)
			return false;
		var bo = tab.boxObject;
		return bo.width > 0 && bo.height > 0;
	},
	hasSingleTab: function(gBrowser) {
		var tabs = gBrowser.visibleTabs || gBrowser.tabs || gBrowser.tabContainer.childNodes;
		return tabs.length <= 1;
	},
	closeTab: function(e) {
		var checkModalInterval = prefs.get("checkModalInterval", 1500);
		if(e || !this.cdt.hasAsyncFilePicker || checkModalInterval < 0) {
			this._closeTab.apply(this, arguments);
			return;
		}

		// Workaround for asynchronous nsIFilePicker.open()
		// https://github.com/Infocatcher/Close_Download_Tabs/issues/1
		//~ todo: not tested in Linux and Mac
		var _this = this;
		var window = this.window;
		var document = window.document;
		var cd = document.commandDispatcher;

		var box = document.createElement("box");
		box.id = "closeDownloadTabs-focus-tester-box";
		box.style.cssText = "position: fixed !important; top: -2147483648px !important; left: -2147483648px !important;";
		var iframe = document.createElement("iframe");
		iframe.id = "closeDownloadTabs-focus-tester";
		iframe.style.cssText = "width: 0 !important; height: 0 !important; min-width: 0 !important; min-height: 0 !important;";
		iframe.setAttribute("src", "about:blank");
		box.appendChild(iframe);
		document.documentElement.appendChild(box);

		var _i = 0;
		function checkModal() {
			var aw = Services.ww.activeWindow;
			var cnt = "[" + ++_i + "]";
			if(aw != window) {
				_log("checkModal()… " + cnt + " active other window: " + (aw && aw.location) + ", wait ");
				return;
			}
			_log("checkModal()… " + cnt);
			var fw = cd.focusedWindow;
			var fe = cd.focusedElement;
			iframe.contentWindow.focus();
			fw && fw.focus();
			fe && fe.focus();
		}
		function checkNotModal(e) {
			var trg = e.originalTarget || e.target;
			var trgDoc = trg.document || trg.ownerDocument || trg;
			if(trgDoc != iframe.contentDocument)
				return;
			_log("Not modal!");
			destroyModalChecker();
			_this._closeTab();
		}
		function destroyModalChecker() {
			window.clearInterval(checkModalTimer);
			window.removeEventListener("focus", checkNotModal, true);
			box.parentNode.removeChild(box);
			delete _this.destroyModalChecker;
			_log("destroyModalChecker()");
		}
		window.addEventListener("focus", checkNotModal, true);
		var checkModalTimer = window.setInterval(checkModal, checkModalInterval);
		this.destroyModalChecker = destroyModalChecker;
		_log("checkModal()");
		checkModal();
	},
	_closeTab: function(e) {
		var window = this.window;
		var isUnload = !!e;
		//e && window.removeEventListener(e.type, this, false);

		var tab = this.tab;
		if(!tab.parentNode) { // Already closed
			_log("Tab already closed => destroy()");
			this.destroy();
			return;
		}
		if(this.isLoading) {
			_info('Tab state was changed to "loading" => show tab and wait again...');
			this.showTab(tab);
			this.startWait();
			return;
		}

		var gBrowser = this.gBrowser;
		var browser = this.browser;
		var isEmpty = browser.currentURI.spec == "about:blank";
		if(!isEmpty)
			var canClose = this.canClose(browser);
		if(isEmpty || canClose) {
			tab.closing = false;
			if(!this.hasSingleTab(gBrowser)) {
				if(canClose) // Browser can't undo close destroyed tab, so try make it empty (empty tabs aren't saved!)
					this.makeTabEmpty(tab);
				if(canClose && !isUnload) {
					window.setTimeout(function() {
						gBrowser.removeTab(tab, { animate: false });
						_log("Close emptied tab (delayed)");
					}, prefs.get("closeURI.delay", 150));
				}
				else {
					try {
						gBrowser.removeTab(tab, { animate: false });
					}
					catch(e) {
						Components.utils.reportError(e);
					}
					_log("Close tab");
				}
			}
		}
		else if(tab.closing) {
			_info("Tab isn't empty anymore => show it");
			this.showTab(tab);
		}
		this.destroy();
	},
	closedTabPrefix: "[Closed by Close Download Tabs]",
	hideTab: function(tab, makeEmpty) {
		var window = this.window;
		var tabLabel = tab.getAttribute("label") || "";
		var newLabel = this.closedTabPrefix + (tabLabel ? " " + tabLabel : "");

		if(makeEmpty)
			this.suspendBrowser(tab.linkedBrowser, true);

		tab.setAttribute(this.cdt.closedAttr, "true");
		this.cdt.persistTabAttributeOnce();

		tab.setAttribute("collapsed", "true");
		tab.setAttribute("label", newLabel);
		tab.closing = true; // See "visibleTabs" getter in chrome://browser/content/tabbrowser.xml
		window.addEventListener("TabSelect", this, false);
		this.updateTabsVisibility();

		if("TreeStyleTabService" in window) try {
			var tst = window.TreeStyleTabService;
			var parentTab = tst.getParentTab(tab);
			if(
				parentTab
				&& !tst.getChildTabs(parentTab).filter(function(tab) {
					return !tab.closing;
				}).length
			) {
				var attr = tst.kCHILDREN;
				if(parentTab.hasAttribute(attr)) {
					parentTab.setAttribute("closedownloadtabs-backup-" + attr, parentTab.getAttribute(attr));
					parentTab.removeAttribute(attr);
					_log("Hide Tree Style Tab's twisty");
				}
			}
		}
		catch(e) {
			Components.utils.reportError(e);
		}

		_info("Hide tab" + (makeEmpty ? " (not empty)" : "") + ": " + tabLabel.substr(0, 256));
		this.dispatchAPIEvent(tab, "TabHide");
	},
	showTab: function(tab) {
		// Open in Browser extension https://addons.mozilla.org/firefox/addon/open-in-browser/ ?
		if(!tab.parentNode || !tab.linkedBrowser) {
			_info("showTab(): looks like tab already removed");
			return;
		}
		var browser = tab.linkedBrowser;
		delete browser[_cdt + "canClose"];
		this.suspendBrowser(browser, false);

		var tabLabel = tab.getAttribute("label") || "";
		var prefix = this.closedTabPrefix;
		if(tabLabel.substr(0, prefix.length) == prefix) {
			tabLabel = tabLabel.substr(prefix.length).replace(/^ /, "");
			tab.setAttribute("label", tabLabel);
		}

		tab.closing = false;
		tab.removeAttribute(this.cdt.closedAttr);
		tab.removeAttribute("collapsed");
		if(tab == this.origTab)
			this.gBrowser.selectedTab = tab;
		var window = this.window;
		window.removeEventListener("TabSelect", this, false);
		this.updateTabsVisibility();

		if("TreeStyleTabService" in window) try {
			var tst = window.TreeStyleTabService;
			var parentTab = tst.getParentTab(tab);
			if(parentTab) {
				var attr = tst.kCHILDREN;
				var bakAttr = "closedownloadtabs-backup-" + attr;
				if(parentTab.hasAttribute(bakAttr)) {
					if(!parentTab.hasAttribute(attr)) {
						parentTab.setAttribute(attr, parentTab.getAttribute(bakAttr));
						_log("Restore Tree Style Tab's twisty");
					}
					parentTab.removeAttribute(bakAttr);
				}
			}
		}
		catch(e) {
			Components.utils.reportError(e);
		}

		this.dispatchAPIEvent(tab, "TabShow");
	},
	dispatchAPIEvent: function(node, type) {
		var evt = node.ownerDocument.createEvent("Events");
		evt.initEvent("CloseDownloadTabs:" + type, true, false);
		node.dispatchEvent(evt);
	},
	updateTabsVisibility: function() {
		// See <method name="showTab"> and <method name="hideTab">
		// in chrome://browser/content/tabbrowser.xml
		var gBrowser = this.gBrowser;
		try {
			if("_visibleTabs" in gBrowser)
				gBrowser._visibleTabs = null; // invalidate cache
			if("tabContainer" in gBrowser && "adjustTabstrip" in gBrowser.tabContainer)
				gBrowser.tabContainer.adjustTabstrip();
		}
		catch(e) {
			Components.utils.reportError(e);
		}
	},
	get hasGreasemonkey() {
		var window = this.window;
		return "GM_getEnabled" in window && window.GM_getEnabled();
	}
};