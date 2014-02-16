#### Close Download Tabs: История изменений

`+` - добавлено<br>
`-` - удалено<br>
`x` - исправлено<br>
`*` - улучшено<br>

##### master/HEAD
`*` Обновлена функция makeTabEmpty() с учетом изменений в багах <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=867097">867097</a> и <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=867118">867118</a>.<br>
`x` Обработка события `TabOpen` делается до других расширений (для совместимости с <a href="https://addons.mozilla.org/addon/tile-tabs/versions/10.0">Tile Tabs 10.0</a>) (<a href="https://github.com/Infocatcher/Close_Download_Tabs/issues/3">#3</a>).<br>
`x` Добавлено корректное определение вкладок с `private:///#about:blank` как пустых (<a href="https://addons.mozilla.org/addon/private-tab/">Private Tab</a>).<br>
`x` Откорректировано прекращение обработки закрытых вкладок.<br>
`*` Увеличена задержка <em>extensions.closeDownloadTabs.waitDownloadAction</em> с 1000 до 1500 мс.<br>
`x` Исправлено определение встроенных приватных окон в SeaMonkey 2.19+ (по причине изменений в релизной версии).<br>
`x` Исправлен API для <a href="https://addons.mozilla.org/addon/greasemonkey/">Greasemonkey</a> 1.13+: теперь используются консольные сообщения для взаимодействия с пользовательскими скриптами (<a href="https://github.com/Infocatcher/Close_Download_Tabs/issues/4">#4</a>).<br>
`*` Увеличена задержка <em>extensions.closeDownloadTabs.waitDownload</em> с 2000 до 2500 мс (может понадобиться, как минимум, для расширения <a href="https://addons.mozilla.org/addon/flashgot/">FlashGot</a>).<br>

##### 0.1.0a23 (2013-04-19)
`*` Улучшено отключение расширение: добавлено принудительное завершение некоторых внутренних процессов.<br>
`x` Исправлено определение встроенных приватных окон в разрабатываемой SeaMonkey 2.19a1+ (2013-03-27+) (<a href="https://github.com/Infocatcher/Close_Download_Tabs/issues/2">#2</a>).<br>
`*` Улучшен способ приостановки браузера в скрытой (но еще не закрытой) вкладке.<br>

##### 0.1.0a22 (2013-01-06)
`*` Изменена ветка настроек: <em>extensions.closedownloadtabs.</em> -> <em>extensions.closeDownloadTabs.</em>, будьте внимательны!<br>
`x` Удалено использование gBrowser.hideTab()/showTab() для корректной работы с другими расширениями.<br>
`*` Добавлен перезапуск ожидания, если состояние вкладки меняется на загрузку.<br>
`*` Улучшен процесс выключения: теперь операции с еще не загруженными вкладками также прекращаются.<br>

##### 0.1.0a21 (2012-12-11)
`*` Улучшено исправление для асинхронного диалога сохранения (<a href="https://github.com/Infocatcher/Close_Download_Tabs/issues/1">#1</a>).<br>
`x` Восстановлена совместимость с расширением <a href="https://addons.mozilla.org/addon/open-in-browser/">Open in Browser</a>.<br>
`x` Исправлено удаление слушателя события `unload`.<br>
`+` Добавлены события `CloseDownloadTabs:TabHide` и `CloseDownloadTabs:TabShow` (а также встроенные `TabHide`/`TabShow`) для других расширений.<br>

##### 0.1.0a21pre (2012-12-10)
`*` Улучшена обработка индикаторов сворачивания в <a href="https://addons.mozilla.org/addon/tree-style-tab/">Tree Style Tab</a>.<br>
`x` Исправлена совместимость с <a href="https://addons.mozilla.org/addon/flashgot/">FlashGot</a>.<br>

##### 0.1.0a20 (2012-12-09)
`+` Добавлено скрытие индикаторов сворачивания в <a href="https://addons.mozilla.org/addon/tree-style-tab/">Tree Style Tab</a>.<br>
`x` Workaround для асинхронного <a href="https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFilePicker#open()">nsIFilePicker.open()</a> (<a href="https://github.com/Infocatcher/Close_Download_Tabs/issues/1">#1</a>).<br>

##### 0.1.0a20pre (2012-12-07)
`*` Опубликовано на GitHub.<br>