#### Close Download Tabs: Changelog

`+` - added<br>
`-` - deleted<br>
`x` - fixed<br>
`*` - improved<br>

##### master/HEAD
`*` Update makeTabEmpty() function for changes in bugs <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=867097">867097</a> and <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=867118">867118</a>.<br>
`x` Handle `TabOpen` event before other extensions (for compatibility with <a href="https://addons.mozilla.org/addon/tile-tabs/versions/10.0">Tile Tabs 10.0</a>) (<a href="https://github.com/Infocatcher/Close_Download_Tabs/issues/3">#3</a>).<br>
`x` Correctly detect tabs with `private:///#about:blank` as empty (<a href="https://addons.mozilla.org/addon/private-tab/">Private Tab</a>).<br>
`x` Correctly stop handling of closed tabs.<br>
`*` Increased <em>extensions.closeDownloadTabs.waitDownloadAction</em> delay from 1000 to 1500 ms.<br>
`x` Correctly detect built-in private windows in SeaMonkey 2.19+ (in case of changes in release version).<br>
`x` Fixed API for <a href="https://addons.mozilla.org/addon/greasemonkey/">Greasemonkey</a> 1.13+: now used console messages for interaction with user scripts (<a href="https://github.com/Infocatcher/Close_Download_Tabs/issues/4">#4</a>).<br>

##### 0.1.0a23 (2013-04-19)
`*` Improve extension disabling: force destroy some internal things.<br>
`x` Correctly detect built-in private windows in latest SeaMonkey 2.19a1+ (2013-03-27+) (<a href="https://github.com/Infocatcher/Close_Download_Tabs/issues/2">#2</a>).<br>
`*` Improved a way to suspend browser in hidden (and not yet closed) tab.<br>

##### 0.1.0a22 (2013-01-06)
`*` Changed preference branch: <em>extensions.closedownloadtabs.</em> -> <em>extensions.closeDownloadTabs.</em>, be careful!<br>
`x` Don't use gBrowser.hideTab()/showTab() anymore to correctly works with other extensions.<br>
`*` Restart wait process, if tab state was changed to loading.<br>
`*` Improved shutdown process: now operations with not yet loaded tabs will stops too.<br>

##### 0.1.0a21 (2012-12-11)
`*` Improved fix for asynchronous modal save dialog (<a href="https://github.com/Infocatcher/Close_Download_Tabs/issues/1">#1</a>).<br>
`x` Restored compatibility with <a href="https://addons.mozilla.org/addon/open-in-browser/">Open in Browser</a> extension.<br>
`x` Fixed removing of `unload` event listener.<br>
`+` Added `CloseDownloadTabs:TabHide` and `CloseDownloadTabs:TabShow` events (and built-in `TabHide`/`TabShow`) for other extensions.<br>

##### 0.1.0a21pre (2012-12-10)
`*` Improved hiding of <a href="https://addons.mozilla.org/addon/tree-style-tab/">Tree Style Tab</a>'s twisties.<br>
`x` Fixed compatibility with <a href="https://addons.mozilla.org/addon/flashgot/">FlashGot</a>.<br>

##### 0.1.0a20 (2012-12-09)
`+` Added hiding of <a href="https://addons.mozilla.org/addon/tree-style-tab/">Tree Style Tab</a>'s twisties.<br>
`x` Workaround for asynchronous <a href="https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFilePicker#open()">nsIFilePicker.open()</a> (<a href="https://github.com/Infocatcher/Close_Download_Tabs/issues/1">#1</a>).<br>

##### 0.1.0a20pre (2012-12-07)
`*` Published on GitHub.<br>