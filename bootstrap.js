const WINDOW_LOADED = -1;
const WINDOW_CLOSED = -2;

const LOG_PREFIX = "[Close Download Tabs] ";
var rootURI = "chrome://closedownloadtabs/content/";
var platformVersion;

if(!("Services" in this))
	Components.utils.import("resource://gre/modules/Services.jsm");

this.__defineGetter__("prefs", function() {
	delete this.prefs;
	Services.scriptloader.loadSubScript(rootURI + "prefs.js", this, "UTF-8");
	_log("Loaded prefs.js");
	return prefs;
});
this.__defineGetter__("TabHandler", function() {
	delete this.TabHandler;
	Services.scriptloader.loadSubScript(rootURI + "tabHandler.js", this, "UTF-8");
	_log("Loaded tabHandler.js");
	return TabHandler;
});

function install(params, reason) {
}
function uninstall(params, reason) {
}
function startup(params, reason) {
	platformVersion = parseFloat(Services.appinfo.platformVersion);
	if(Services.appinfo.name == "Pale Moon" || Services.appinfo.name == "Basilisk")
		platformVersion = platformVersion >= 4.1 ? 56 : 28;
	if(platformVersion >= 2 && platformVersion < 10) {
		rootURI = params && params.resourceURI
			? params.resourceURI.spec
			: new Error().fileName
				.replace(/^.* -> /, "")
				.replace(/[^\/]+$/, "");
	}
	closeDownloadTabs.init(reason);
}
function shutdown(params, reason) {
	closeDownloadTabs.destroy(reason);
	if(reason != APP_SHUTDOWN) //?
		destroyTimers();
}

var closeDownloadTabs = {
	initialized: false,
	init: function(reason) {
		if(this.initialized)
			return;
		this.initialized = true;

		this.windows.forEach(function(window) {
			this.initWindow(window, reason);
		}, this);
		Services.ww.registerNotification(this);

		if(reason != APP_STARTUP)
			prefs.init();
	},
	destroy: function(reason) {
		if(!this.initialized)
			return;
		this.initialized = false;

		this.initConsoleListener(false);
		this.windows.forEach(function(window) {
			this.destroyWindow(window, reason);
		}, this);
		Services.ww.unregisterNotification(this);

		for(var id in this._handlers) {
			_log("Destroy not yet destroyed handler #" + id);
			this._handlers[id].destroy(reason);
		}
		this._handlers = { __proto__: null };

		prefs.destroy();
	},

	observe: function(subject, topic, data) {
		if(topic == "domwindowopened")
			subject.addEventListener("DOMContentLoaded", this, false);
		else if(topic == "domwindowclosed")
			this.destroyWindow(subject, WINDOW_CLOSED);
		else if(!topic)
			this.handleConsoleMessage(subject);
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
			window.setTimeout(function() {
				prefs.init();
			}, 10);
		}
		var listen = function() {
			window.addEventListener("TabOpen", this, true);
			window.addEventListener("SSTabRestoring", this, false);
			this.initConsoleListener(true);
		}.bind(this);
		if("gBrowserInit" in window && !window.gBrowserInit.delayedStartupFinished) {
			Services.obs.addObserver(function init(subject, topic) {
				Services.obs.removeObserver(init, topic);
				window.setTimeout(listen, 0);
			}, "browser-delayed-startup-finished", false);
		}
		else {
			window.setTimeout(listen, reason == WINDOW_LOADED ? 200 : 0);
		}
	},
	destroyWindow: function(window, reason) {
		window.removeEventListener("DOMContentLoaded", this, false); // Window can be closed before DOMContentLoaded
		if(reason == WINDOW_CLOSED && !this.isTargetWindow(window))
			return;
		window.removeEventListener("TabOpen", this, true);
		window.removeEventListener("SSTabRestoring", this, false);
	},
	get isSeaMonkey() {
		delete this.isSeaMonkey;
		return this.isSeaMonkey = Services.appinfo.name == "SeaMonkey";
	},
	get windows() {
		var windows = [];
		var isSeaMonkey = this.isSeaMonkey;
		var ws = Services.wm.getEnumerator(isSeaMonkey ? null : "navigator:browser");
		while(ws.hasMoreElements()) {
			var window = ws.getNext();
			if(!isSeaMonkey || this.isTargetWindow(window))
				windows.push(window);
		}
		return windows;
	},
	isTargetWindow: function(window) {
		// Note: we don't have "windowtype" attribute for private windows in SeaMonkey 2.19+
		var loc = window.location.href;
		return loc == "chrome://browser/content/browser.xul"
			|| loc == "chrome://navigator/content/navigator.xul";
	},

	_handlerId: -1,
	_handlers: { __proto__: null },
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

	consoleMessage: LOG_PREFIX + "Mark URI as empty:\n",
	_hasConsoleListener: false,
	initConsoleListener: function(add) {
		if(add == this._hasConsoleListener)
			return;
		this._hasConsoleListener = add;
		if(add)
			Services.console.registerListener(this);
		else
			Services.console.unregisterListener(this);
	},
	handleConsoleMessage: function(msg) {
		if(
			msg
			&& msg instanceof Components.interfaces.nsIConsoleMessage
			&& !(msg instanceof Components.interfaces.nsIScriptError)
		) {
			var msgText = msg.message || "";
			var pos = msgText.indexOf(this.consoleMessage);
			if(pos != -1) {
				var uri = msgText.substr(pos + this.consoleMessage.length);
				this.addKey(uri);
				timer(function() { _log("[API] URI marked as empty:\n" + uri); });
			}
		}
	},
	_keys: { __proto__: null },
	addKey: function(key) {
		if(!key)
			return;
		var keys = this._keys;
		if(key in keys)
			cancelTimer(keys[key]);
		keys[key] = timer(function() {
			delete keys[key];
			_log("[API] URI expired:\n" + key);
		}, this, prefs.get("closeURI.expire", 10e3));
	},
	hasKey: function(key) {
		return key in this._keys;
	},

	closedAttr: "closedownloadtabs-closed",
	get ss() {
		delete this.ss;
		return this.ss = "nsISessionStore" in Components.interfaces
			? (
				Components.classes["@mozilla.org/browser/sessionstore;1"]
				|| Components.classes["@mozilla.org/suite/sessionstore;1"]
			).getService(Components.interfaces.nsISessionStore)
			// Firefox 61+ https://bugzilla.mozilla.org/show_bug.cgi?id=1450559
			: Components.utils.import("resource:///modules/sessionstore/SessionStore.jsm", {}).SessionStore;
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

var _timers = { __proto__: null };
var _timersCounter = 0;
function timer(callback, context, delay, args) {
	var Timer = timer._Timer || (timer._Timer = Components.Constructor("@mozilla.org/timer;1", "nsITimer"));
	var id = ++_timersCounter;
	var tmr = _timers[id] = new Timer();
	tmr.init({
		observe: function(subject, topic, data) {
			delete _timers[id];
			callback.apply(context, args);
		}
	}, delay || 0, tmr.TYPE_ONE_SHOT);
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
	return d.toTimeString().replace(/^.*\d+:(\d+:\d+).*$/, "$1") + ":" + "000".substr(("" + ms).length) + ms + " ";
}
function _info(s) {
	Services.console.logStringMessage(LOG_PREFIX + ts() + s);
}
function _log(s) {
	prefs.get("debug") && _info(s);
}
function _dump(s) {
	prefs.get("debug") && dump(s + "\n");
}