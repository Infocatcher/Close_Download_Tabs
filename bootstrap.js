const WINDOW_LOADED = -1;
const WINDOW_CLOSED = -2;

const LOG_PREFIX = "[Close Download Tabs] ";
var rootURI = "chrome://closedownloadtabs/content/";
var platformVersion;

if(!("Services" in this))
	Components.utils.import("resource://gre/modules/Services.jsm");

this.__defineGetter__("TabHandler", function() {
	_log("Load tabHandler.js");
	delete this.TabHandler;
	Services.scriptloader.loadSubScript(rootURI + "tabHandler.js", this, "UTF-8");
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
			prefs.delayedInit();
		}
		window.addEventListener("TabOpen", this, true);
		window.addEventListener("SSTabRestoring", this, false);
		window.setTimeout(function() {
			this.initConsoleListener(true);
		}.bind(this), 0);
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
			_log("URI expired:\n" + key);
		}, this, prefs.get("closeURI.expire", 10e3));
	},
	hasKey: function(key) {
		return key in this._keys;
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

var prefs = {
	ns: "extensions.closeDownloadTabs.",
	initialized: false,
	init: function() {
		if(this.initialized)
			return;
		this.initialized = true;

		//~ todo: add new condition when https://bugzilla.mozilla.org/show_bug.cgi?id=564675 will be fixed
		if(platformVersion >= 2)
			this.loadDefaultPrefs();
		Services.prefs.addObserver(this.ns, this, false);
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
	},

	observe: function(subject, topic, pName) {
		if(topic != "nsPref:changed")
			return;
		var pVal = this.getPref(pName);
		var shortName = pName.substr(this.ns.length);
		this._cache[shortName] = pVal;
	},

	loadDefaultPrefs: function() {
		this._cache = { __proto__: null }; // We use delayedInit(), so prefs.get() may save wrong value in cache
		var defaultBranch = Services.prefs.getDefaultBranch("");
		var prefsFile = rootURI + "defaults/preferences/prefs.js";
		var prefs = this;
		Services.scriptloader.loadSubScript(prefsFile, {
			pref: function(pName, val) {
				var pType = defaultBranch.getPrefType(pName);
				if(pType != defaultBranch.PREF_INVALID && pType != prefs.getValueType(val)) {
					Components.utils.reportError(
						LOG_PREFIX + 'Changed preference type for "' + pName
						+ '", old value will be lost!'
					);
					defaultBranch.deleteBranch(pName);
				}
				prefs.setPref(pName, val, defaultBranch);
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
			case ps.PREF_BOOL:   return ps.getBoolPref(pName);
			case ps.PREF_INT:    return ps.getIntPref(pName);
			case ps.PREF_STRING: return ps.getComplexValue(pName, Components.interfaces.nsISupportsString).data;
		}
		return defaultVal;
	},
	setPref: function(pName, val, prefBranch) {
		var ps = prefBranch || Services.prefs;
		var pType = ps.getPrefType(pName);
		if(pType == ps.PREF_INVALID)
			pType = this.getValueType(val);
		switch(pType) {
			case ps.PREF_BOOL:   ps.setBoolPref(pName, val); break;
			case ps.PREF_INT:    ps.setIntPref(pName, val);  break;
			case ps.PREF_STRING:
				var ss = Components.interfaces.nsISupportsString;
				var str = Components.classes["@mozilla.org/supports-string;1"]
					.createInstance(ss);
				str.data = val;
				ps.setComplexValue(pName, ss, str);
		}
		return this;
	},
	getValueType: function(val) {
		switch(typeof val) {
			case "boolean": return Services.prefs.PREF_BOOL;
			case "number":  return Services.prefs.PREF_INT;
		}
		return Services.prefs.PREF_STRING;
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