const WINDOW_LOADED = -1;
const WINDOW_CLOSED = -2;

const LOG_PREFIX = "[Close Download Tabs] ";
var rootURI;

if(!("Services" in this))
	Components.utils.import("resource://gre/modules/Services.jsm");

function install(params, reason) {
}
function uninstall(params, reason) {
}
function startup(params, reason) {
	rootURI = params && params.resourceURI
		? params.resourceURI.spec
		: new Error().fileName
			.replace(/^.* -> /, "")
			.replace(/[^\/]+$/, "");

	//if(Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0)
	//	Components.manager.addBootstrappedManifestLocation(params.installPath);

	windowsObserver.init(reason);
}
function shutdown(params, reason) {
	//if(Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0)
	//	Components.manager.removeBootstrappedManifestLocation(params.installPath);

	windowsObserver.destroy(reason);
	if(reason != APP_SHUTDOWN) //?
		destroyTimers();
}

var windowsObserver = {
	initialized: false,
	init: function(reason) {
		if(this.initialized)
			return;
		this.initialized = true;

		var ws = Services.wm.getEnumerator("navigator:browser");
		while(ws.hasMoreElements())
			this.initWindow(ws.getNext(), reason);

		Services.ww.registerNotification(this);
		if(reason != APP_STARTUP)
			prefs.init();
	},
	destroy: function(reason) {
		if(!this.initialized)
			return;
		this.initialized = false;

		var ws = Services.wm.getEnumerator("navigator:browser");
		while(ws.hasMoreElements())
			this.destroyWindow(ws.getNext(), reason);

		Services.ww.unregisterNotification(this);
		prefs.destroy();
	},

	observe: function(subject, topic, data) {
		if(topic == "domwindowopened")
			subject.addEventListener("DOMContentLoaded", this, false);
		else if(topic == "domwindowclosed")
			this.destroyWindow(subject, WINDOW_CLOSED);
	},

	handleEvent: function(e) {
		switch(e.type) {
			case "DOMContentLoaded": this.loadHandler(e);         break;
			case "TabOpen":          this.tabOpenHandler(e);      break;
			case "SSTabRestoring":   this.tabRestoringHandler(e);
		}
	},
	loadHandler: function(e) {
		var window = e.originalTarget.defaultView;
		window.removeEventListener("DOMContentLoaded", this, false);
		this.initWindow(window, WINDOW_LOADED);
	},

	initWindow: function(window, reason) {
		if(reason == WINDOW_LOADED) {
			if(!this.isTargetWindow(window))
				return;
			prefs.delayedInit();
		}
		window.addEventListener("TabOpen", this, false);
		window.addEventListener("SSTabRestoring", this, false);
	},
	destroyWindow: function(window, reason) {
		window.removeEventListener("DOMContentLoaded", this, false); // Window can be closed before DOMContentLoaded
		if(reason == WINDOW_CLOSED && !this.isTargetWindow(window))
			return;
		window.removeEventListener("TabOpen", this, false);
		window.removeEventListener("SSTabRestoring", this, false);
	},
	isTargetWindow: function(window) {
		return window.document.documentElement.getAttribute("windowtype") == "navigator:browser";
	},

	tabOpenHandler: function(e) {
		var tab = e.originalTarget || e.target;
		new TabHandler(tab);
	},
	tabRestoringHandler: function(e) {
		var tab = e.originalTarget || e.target;
		if(tab.hasAttribute(this.closedAttr)) {
			_log("Hack: remove closed tab");
			tab.ownerDocument.defaultView.gBrowser.removeTab(tab);
		}
	},

	closedAttr: "closedownloadtabs-closed",
	get ss() {
		delete this.ss;
		return this.ss = (
			Components.classes["@mozilla.org/browser/sessionstore;1"]
			|| Components.classes["@mozilla.org/suite/sessionstore;1"]
		).getService(Components.interfaces.nsISessionStore);
	},
	persistTabAttributeOnce: function() {
		this.persistTabAttributeOnce = function() {};
		this.ss.persistTabAttribute(this.closedAttr);
	},

	get hasAsyncFilePicker() {
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(Components.interfaces.nsIFilePicker);
		delete this.hasAsyncFilePicker;
		return this.hasAsyncFilePicker = "open" in fp;
	}
};

function TabHandler(tab) {
	this.tab = tab;
	var window = this.window = tab.ownerDocument.defaultView;
	var gBrowser = this.gBrowser = window.gBrowser;
	this.prevTab = gBrowser.selectedTab;
	this.browser = tab.linkedBrowser;
	this.check() && this.init();
}
TabHandler.prototype = {
	origTab: null,
	_stop: false,
	_hasProgressListener: false,
	_waitedLoad: false,
	_waitTimer: 0,
	_stopCloseWait: 0,

	check: function() {
		// See "addTab" method in chrome://browser/content/tabbrowser.xml
		var tabLabel = this.tab.getAttribute("label") || "";
		_log("Opened new tab: " + tabLabel.substr(0, 256));
		if(!tabLabel || tabLabel == "undefined" || tabLabel == "about:blank")
			return false;
		if(!/^\w+:\S*$/.test(tabLabel)) { // We should check tab label for SeaMonkey and old Firefox
			if(tabLabel == (this.getString("tabs.emptyTabTitle") || this.getString("tabs.untitled"))) {
				_log("Opened tab are empty, ignore");
				return false;
			}
		}
		return true;
	},
	init: function() {
		this._maxLoadingWait     = prefs.get("maxLoadingWait",             2.5*60e3);
		this._waitInterval       = prefs.get("waitInterval",               500);
		this._waitLoaded         = prefs.get("waitLoadedTab",              80);
		this._waitLoadedGM       = prefs.get("waitLoadedTab.greasemonkey", 1000);
		this._waitStopProgress   = prefs.get("waitAfterStopProgress",      10);
		this._waitDownload       = prefs.get("waitDownload",               2000);
		this._waitDownloadAction = prefs.get("waitDownloadAction",         1000);
		this._stopWait = Date.now() + this._maxLoadingWait;

		this.wait();
		this.browser.addProgressListener(this);
		this._hasProgressListener = true;
		//_log("TabHandler.addProgressListener()");
	},
	destroy: function() {
		this.window.removeEventListener("TabSelect", this, false);
		this.destroyProgress();
		this.window = this.tab = this.prevTab = this.gBrowser = this.browser = null;
		_log("TabHandler.destroy()");
	},
	destroyProgress: function() {
		if(this._hasProgressListener) {
			this._hasProgressListener = false;
			this.browser.removeProgressListener(this);
			_log("TabHandler.removeProgressListener()");
		}
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "TabSelect": this.dontSelectHiddenTab(e); break;
			case "unload":    this.closeTab(e);
		}
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
			// Built-in extensions installation mechanism use tab depended notifications,
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
	waitProceed: function() {
		switch(this.waitCheck()) {
			case 1: this.destroyProgress(); break;
			case 2: this.destroy();
		}
	},
	waitCheck: function() {
		var tab = this.tab;
		if(!tab.parentNode || !tab.linkedBrowser) // Tab closed
			return 2;

		var browser = this.browser;
		var window = this.window;
		if(this.isLoading(browser)) {
			if(Date.now() < this._stopWait) {
				this.wait();
				return 0;
			}
			return 2;
		}
		if(browser.currentURI.spec == "about:blank") {
			if(!this._waitedLoad) {
				this._waitedLoad = true;
				var delay = (tab.getAttribute("label") || "").substr(-8) == ".user.js" && this.hasGreasemonkey
					? this._waitLoadedGM
					: this._waitLoaded;
				this.wait(delay);
				_log("Wait loaded tab: " + delay + "ms");
				return 0;
			}
		}
		else {
			var canClose = this.canClose(browser);
			if(!canClose) {
				_log("Opened regular tab, ignore");
				return 2;
			}
		}
		if(this._stop) {
			_log("Stop flag, ignore");
			return 2;
		}

		var gBrowser = this.gBrowser;
		if("getNotificationBox" in gBrowser) {
			var nb = gBrowser.getNotificationBox(browser);
			if(nb && nb.currentNotification) {
				_info("Found notification in <notificationbox>, ignore tab");
				return 2;
			}
		}
		if(
			"PopupNotifications" in window // resource://gre/modules/PopupNotifications.jsm
			&& "_getNotificationsForBrowser" in window.PopupNotifications
		) {
			var ns = window.PopupNotifications._getNotificationsForBrowser(browser);
			if(ns && ns.length) {
				_info("Found doorhanger notification, ignore tab");
				return 2;
			}
		}
		if(this.hasSingleTab(gBrowser)) {
			_log("Don't hide last tab");
			return 2;
		}

		if(gBrowser.selectedTab == tab) {
			if(!prefs.get("closeSelectedTab", true))
				return 2;
			this.unSelectTab();
		}

		// We can't save file w/o tab :(
		// And Panorama still show this tab
		this.hideTab(tab, canClose);

		window.addEventListener("unload", this, false); //~ todo: tab closed, but can be restored :(
		window.setTimeout(this.delayedClose.bind(this), this._waitDownload);
		return 1;
	},
	makeTabEmpty: function(tab) {
		// Empty tabs aren't saved in undo close history
		// Based on code from Multiple Tab Handler extension
		// https://addons.mozilla.org/firefox/addon/multiple-tab-handler/
		// chrome://multipletab/content/multipletab.js -> makeTabBlank()
		try {
			var browser = tab.linkedBrowser;
			if("docShell" in browser) {
				// Force forbid any redirects
				var ds = browser.docShell;
				ds.allowJavascript = ds.allowMetaRedirects = false;
			}
			browser.loadURI("about:blank");
			var sh = browser.sessionHistory;
			if(sh instanceof Components.interfaces.nsISHistory)
				sh.PurgeHistory(sh.count);
			delete tab.__SS_extdata;
			delete browser.__SS_data;
			delete browser.__SS_formDataSaved;
			delete browser.__SS_hostSchemeData;
			_log("Make tab empty " + (tab.getAttribute("label") || "").substr(0, 256));
		}
		catch(e) {
			Components.utils.reportError(LOG_PREFIX + "Can't make tab empty");
			Components.utils.reportError(e);
		}
	},
	isLoading: function(browser) {
		return !browser.currentURI
			|| !browser.webProgress
			|| browser.webProgress.isLoadingDocument;
	},
	canClose: function(browser) {
		return browser.contentDocument && prefs.hasKey(browser.contentDocument.documentURI);
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
				return content == this.browser.contentWindow;
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
	unSelectTab: function() {
		var tab = this.tab;
		var gBrowser = this.gBrowser;

		var selectedTab = gBrowser.selectedTab;
		if(selectedTab != tab)
			return;
		var prevTab = this.prevTab;
		if(prevTab == selectedTab || !this.tabVisible(prevTab))
			prevTab = this.getNearestTab(tab);
		if(prevTab) {
			this.origTab = tab;
			gBrowser.selectedTab = prevTab;
		}
	},
	dontSelectHiddenTab: function(e) {
		var tab = this.tab;
		if(e.target != tab || !tab.closing)
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
		var bo = tab.boxObject;
		return bo.width > 0 && bo.height > 0 && !tab.closing;
	},
	hasSingleTab: function(gBrowser) {
		var tabs = gBrowser.visibleTabs || gBrowser.tabs || gBrowser.tabContainer.childNodes;
		return tabs.length <= 1;
	},
	get fixedCloseTab() {
		return setProperty(this, "fixedCloseTab", this.closeTab.bind(this));
	},
	closeTab: function(e) {
		var checkModalInterval = prefs.get("checkModalInterval", 1500);
		if(e || !windowsObserver.hasAsyncFilePicker || checkModalInterval < 0) {
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

		function checkModal() {
			_log("checkModal()...");
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
			window.clearInterval(checkModalTimer);
			window.removeEventListener(e.type, checkNotModal, true);
			box.parentNode.removeChild(box);
			_this._closeTab();
		}
		window.addEventListener("focus", checkNotModal, true);
		var checkModalTimer = window.setInterval(checkModal, checkModalInterval);
		_log("checkModal()");
		checkModal();
	},
	_closeTab: function(e) {
		var window = this.window;
		e && window.removeEventListener("unload", this, false);

		var tab = this.tab;
		if(!tab.parentNode) { // Already closed
			_log("Tab already closed => destroy()");
			this.destroy();
			return;
		}

		var gBrowser = this.gBrowser;
		var browser = this.browser;

		if(this.isLoading(browser)) {
			var now = Date.now();
			if(!this._stopCloseWait) {
				this._stopCloseWait = now + this._maxLoadingWait;
				_info('Tab state was changed to "loading" => show tab');
				this.showTab(tab);
			}
			if(now < this._stopCloseWait) {
				window.setTimeout(this.fixedCloseTab, this._waitInterval);
				return;
			}
		}

		if(browser.currentURI.spec == "about:blank" || this.canClose(browser)) {
			tab.closing = false;
			if(!this.hasSingleTab(gBrowser)) try {
				gBrowser.removeTab(tab, { animate: false });
				_log("Close tab");
			}
			catch(e) {
				Components.utils.reportError(e);
			}
		}
		else if(tab.closing) {
			_info("Tab aren't empty anymore => show it");
			this.showTab(tab);
		}
		this.destroy();
	},
	hideTab: function(tab, makeEmpty) {
		var window = this.window;
		var tabLabel = tab.getAttribute("label") || "";
		var newLabel = "[Closed by Close Download Tabs]" + (tabLabel ? " " + tabLabel : "");

		// We can't undo close tab, so try make it empty (empty tabs aren't saved!)
		if(makeEmpty) {
			window.setTimeout(function() {
				tab.setAttribute("label", newLabel);
			}, 100);
			this.makeTabEmpty(tab);
		}

		tab.setAttribute(windowsObserver.closedAttr, "true");
		windowsObserver.persistTabAttributeOnce();
		tab.setAttribute("collapsed", "true");
		tab.setAttribute("label", newLabel);
		tab.closing = true; // See "visibleTabs" getter in chrome://browser/content/tabbrowser.xml

		window.addEventListener("TabSelect", this, false);
		if("TreeStyleTabService" in window) {
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
		_info("Hide tab" + (makeEmpty ? " (not empty)" : "") + ": " + tabLabel.substr(0, 256));
	},
	showTab: function(tab) {
		// Open in Browser extension https://addons.mozilla.org/firefox/addon/open-in-browser/ ?
		tab.closing = false;
		tab.removeAttribute(windowsObserver.closedAttr);
		tab.removeAttribute("collapsed");
		if(tab == this.origTab)
			this.gBrowser.selectedTab = tab;

		var window = this.window;
		if("TreeStyleTabService" in window) {
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
	},
	getString: function(id) {
		try {
			return this.gBrowser.mStringBundle.getString(id);
		}
		catch(e) {
		}
		return undefined;
	},
	get hasGreasemonkey() {
		var window = this.window;
		return "GM_getEnabled" in window && window.GM_getEnabled();
	}
};

var prefs = {
	ns: "extensions.closedownloadtabs.",
	initialized: false,
	init: function() {
		if(this.initialized)
			return;
		this.initialized = true;

		//~ todo: add new condition when https://bugzilla.mozilla.org/show_bug.cgi?id=564675 will be fixed
		if(Services.vc.compare(Services.appinfo.platformVersion, "4.0a1") >= 0)
			this.loadDefaultPrefs();
		Services.prefs.addObserver(this.ns, this, false);
		this.watchKeys();
	},
	delayedInit: function() {
		if(!this.initialized)
			timer(this.init, this, 10);
	},
	destroy: function() {
		if(!this.initialized)
			return;
		this.initialized = false;

		Services.prefs.removeObserver(this.ns, this);
		this.unwatchKeys();
	},
	_keys: { __proto__: null },
	_keyPrefs: [],
	watchKeys: function() {
		var branch = "closeURI.pref.";
		var keys = this._keyPrefs = Services.prefs.getBranch(this.ns + branch)
			.getChildList("", {})
			.filter(function(pName) {
				return this.get(branch + pName);
			}, this);
		keys.forEach(function(pName) {
			//_log('Add prefs observer for "' + pName + '"');
			Services.prefs.addObserver(pName, this, false);
		}, this);
	},
	unwatchKeys: function() {
		this._keyPrefs.forEach(function(pName) {
			//_log('Remove prefs observer for "' + pName + '"');
			Services.prefs.removeObserver(pName, this);
		}, this);
	},
	addKey: function(key, _source) {
		if(!key)
			return;
		_log("Mark tab as empty:\nPref: " + _source + "\nURI: " + key);
		var keys = this._keys;
		if(key in keys)
			cancelTimer(keys[key]);
		keys[key] = timer(function() {
			delete keys[key];
			_log("URI expired:\nPref: " + _source + "\nURI: " + key);
		}, this, this.get("closeURI.expire", 10e3));
	},
	hasKey: function(key) {
		return key in this._keys;
	},
	observe: function(subject, topic, pName) {
		if(topic != "nsPref:changed")
			return;
		var pVal = this.getPref(pName);
		if(this._keyPrefs.indexOf(pName) != -1) {
			this.addKey(pVal, pName);
			return;
		}
		var shortName = pName.substr(this.ns.length);
		this._cache[shortName] = pVal;
		if(shortName.substr(0, 14) == "closeURI.pref.") {
			this.unwatchKeys();
			this.watchKeys();
		}
	},

	loadDefaultPrefs: function() {
		var defaultBranch = Services.prefs.getDefaultBranch("");
		var prefsFile = rootURI + "defaults/preferences/prefs.js";
		Services.scriptloader.loadSubScript(prefsFile, {
			prefs: this,
			pref: function(pName, val) {
				this.prefs.setPref(pName, val, defaultBranch);
			}
		});
	},

	_cache: { __proto__: null },
	get: function(pName, defaultVal) {
		var cache = this._cache;
		return pName in cache
			? cache[pName]
			: (cache[pName] = this.getPref(this.ns + pName, defaultVal));
	},
	set: function(pName, val) {
		return this.setPref(this.ns + pName, val);
	},
	getPref: function(pName, defaultVal, prefBranch) {
		var ps = prefBranch || Services.prefs;
		switch(ps.getPrefType(pName)) {
			case ps.PREF_STRING: return ps.getComplexValue(pName, Components.interfaces.nsISupportsString).data;
			case ps.PREF_INT:    return ps.getIntPref(pName);
			case ps.PREF_BOOL:   return ps.getBoolPref(pName);
			default:             return defaultVal;
		}
	},
	setPref: function(pName, val, prefBranch) {
		var ps = prefBranch || Services.prefs;
		var pType = ps.getPrefType(pName);
		var isNew = pType == ps.PREF_INVALID;
		var vType = typeof val;
		if(pType == ps.PREF_BOOL || isNew && vType == "boolean")
			ps.setBoolPref(pName, val);
		else if(pType == ps.PREF_INT || isNew && vType == "number")
			ps.setIntPref(pName, val);
		else if(pType == ps.PREF_STRING || isNew) {
			var ss = Components.interfaces.nsISupportsString;
			var str = Components.classes["@mozilla.org/supports-string;1"]
				.createInstance(ss);
			str.data = val;
			ps.setComplexValue(pName, ss, str);
		}
		return this;
	},
	resetPref: function(pName) {
		var ps = Services.prefs;
		if(ps.prefHasUserValue(pName))
			ps.clearUserPref(pName);
	}
};

var _timers = { __proto__: null };
var _timersCounter = 0;
function timer(callback, context, delay, args) {
	var id = ++_timersCounter;
	var timer = _timers[id] = Components.classes["@mozilla.org/timer;1"]
		.createInstance(Components.interfaces.nsITimer);
	timer.init({
		observe: function(subject, topic, data) {
			delete _timers[id];
			callback.apply(context, args);
		}
	}, delay || 0, timer.TYPE_ONE_SHOT);
	return id;
}
function cancelTimer(id) {
	if(id in _timers) {
		_timers[id].cancel();
		delete _timers[id];
	}
}
function destroyTimers() {
	for(var id in _timers)
		_timers[id].cancel();
	_timers = { __proto__: null };
	_timersCounter = 0;
}

function setProperty(o, p, v) {
	setProperty = "defineProperty" in Object
		? function(o, p, v) {
			Object.defineProperty(o, p, {
				value: v,
				enumerable: true,
				writable: true
			});
			return v;
		}
		: function(o, p, v) {
			o.__defineGetter__(p, function() {
				return v;
			});
			return v;
		};
	return setProperty.apply(this, arguments);
}

// Be careful, loggers always works until prefs aren't initialized
// (and if "debug" preference has default value)
function ts() {
	var d = new Date();
	var ms = d.getMilliseconds();
	return d.toLocaleFormat("%M:%S:") + "000".substr(String(ms).length) + ms + " ";
}
function _info(s) {
	if(prefs.get("debug", 2) > 0)
		Services.console.logStringMessage(LOG_PREFIX + ts() + s);
}
function _log(s) {
	if(prefs.get("debug", 2) > 1)
		Services.console.logStringMessage(LOG_PREFIX + ts() + s);
}
function _dump(s) {
	if(prefs.get("debug", 2) > 0)
		dump(LOG_PREFIX + ts() + s + "\n");
}