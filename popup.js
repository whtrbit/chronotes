(function init() {
    'use strict';

    var port = chrome.runtime.connect({name: 'chronotes'});
    var FIREBASE_CONFIG = null;

    setupNotes();
    setupSettings();

    function setupNotes() {
        createNotesList();
    }

    function setupSettings () {
        addSettingsCtrlOpenEventListener();
        addSettingsSaveEventListener();
        addSettingsRestoreEventListener();
        getFirebaseConfigFromLocalStorage();
        fillFirebaseURLInForm();
    }

    function addSettingsCtrlOpenEventListener() {
        var trigger = document.getElementById('settings-ctrl');

        trigger.addEventListener('click', function () {
            trigger.parentNode.classList.toggle('is-settings-open');
        });
    }

    function addSettingsSaveEventListener () {
        var button = document.getElementById('settings-save');

        button.addEventListener('click', function (event) {
            event.preventDefault();

            FIREBASE_CONFIG = getFirebaseConfig();
            chrome.storage.local.set({
                chronotesFirebaseConfig: FIREBASE_CONFIG
            });
            saveBackupInFirebase();
        });
    }

    function addSettingsRestoreEventListener () {
        var button = document.getElementById('settings-restore');

        button.addEventListener('click', function (event) {
            event.preventDefault();

            FIREBASE_CONFIG = getFirebaseConfig();
            restoreBackupFromFirebase();
        });
    }

    function getFirebaseConfigFromLocalStorage () {
        chrome.storage.local.get(['chronotesFirebaseConfig'], function (storage) {
            if (storage.chronotesFirebaseConfig) {
                FIREBASE_CONFIG = storage.chronotesFirebaseConfig;
                fillFormWithPreviousFirebaseConfig(storage.chronotesFirebaseConfig);
            }
        });
    }

    function getFirebaseConfig () {
        var config = {};
        var inputs = document.getElementsByTagName('input');

        for (var i = 0; i < inputs.length; i++) {
            var el = Array.from(inputs)[i];

            config[el.getAttribute('placeholder')] = el.value;
        }

        return config;
    }

    function fillFormWithPreviousFirebaseConfig (config) {
        var inputs = document.getElementsByTagName('input');

        for (var i = 0; i < inputs.length; i++) {
            var el = Array.from(inputs)[i];

            el.value = config[el.getAttribute('placeholder')];
        }
    }

    function saveBackupInFirebase () {
        chrome.storage.local.get(['chronotesItems'], function (storage) {
            if (!storage.chronotesItems) {
                showNotification('Nothing to save.');
                return;
            }

            var firebaseRef = new Firebase(FIREBASE_CONFIG.databaseURL);

            firebaseRef.set(null);

            storage.chronotesItems.forEach(function (note) {
                firebaseRef.push().set(note);
            });

            showNotification('Backup saved in database.');
            chrome.storage.local.set({
                chronotesFirebaseURL: FIREBASE_CONFIG.databaseURL
            });
        });
    }

    function restoreBackupFromFirebase () {
        var firebaseRef = new Firebase(FIREBASE_CONFIG.databaseURL);

        firebaseRef.once('value', function (snapshot) {
            var notes = snapshotToArray(snapshot);

            if (notes.length > 0) {
                chrome.storage.local.set({
                    chronotesItems: notes
                });
                port.postMessage({
                    type: 'chronotesBackupRestore',
                    notes: notes
                });
                showNotification('Data restored. Please close and open Chronotes popup to see the list of restored notes.');
            } else {
                showNotification('No data in database.')
            }

            chrome.storage.local.set({
                chronotesFirebaseURL: FIREBASE_CONFIG.databaseURL
            });
        });
    }

    function snapshotToArray (snapshot) {
        var returnArr = [];

        snapshot.forEach(function (childSnapshot) {
            var item = childSnapshot.val();

            item.key = childSnapshot.key;

            returnArr.push(item);
        });

        return returnArr;
    }

    function showNotification (notification) {
        var el = document.getElementById('settings-notification');

        el.textContent = notification;
        window.setTimeout(function () {
            el.textContent = '';
        }, 10000);
    }

    function fillFirebaseURLInForm () {
        chrome.storage.local.get(['chronotesFirebaseConfig'], function (storage) {
            if (storage.chronotesFirebaseConfig) {
                document.getElementById('settings-databaseURL').value = storage.chronotesFirebaseConfig.databaseURL;
            }
        });
    }

    function createNotesList () {
        var wrapper = document.getElementById('notes');
        
        chrome.storage.local.get(['chronotesItems'], function (storage) {
            if (storage.chronotesItems) {
                storage.chronotesItems.forEach(function (note) {
                    var listElement = document.createElement('li');
                    var keyElement = document.createElement('div');
                        keyElement.textContent = note.keyword;
                        keyElement.classList.add('notes__key');
                    var websiteElement = document.createElement('a');
                        websiteElement.href = note.website;
                        websiteElement.setAttribute('target', '_blank');
                        websiteElement.textContent = note.website;
                        websiteElement.classList.add('notes__website');
                    var noteElement = document.createElement('div');
                        noteElement.textContent = note.note;
                        noteElement.classList.add('notes__note');

                    listElement.appendChild(keyElement);
                    listElement.appendChild(websiteElement);
                    listElement.appendChild(noteElement);

                    wrapper.appendChild(listElement);

                    keyElement.addEventListener('click', function (event) {
                        event.target.parentNode.classList.toggle('is-open');
                    });
                });
            }
        });
    }
})();
