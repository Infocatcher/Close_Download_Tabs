###### Description:
Extension automatically close new tabs with downloadable links. And, as a side effect, close any tabs, that still empty after opening. Specially opened empty tabs shouldn't be closed.
<br>
###### API for another extensions:
See notes about _extensions.closedownloadtabs.closeURI.pref.*_ in [defaults/preferences/prefs.js](/Infocatcher/Close_Download_Tabs/blob/master/defaults/preferences/prefs.js)
Example: [direct_links.user.js](/Infocatcher/UserScripts/blob/7dddcbb7691ec3a5290f3463c305b1eada94edf2/Direct_Links/direct_links.user.js#L70) for [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/)
<br>
###### Preferences:
See _extensions.closedownloadtabs.*_ in about:config
_extensions.closedownloadtabs.debug_:
0 – don't show debug messages in Error Console
1 – show only important messages
2 – show all messages