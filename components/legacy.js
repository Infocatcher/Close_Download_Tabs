// Bootstrapped extensions loader for Gecko < 2.0
// Note: supported only APP_STARTUP and APP_SHUTDOWN notifications!

const C_ID = Components.ID("{a6e9caf9-adc8-4c09-b933-70ce2a5e2116}"),
      C_CONTRACT_ID = "@closeDownloadTabs/legacyLoader;1",
      C_NAME = "Close Download Tabs legacy loader";

// resource://gre/modules/Services.jsm
const Services = {
	get console() {
		delete this.console;
		return this.console = Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService);
	},
	get wm() {
		delete this.wm;
		return this.wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
	},
	get ww() {
		delete this.ww;
		return this.ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Components.interfaces.nsIWindowWatcher);
	},
	get appinfo() {
		delete this.appinfo;
		return this.appinfo = Components.classes["@mozilla.org/xre/app-info;1"]
           .getService(Components.interfaces.nsIXULAppInfo)
           .QueryInterface(Components.interfaces.nsIXULRuntime);
	},
	get prefs() {
		delete this.prefs;
		return this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
           .getService(Components.interfaces.nsIPrefService)
           .QueryInterface(Components.interfaces.nsIPrefBranch2);
	},
	get scriptloader() {
		delete this.scriptloader;
		return this.scriptloader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Components.interfaces.mozIJSSubScriptLoader);
	},
	get obs() {
		delete this.obs;
		return this.obs = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
	}
};

// Based on https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind#Compatibility
if(!Function.prototype.bind) {
	Function.prototype.bind = function(oThis) {
		if(typeof this !== "function") {
			// closest thing possible to the ECMAScript 5 internal IsCallable function
			throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
		}
		var aArgs = Array.slice(arguments, 1),
			fToBind = this,
			fNOP = function() {},
			fBound = function() {
				return fToBind.apply(
					this instanceof fNOP && oThis
						? this
						: oThis,
					aArgs.concat(Array.slice(arguments))
				);
			};
		fNOP.prototype = this.prototype;
		fBound.prototype = new fNOP();
		return fBound;
	};
}

// https://developer.mozilla.org/en/Extensions/Bootstrapped_extensions#Reason_constants
const APP_STARTUP     = 1;
const APP_SHUTDOWN    = 2;
const ADDON_ENABLE    = 3;
const ADDON_DISABLE   = 4;
const ADDON_INSTALL   = 5;
const ADDON_UNINSTALL = 6;
const ADDON_UPGRADE   = 7;
const ADDON_DOWNGRADE = 8;

const legacyLoader = {
	startup: function() {
		// Preferences may be not yet loaded, wait
		Services.obs.addObserver(this, "profile-after-change", false);
	},
	init: function() {
		Services.obs.removeObserver(this, "profile-after-change");
		Services.obs.addObserver(this, "quit-application-granted", false);
		var file = new Error().fileName.replace(/(?:\/+[^\/]+){2}$/, "") + "/bootstrap.js";
		Services.scriptloader.loadSubScript(file);
		startup(null, APP_STARTUP);
	},
	destroy: function() {
		Services.obs.removeObserver(this, "quit-application-granted");
		shutdown(null, APP_SHUTDOWN);
	},
	observe: function(subject, topic, data) {
		if(topic == "profile-after-change")
			this.init();
		else if(topic == "quit-application-granted")
			this.destroy();
	}
};

const factory = {
	// nsIFactory interface implementation
	createInstance: function(outer, iid) {
		if(outer != null)
			throw Components.results.NS_ERROR_NO_AGGREGATION;
		return this;
	},
	lockFactory: function(lock) {
		throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
	},
	// nsIObserver interface implementation
	observe: function(subject, topic, data) {
		if(topic == "app-startup")
			legacyLoader.startup();
	},
	// nsISupports interface implementation
	QueryInterface: function(iid) {
		if(
			iid.equals(Components.interfaces.nsISupports)
			|| iid.equals(Components.interfaces.nsIFactory)
			|| iid.equals(Components.interfaces.nsIObserver)
		)
			return this;
		throw Components.results.NS_ERROR_NO_INTERFACE;
	}
};
const module = {
	get catMan() {
		return Components.classes["@mozilla.org/categorymanager;1"]
			.getService(Components.interfaces.nsICategoryManager);
	},
	// nsIModule interface implementation
	registerSelf: function(compMgr, fileSpec, location, type) {
		compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar)
			.registerFactoryLocation(C_ID, C_NAME, C_CONTRACT_ID, fileSpec, location, type);
		this.catMan.addCategoryEntry("app-startup", C_NAME, "service," + C_CONTRACT_ID, true, true);
	},
	unregisterSelf: function(compMgr, fileSpec, location) {
		compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar)
			.unregisterFactoryLocation(C_ID, fileSpec);
		this.catMan.deleteCategoryEntry("app-startup", "service," + C_CONTRACT_ID, true);
	},
	getClassObject: function(compMgr, cid, iid) {
		if(!cid.equals(C_ID))
			throw Components.results.NS_ERROR_NO_INTERFACE;
		if(!iid.equals(Components.interfaces.nsIFactory))
			throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
		return factory;
	},
	canUnload: function(compMgr) {
		return true;
	}
};
function NSGetModule(comMgr, fileSpec) {
	return module;
}