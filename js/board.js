var boardId;

function updateSettings() {
  let settings = {};

  // handle checkboxes
  $('input[type="checkbox"]').each(function () {
    let checkbox = jQuery(this);
    settings[checkbox.attr('name')] = checkbox.prop('checked');
  });

  // handle text inputs
  $('textarea,input[type="text"]').each(function () {
    let textarea = jQuery(this);
    settings[textarea.attr('name')] = textarea.val();
  });

  // handle select/radio buttons
  $('.radio-group').each(function () {
    let radio = jQuery(this).find('input').filter(':checked');
    settings[radio.attr('name')] = radio.val();
  });

  //parent.window.postMessage(JSON.stringify({'id':'tmp-settings','settings':settings}),'https://trello.com');
  let storage = {};
  storage[boardId] = settings;
  chrome.storage.sync.set(storage);
}

function loadSettings() {
  boardId = window.location.hash.replace('#b=','');

  chrome.storage.sync.get(['defaults',boardId], function (globalSettings) {
    var settings = globalSettings[boardId];

    if(settings) {
      for (let key in settings) {
        // try checkbox
        let checkbox = $('input[type="checkbox"][name="' + key + '"]');
        if (checkbox.length != 0) {
          if (settings[key]) {
            checkbox.attr('checked', true);
            checkbox.parents('.checklist-item').addClass('checklist-item-state-complete');
          }
          else {
            checkbox.removeAttr('checked');
            checkbox.parents('.checklist-item').removeClass('checklist-item-state-complete');
          }
          continue;
        }

        // try textarea, text input
        let textarea = $('[name="' + key + '"]');
        if (textarea.length != 0) {
          textarea.val(settings[key]);
          continue;
        }

        // try radio
        let radio = $('input[type="radio"][name="' + key + '"][value="' + settings[key] + '"]');
        if(radio.length != 0) {
          radio.attr('checked',true);
          continue;
        }
      }
    }
  });
}

$(function(){

  loadSettings();

  $('input[type="checkbox"],input[type="radio"]').on('change',updateSettings);
  $('tinput[type="text"],extarea').on('keyup',updateSettings);

});
