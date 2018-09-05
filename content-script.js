(function init() {
    'use strict';

    var chronotesItems;
    var port = chrome.runtime.connect({name: 'chronotes'});
    var SETTINGS = {
        selectorsWhitelist: [
            'DIV', 'P', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'B',
            'STRONG', 'A', 'LI', 'PRE', 'EM', 'TD', 'TH', 'STRONG', 'B', 'I'
        ],
        highlightTargetTextColor: 'lightyellow'
    };

    port.onMessage.addListener(function(message) {
        switch (message.type) {
            case 'chronotesCreate':
                create(message);
                break;

            case 'chronotesGoTo':
                gotToNote(message);
                break;

            default:
        }
    });

    fillPopupsWithStorageValues();
    updateStorage();

    function getTargetElementsFromPage() {
        return getAllTextTypedNodes().filter(function (element) {
            return SETTINGS.selectorsWhitelist.indexOf(element.nodeName) > -1 &&
                element.textContent.trim().length > 2 &&
                element.children.length === 0 &&
                !element.classList.contains('chronotes-title');
        });

        function getAllTextTypedNodes() {
            var n;
            var arr = [];
            var walk = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_ELEMENT,
                null,
                false
            );

            while (n = walk.nextNode()) arr.push(n);

            return arr;
        }
    }

    function updateStorage(newNote, remove) {
        chrome.storage.local.get(['chronotesItems'], function (storage) {
            if (!storage.chronotesItems) {
                chronotesItems = [];
            } else {
                chronotesItems = storage.chronotesItems;
            }

            var indexOfDuplicate = chronotesItems.findIndex(function (note) {
                return note.keyword === (newNote ? newNote.keyword : null);
            });

            if (remove) {
                chronotesItems.splice(indexOfDuplicate, 1);
            } else {
                if (!newNote) {
                } else if (indexOfDuplicate < 0) {
                    chronotesItems.push(newNote);
                } else {
                    chronotesItems[indexOfDuplicate] = newNote;
                }
            }

            chrome.storage.local.set({
                chronotesItems: chronotesItems
            });

            sendPopupNotesCounter();
        });
    }

    function fillPopupsWithStorageValues() {
        chrome.storage.local.get(['chronotesItems'], function (storage) {
            if (!storage.chronotesItems) return;

            getTargetElementsFromPage().forEach(function (targetElement) {
                if (targetElement.classList.contains('chronotes-item')) {
                    return false;
                } else {
                    var targetElementText = targetElement.textContent;

                    if (targetElementText) {
                        targetElementText.trim();

                        storage.chronotesItems.forEach(function (note) {
                            if (targetElementText === note.keyword) {
                                markAsWitNote(targetElement);
                                createPopupElement(targetElement);
                                addTargetOpenEventListener(targetElement);
                                targetElement.parentNode.getElementsByTagName('textarea')[0].value = note.note;

                                port.postMessage({
                                    type: 'chronotesItem',
                                    note: note
                                });
                            }
                        });
                    }
                }

                sendPopupNotesCounter();
            });
        });
    }

    function create(data) {
        var targetElement = getTargetElement(data.keyword);

        createPopupElement(targetElement);

        targetElement.parentNode.classList.add('is-open');

        addTargetOpenEventListener(targetElement);
        addPopupSendNoteEventListener(targetElement);
        addPopupCloseEventListener(targetElement);
        addPopupRemoveEventListener(targetElement);
    }

    function gotToNote(data) {
        var targetElement = getTargetElement(data.keyword);

        if (targetElement === null) return false;

        var coordinatesY = getElementYCoordinates(targetElement);

        window.scrollTo(0, coordinatesY - 100);

        targetElement.parentNode.classList.toggle('is-open');
        addPopupSendNoteEventListener(targetElement);
        addPopupCloseEventListener(targetElement);
        addPopupRemoveEventListener(targetElement);
    }

    function getTargetElement(keyword) {
        var targetElements = getTargetElementsFromPage();
        var index = targetElements.findIndex(function (targetElement) {
            return targetElement.textContent === keyword;
        });

        return targetElements[index] ? targetElements[index] : null;
    }

    function addTargetOpenEventListener (targetElement) {
        targetElement.addEventListener('click', function (event) {
            event.preventDefault();

            if (event.target !== targetElement) return;

            targetElement.parentNode.classList.toggle('is-open');

            addPopupSendNoteEventListener(targetElement);
            addPopupCloseEventListener(targetElement);
            addPopupRemoveEventListener(targetElement);
        });
    }

    function addPopupCloseEventListener(targetElement) {
        var closeIconElement = getPopupElement(targetElement).getElementsByTagName('i')[0];

        closeIconElement.addEventListener('click', function (event) {
            event.stopPropagation();

            targetElement.parentNode.classList.remove('is-open');
        });
    }

    function addPopupSendNoteEventListener (targetElement) {
        var titleValue = getPopupElement(targetElement).getElementsByTagName('div')[0].textContent;
        var button = getPopupElement(targetElement).getElementsByTagName('button')[0];

        button.addEventListener('click', function () {
            var textareaValue = getPopupElement(targetElement).getElementsByTagName('textarea')[0].value;
            var note = {
                keyword: titleValue,
                note: textareaValue ? textareaValue : '',
                website: getWebsiteURL()
            };

            updateStorage(note);
            port.postMessage({
                type: 'chronotesItem',
                note: note
            });
            markAsWitNote(targetElement);
            targetElement.parentNode.classList.remove('is-open');
        });
    }

    function addPopupRemoveEventListener (targetElement) {
        var titleValue = getPopupElement(targetElement).getElementsByTagName('div')[0].textContent;
        var button = getPopupElement(targetElement).getElementsByTagName('button')[1];

        button.addEventListener('click', function () {
            var textareaValue = getPopupElement(targetElement).getElementsByTagName('textarea')[0].value;

            if (textareaValue) {
                updateStorage({
                    keyword: titleValue,
                    note: textareaValue,
                    website: getWebsiteURL()
                }, true);
                unmarkAsWitNote(targetElement);
                targetElement.parentNode.classList.remove('is-open');
                getPopupElement(targetElement).remove();
            }
        });
    }

    function createPopupElement(targetElement) {
        var targetElementStyleDisplay = window.getComputedStyle(targetElement);
            targetElementStyleDisplay = targetElementStyleDisplay.getPropertyValue('display');

        var wrapper = document.createElement('div');
            wrapper.style = 'position: relative;' + 'display: ' + targetElementStyleDisplay + ';';
        var parent = targetElement.parentNode;

        var popupElement = document.createElement('div');
            popupElement.classList = 'note-popup';
        var popupHeadingElement = document.createElement('div');
            popupHeadingElement.innerText = targetElement.textContent;
            popupHeadingElement.classList = 'note-popup__heading chronotes-title';
        var popupCloseIconElement = document.createElement('i');
        var popupTextareaElement = document.createElement('textarea');
        var popupButtonSaveElement = document.createElement('button');
            popupButtonSaveElement.textContent = 'Save';
        var popupButtonRemoveElement = document.createElement('button');
            popupButtonRemoveElement.textContent = 'Remove';

        popupElement.appendChild(popupHeadingElement);
        popupElement.appendChild(popupCloseIconElement);
        popupElement.appendChild(popupTextareaElement);
        popupElement.appendChild(popupButtonSaveElement);
        popupElement.appendChild(popupButtonRemoveElement);

        parent.replaceChild(wrapper, targetElement);
        wrapper.appendChild(targetElement);
        wrapper.appendChild(popupElement);
    }

    function markAsWitNote(targetElement) {
        targetElement.style = 'background: ' + SETTINGS.highlightTargetTextColor + ' !important; position: relative;';
        targetElement.classList.add('chronotes-item');
    }

    function unmarkAsWitNote(targetElement) {
        targetElement.style = 'background: none !important;';
        targetElement.classList.remove('chronotes-item');
    }

    function getElementYCoordinates(element) {
        var bodyRect = document.body.getBoundingClientRect();
        var elementRect = element.getBoundingClientRect();

        return Math.round(elementRect.top - bodyRect.top);
    }

    function getPopupElement(targetElement) {
        return targetElement.parentNode.getElementsByClassName('note-popup')[0];
    }

    function sendPopupNotesCounter() {
        var count = document.getElementsByClassName('chronotes-item').length;

        port.postMessage({
            type: 'chronotesCounter',
            count: count
        });
    }

    function getWebsiteURL() {
        return window.location.href;
    }
})();