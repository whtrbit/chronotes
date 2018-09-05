chrome.runtime.onConnect.addListener(function (port) {
    chrome.contextMenus.onClicked.addListener(function (info) {
        if (info.menuItemId === 'chronotesCreate') {
            port.postMessage({
                type: info.menuItemId,
                keyword: info.selectionText
            });
        }
        if (info.parentMenuItemId === 'chronotesGoTo') {
            port.postMessage({
                type: info.parentMenuItemId,
                keyword: info.menuItemId
            });
        }
    });

    port.onMessage.addListener(function (message) {
        switch (message.type) {
            case 'chronotesItem':
                createNoteContextItem(message.note);
                break;

            case 'chronotesCounter':
                createBadgeWithCounter(message);
                break;

            case 'chronotesReload':
                console.log(message)
                setTimeout(function () {
                    port.postMessage({
                        type: 'chronotesReloadNotes'
                    });
                }, 1000);

                break;
        }
    });
});

chrome.tabs.onActivated.addListener(function () {
    chrome.contextMenus.removeAll(function () {
        createBaseContextMenus();
    });
});

function createBaseContextMenus() {
    chrome.contextMenus.create({
        title: 'Chronotes',
        id: 'chronotesGoTo'
    });
    chrome.contextMenus.create({
        title: 'Create note for selected text',
        id: 'chronotesCreate',
        contexts: ['selection']
    });
}

function createNoteContextItem(note) {
    if (note) {
        chrome.contextMenus.create({
            title: note.keyword,
            parentId: 'chronotesGoTo',
            id: note.keyword
        });
    }
}

function createBadgeWithCounter(message) {
    chrome.browserAction.setBadgeText({text: message.count.toString()});
}
