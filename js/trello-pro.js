// -----------------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------------

var TrelloPro = TrelloPro || {};

TrelloPro.boardId = null;
TrelloPro.boardTitle = null;

TrelloPro.settings = {};
TrelloPro.settingsOverride = false;

TrelloPro.data = {
	lists: [],
	projects: [],
	labels: [],
	hashtags: []
};
TrelloPro.lists = [];

TrelloPro.$dynamicStyles = null;

TrelloPro.loaded = false;
TrelloPro.refreshing = false;

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------

/**
 * Prepares a given string name to be used as a HTML attribute
 *
 * @param {string} name
 * @return {string}
 */
let renderAttrName = function(name) {
  return name.toLowerCase()
    .replace('&amp;','and').replace('&','and')
    .replace(/\(.+?\)/g, '').replace(/[^a-z0-9+]+/gi, '-');
}

/**
 * Injects or removes a CSS stylesheet based on settings
 *
 * @param {string} name
 */
let toggleCssInject = function(name) {
  if (TrelloPro.settings[name]) {
    let $inject = jQuery('<style id="tpro-'+name+'-css"></style>');
    $inject.load(chrome.runtime.getURL('css/'+name+'.css'), function () {
      jQuery('body').append($inject);
    });
  } else jQuery('#tpro-'+name+'-css').remove();
}

/**
 * Log to the console
 *
 * @param {object} object
 */
let log = function(object) {
	return;
	console.log(object);
};

let processCustomCardLabel = function ($label) {
	return new Promise((resolve, reject) => {
		try {
			$label.addClass('my-label')
			let $labelTexts = $label.find('.label-text');
			
			for (let i = 0; i < $labelTexts.length; i++) {
				let $labelText = jQuery($labelTexts[i]);

				console.log(
					'<processCustomCardLabel>',
					'$labelText : ', 
					$labelText);

				// $labelText.css({
				// 	'display': 'inline-block'
				// });
				$labelText.addClass('my-label-text')
			}

			resolve();
		}
		catch (ex) {
			reject(ex)
		}
	})
}

/**
 * Handles card name change event for a specific card
 *
 * @param {jQuery} $title
 * @param {Boolean} refreshData
 * @return {Promise}
 */
let processCardTitleChange = function ($title,refreshData) {
  return new Promise((resolve,reject) => {
		let html = jQuery.trim($title.html());
	  if (jQuery.trim($title.text()).length < 5) return;
	  if (html.indexOf('<span class="tpro"></span>') > -1) return;

	  // reference the card (parent)
	  let $card = $title.parents('.list-card');

	  // wrap HTML and remove card number
	  let $htmlWrapper = jQuery('<div></div>').html(html);
	  let $projectNumber = $htmlWrapper.find('.card-short-id');
	  // if($projectNumber.length == 0) {
	  //   //var cardNumber = $title.attr('href').split('/')[3].split('-')[0];
	  //   // let cardNumber = 't';
	  //   // $projectNumber = jQuery('<span class="card-short-id hide">#'+cardNumber+'</span>');
	  // }
	  // else {
	  //   $projectNumber.detach();
	  // }
	  $projectNumber.detach();
	  html = $htmlWrapper.html();

	  // delay
	  setTimeout(function () {
	    let filterAttributes = [];

	    // groups/projects
	    if (TrelloPro.settings['parse-projects']) {
	      for(let i in TrelloPro.config.regex.tags) {
	        html = html.replace(TrelloPro.config.regex.tags[i], function (match, capture) {
	          let project = TrelloPro.config.renderers.tags(capture);
	          filterAttributes.push('tpro-project-' + renderAttrName(project));
	          return '<span class="tpro-project">' + project + '</span>';
	        });
	      }
	    }

	    // labels/tags
	    if (TrelloPro.settings['parse-labels']) {
	      html = html.replace(TrelloPro.config.regex.labels, function (match, capture) {
	        let label = TrelloPro.config.renderers.labels(capture);
	        filterAttributes.push('tpro-label-' + renderAttrName(label));
	        return '<div class="badge tpro-tag tpro-label">' + TrelloPro.config.symbols.label + ' ' + label + '</div>';
	      });
	    }

			// hashtags
	    if (TrelloPro.settings['parse-hashtags']) {
				html = html.replace(TrelloPro.config.regex.hashtags, function (match, capture) {
					let hashtag = TrelloPro.config.renderers.hashtags(capture);
					filterAttributes.push('tpro-hashtag-' + renderAttrName(hashtag.replace('#','')));
					return '<span class="tpro-hashtag">' + hashtag + '</span>';
				});
	    }

	    // time entries
	    if (TrelloPro.settings['parse-time-entries']) {
	      html = html.replace(TrelloPro.config.regex.time_entries, function (match, capture) {
	        return '<div class="badge tpro-tag tpro-time-entry">' + TrelloPro.config.symbols.time_entry + ' ' + TrelloPro.config.renderers.time_entries(capture) + '</div>';
	      });
	    }

	    // points
	    if (TrelloPro.settings['parse-points']) {
	      html = html.replace(TrelloPro.config.regex.points, function (match, capture) {
	        return '<div class="badge tpro-tag tpro-point">' + TrelloPro.config.symbols.point + ' ' + TrelloPro.config.renderers.points(capture) + '</div>';
	      });
	    }

	    // priority marks
	    if (TrelloPro.settings['parse-priority-marks']) {
	      let priorityCount = (html.match(/\!/g) || []).length;
	      if(priorityCount > 0) {
	        let priority = 'critical';
	        switch(priorityCount) {
	          case 1: priority = 'medium'; break;
	          case 2: priority = 'high'; break;
	        }
	        filterAttributes.push('tpro-priority-'+priority);
	        html = html.replace(/\!/g,'') + '<span class="badge tpro-tag tpro-priority"><i class="fa fa-exclamation-triangle tpro-priority ' + priority + '" aria-hidden="true"></i></span>';
	      }
	      else {
	        // normal priority
	        filterAttributes.push('tpro-priority-normal');
	      }
	    }

			// markup
			if (TrelloPro.settings['parse-markup']) {
				html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			    .replace(/\*(.+?)\*/g, '<em>$1</em>')
			    .replace(/~~(.+?)~~/g, '<strike>$1</strike>')
			    .replace(/\`(.+?)\`/g, '<code>$1</code>');
	    }

	    // wrap HTML
	    $htmlWrapper = jQuery('<div></div>').html(html);

	    // add control span and re-introduce project number
	    $htmlWrapper.prepend($projectNumber);
	    $htmlWrapper.prepend('<span class="tpro"></span>');

	    // get tags
	    let tags = [];
	    $htmlWrapper.find('.tpro-tag').each(function () {
	      tags.push(jQuery(this));
	    });

	    // handle tags
	    $card.find('.tpro-tag').remove();
	    for (let i in tags) {
	      if(tags[i].hasClass('tpro-priority')) {
	        $card.find('.badges').prepend(tags[i]);
	        continue;
	      }
	      $card.find('.badges').append(tags[i]);
	    }

	    // handle priority
	    let $priority = $htmlWrapper.find('.tpro-priority');
	    if($priority.length != 0) $priority.detach().appendTo($htmlWrapper);

	    // apply filterAttributes
	    $card.removeClass (function (index, css) {
	      return (css.match (/(^|\s)tpro-\S+/g) || []).join(' ');
	    });
	    for(let i in filterAttributes) $card.addClass(filterAttributes[i]);

	    // handle title & refresh data
	    $title.html($htmlWrapper.html());
			if(refreshData) {
				refreshData('card title update');
				refreshListStats();
			}

			resolve();
	  });
	});
}

/**
 * Rebuilds dynamic styles based on input
 */
let rebuildDynamicStyles = function() {
	log('rebuilding dynamic styles...');

  let css = '';

  // build filters
  let filtered = false;
  if(TrelloPro.settings.filters.project) {
    // apply only if project exists
    for(let i=0; i<TrelloPro.data.projects.length; i++) {
      if(TrelloPro.settings.filters.project == TrelloPro.data.projects[i].key) {
        css += '#tpro-header-button-filter { background-color: #2c3e50; } ';
        css += '.list-card.tpro-project-' + TrelloPro.settings.filters.project + ':not(.hide) { display: block; } ';
        filtered = true;
        break;
      }
    }
  }
  if(filtered) css += '.list-card { display:none } ';

  TrelloPro.$dynamicStyles.html(css);
}

/**
 * Attempts to store in sync storrage
 *
 * @param {string} key
 * @param {object} value
 */
let store = function(key, value) {
	let storrage = {};
  storrage[key] = value;
  chrome.storage.sync.set(storrage);
}

/**
 * Attempts to save current board settings
 */
let saveSettings = function() {
	log('saving board settings...');
	store(TrelloPro.boardId,TrelloPro.settings);
}

// -----------------------------------------------------------------------------
// Board Data
// -----------------------------------------------------------------------------

/**
 * Builds board data
 *
 * @return {object}
 */
let buildData = function() {
	// just a sorting function
  let sorter = function(a,b) { return a.key.localeCompare(b.key); }

  // get all projects
  let projects = [];
  let keys = [];
  let $projects = jQuery('.tpro-project');
  for(let i=0; i<$projects.length; i++) {
    var project = jQuery.trim(jQuery($projects[i]).text());
    var key = renderAttrName(project);
    var index = jQuery.inArray(key,keys);
    if(index > -1) {
      projects[index].cardCount++;
    }
    else {
      projects.push({ key: key, value: project, cardCount: 1 });
      keys.push(key);
    }
  }
  projects.sort(sorter);

  // get all labels
  let labels = [];
  keys = [];
  let $labels = jQuery('.tpro-tag.tpro-label');
  for(let i=0; i<$labels.length; i++) {
    let label = jQuery.trim(jQuery($labels[i]).text().replace(TrelloPro.config.symbols.label,""));
    let key = renderAttrName(label);
    let index = jQuery.inArray(key,keys);
    if(index > -1) {
      labels[index].cardCount++;
    }
    else {
      labels.push({ key: key, value: label, cardCount: 1 });
      keys.push(key);
    }
  }
  labels.sort(sorter);

	// get all hashtags
	let hashtags = [];
	keys = [];
  let $hashtags = jQuery('.tpro-tag.tpro-hashtag');
  for(let i=0; i<$hashtags.length; i++) {
    let hashtag = $hashtags[i].text();
    let key = renderAttrName(hashtag.replace('#',''));
    let index = jQuery.inArray(key,keys);
    if(index > -1) {
      hashtags[index].cardCount++;
    }
    else {
      hashtags.push({ key: key, value: hashtag, cardCount: 1 });
      keys.push(key);
    }
  }
  hashtags.sort(sorter);

	TrelloPro.data.projects = projects;
	TrelloPro.data.labels = labels;
	TrelloPro.data.hashtags = hashtags;

	store('data_'+TrelloPro.boardId, TrelloPro.data);
}

/**
 * Refreshes data for the current board
 *
 * @param {string} msg
 * @param {function} callback
 */
let refreshData = function(msg, callback) {
	if(!TrelloPro.loaded) return;
	if(TrelloPro.refreshing) return;

	log('data refresh - ' + msg);
	TrelloPro.refreshing = true;
  buildData();
	TrelloPro.refreshing = false;

	if('undefined' !== typeof callback) callback();
}

/**
 * Refreshes list stats
 */
let refreshListStats = function() {
	if(!TrelloPro.loaded || !TrelloPro.settings['show-list-stats']) return;
	log('refreshing list stats...');

	// get all lists
  let lists = [];
  let $lists = jQuery('.list');
  for(let i=0; i<$lists.length; i++) {
    let $this = jQuery($lists[i]);
    let list = {};

		/**
		 * Filters visible cards only
		 */
		let visibleFilter = function() {
			// ignore filtered by project
			if(TrelloPro.settings.filters.project
				&& !jQuery(this).hasClass('tpro-project-' + TrelloPro.settings.filters.project)) return false;

			// ignore filtered by Trello
			return jQuery(this).height() > 20;
		};

    // set basics
    list.title = $this.find('textarea.list-header-name').val();
		list.id = renderAttrName(list.title);
    list.totalCards = parseInt($this.find('.list-header-num-cards').text());
		list.totalVisibleCards = $this.find('.list-card').filter(visibleFilter).length;

    // count points
    list.totalPoints = 0;
		list.totalVisiblePoints = 0;
    $this.find('.tpro-point').each(function(){
      list.totalPoints += parseInt(jQuery.trim(jQuery(this).text()).match(/\d+/)[0]);
    });
		$this.find('.list-card').filter(visibleFilter).find('.tpro-point').each(function(){
      list.totalVisiblePoints += parseInt(jQuery.trim(jQuery(this).text()).match(/\d+/)[0]);
    });

    // count checklist tasks
    list.totalTasks = 0;
    list.completedTasks = 0;
    $this.find('.js-badges .icon-checklist').each(function(){
      let stats = jQuery(this).next('.badge-text').text().split('/');
      list.completedTasks += parseInt(stats[0]);
      list.totalTasks += parseInt(stats[1]);
    });

		buildListStats($this,list);
    lists.push(list);
  }

	TrelloPro.lists = lists;
	store('lists_'+TrelloPro.boardId, TrelloPro.lists);
}

// -----------------------------------------------------------------------------
// Builders
// -----------------------------------------------------------------------------

/**
 * Rotates banners while settings are visible
 */
let rotateBanners = function() {
	let batch = 'tpro-banners-' + Math.random().toString().replace('0.','');
	TrelloPro.$settingsPane.data('batch',batch);
	let $banners = TrelloPro.$settingsPane.find('.tpro-settings-banner');

	// randomize order
	let order = [];
	for (let i=0; i<$banners.length; i++) order.push(i);
	for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
  }

	// rotate
	let index = 0;
	let rotate = function(){
		if(!TrelloPro.$settingsPane.is(':visible')) return;
		if(!TrelloPro.$settingsPane.data('batch') || TrelloPro.$settingsPane.data('batch') != batch) return;

		$banners.filter(':visible').hide();
		$banners.eq(order[index]).fadeIn();

		if(++index == $banners.length) index = 0;
		setTimeout(rotate,7500);
	};

	setTimeout(rotate,1000);
}

/**
 * Loads current settings in the settings pane
 */
let loadSettingsPane = function () {
	log('loading board settings...');

	// check for board override
	if(TrelloPro.settingsOverride) {
		TrelloPro.$settingsPane.find('input[name="board-override"]')
			.attr('checked','checked')
			.parents('.switch').css('background','#2ecc71');
		TrelloPro.$settingsPane.find('.tpro-settings-container').show();
		TrelloPro.$settingsPane.find('.tpro-settings-info').hide();
	} else {
		TrelloPro.$settingsPane.find('input[name="board-override"]')
			.removeAttr('checked')
			.parents('.switch').css('background','#BDB9A6');
		TrelloPro.$settingsPane.find('.tpro-settings-container').hide();
		TrelloPro.$settingsPane.find('.tpro-settings-info').show();
	}

	rotateBanners();

	// load settings
	TrelloPro.$boardSettingsIframe.attr('src',chrome.runtime.getURL('board.html')+'#b='+TrelloPro.boardId);
}

/**
 * Builds the settings pane
 */
let buildSettingsPane = function () {
		log('building settings pane...');

    // load settings HTML
    TrelloPro.$settingsPane = jQuery('<div class="tpro-settings-wrapper" style="display:none"></div>');
    TrelloPro.$settingsPane.load(chrome.runtime.getURL("tmpl/settings.html"), function () {
        // determine root paths
        let imgRoot = chrome.runtime.getURL('img');
        let root = chrome.runtime.getURL('');

        // handle image sources
        TrelloPro.$settingsPane.find('img').each(function(){
          let $img = jQuery(this);
          $img.attr('src',$img.attr('src').replace('{$PATH}',imgRoot));
        });

        // handle links source
        TrelloPro.$settingsPane.find('a').each(function(){
          let $a = jQuery(this);
          $a.attr('href',$a.attr('href').replace('{$PATH}',root));
        });

				// reference board settings iframe
				TrelloPro.$boardSettingsIframe = TrelloPro.$settingsPane.find('iframe#tpro-board-settings');

				// attach toggle behaviour
				TrelloPro.$settingsPane.find('input[name="board-override"]').on('change',function(){
					let $this = jQuery(this);
					if($this.is(':checked')) {
						$this.parents('.switch').css('background','#2ecc71');
						TrelloPro.$settingsPane.find('.tpro-settings-info').hide();
						TrelloPro.$settingsPane.find('.tpro-settings-container').slideDown();
					} else {
						$this.parents('.switch').css('background','#BDB9A6');
						TrelloPro.$settingsPane.find('.tpro-settings-container').slideUp();
						TrelloPro.$settingsPane.find('.tpro-settings-info').show();
					}
				});

        // attach close button behaviour
        TrelloPro.$settingsPane.find('.tpro-settings-close').on('click', function () {
					saveSettings();
          TrelloPro.$settingsPane.fadeOut(150);
          jQuery('#board').show();
        });

        // attach save button behaviour
        TrelloPro.$settingsPane.find('.tpro-settings-save').on('click', function () {
					// check for override
					if(!TrelloPro.$settingsPane.find('input[name="board-override"]').is(':checked')) {
						TrelloPro.settings = false;
						saveSettings();
					}

					window.location.reload();
        });

        TrelloPro.$settingsPane.appendTo(jQuery('.board-canvas'));
      });
}

/**
 * Builds the TrelloPro menu
 */
let buildMenu = function () {
  TrelloPro.$button = jQuery('<a id="tpro-filter-trigger" class="board-header-btn calendar-btn" href="#"><span class="icon-sm icon-board board-header-btn-icon"></span><span class="board-header-btn-text u-text-underline">Pro4Trello#</span></a>');
  TrelloPro.$button.on('click', function () {
    if (TrelloPro.$settingsPane.is(':visible')) {
      TrelloPro.$settingsPane.fadeOut(150);
      jQuery('#board').show();
    }
    else {
      loadSettingsPane();
      jQuery('#board').hide();
      TrelloPro.$settingsPane.fadeIn(150);
    }
  });
  setTimeout(function(){
    TrelloPro.$button.prependTo(jQuery('.board-header-btns.mod-right'));
  },500);
}

/**
 * Builds the Project Filter
 */
let buildProjectFilter = function () {
	log('building projects filter...');

  // create menu item
  let $menuItem = jQuery('<a id="tpro-header-button-filter" class="board-header-btn" href="#"></a>');

  // try to apply pre-loaded filter
  let $filter = jQuery('<span id="tpro-filter" data-project="" class="board-header-btn-text u-text-underline">All</span>');
  if(TrelloPro.settings.filters.project) {
    for(let i=0; i<TrelloPro.data.projects.length; i++) {
      if(TrelloPro.settings.filters.project == TrelloPro.data.projects[i].key) {
        $filter.attr('data-project',TrelloPro.settings.filters.project);
        $filter.text(TrelloPro.data.projects[i].value + '('+TrelloPro.data.projects[i].cardCount+')');
        break;
      }
    }
  }
  $menuItem.append('<span class="board-header-btn-icon icon-sm icon-filter"></span>');
  $menuItem.append(jQuery('<span class="board-header-btn-text"><span>Show: </span></span>').append($filter));

  // add behaviour
  $menuItem.on('click',function(e){
    let $popup = jQuery('#tpro-filter-popup');
    let $this = jQuery(this);
    if($popup.is(':visible')) { $popup.hide(); }
    else {
      // render project data
      let $list = $popup.find('ul.pop-over-list').html("");
      let selected = jQuery('#tpro-filter').attr('data-project');
      for(project of TrelloPro.data.projects) {
        let $a = jQuery(
          '<a class="js-select light-hover" data-project="'+project.key+'" href="#">'
            +project.value+' <span>('+project.cardCount+')</span>'
          +'</a>'
        );
        if(project.key == selected) $a.addClass('disabled');
        $list.append(jQuery('<li></li>').append($a));
      }
      $list.prepend('<li><a class="js-select light-hover" data-project="" href="#">All</a></li>'); // default "all"

      // attach filter behaviour
      $list.find('li a').on('click',function(evt){
        let $this = jQuery(this);

        // update filter in menu
        $filter.attr('data-project',$this.data().project);
        $filter.text($this.text());

        // update filters
        let project = $this.data().project;

        TrelloPro.settings.filters.project = (project != "") ? project : false;
        rebuildDynamicStyles();
        saveSettings();
				setTimeout(function(){
					refreshData('filter');
					refreshListStats();
				},54);

        $popup.hide();

        evt.preventDefault();
        return false;
      });

      // show popup
      $popup.css({
        top: $this.position().top + $this.offset().top + $this.outerHeight(true) + 6,
        left: $this.offset().left
      }).show();
    }

    e.preventDefault();
    return false;
  });

  // create filter popup
  $filterPopup = jQuery('<div id="tpro-filter-popup"></div>');
  $filterPopup.append(
    '<div class="pop-over-header js-pop-over-header">'
      +'<span class="pop-over-header-title">Filter Cards</span>'
      +'<a href="#" class="pop-over-header-close-btn icon-sm icon-close"></a>'
    +'</div>'
  );
  $filterPopup.append(
    '<div><div class="pop-over-content js-pop-over-content u-fancy-scrollbar js-tab-parent" style="max-height: 673px;">'
      +'<div>'
        +'<ul class="pop-over-list">'
          +'<li><a class="js-select light-hover" href="#">All</a></li>'
        +'</ul>'
      +'</div>'
    +'</div></div>'
  );
  $filterPopup.find('a.pop-over-header-close-btn').on('click',function(e){
    $filterPopup.hide();
    e.preventDefault();
    return false;
  });

  jQuery('.board-header-btns.mod-left').append($menuItem);
  jQuery('body').append($filterPopup);
}

/**
 * Builds the Labels Filter
 */
let buildLabelsFilter = function () {
	log('building labels filter...');

	let $menuItem = jQuery('<a class="board-header-btn" href="#"></a>');
	$menuItem.append('<span class="board-header-btn-icon icon-sm icon-label"></span>');
	$menuItem.append('<span class="board-header-btn-text">Tags: <span style="text-decoration: underline">All</span></span>');

  // TODO: implement

  jQuery('.board-header-btns.mod-left').append($menuItem);
}

/**
 * Builds stats for a list
 *
 * @param {jQuery} $list
 * @param {Object} list
 */
let buildListStats = function($list,list) {
  // init and clear stats
  let $stats = $list.parent().find('.tpro-list-stats');
  if($stats.length == 0) {
    $stats = jQuery('<div class="tpro-list-stats"></div>');

		// card count
		$stats.prepend(
	    '<span class="tpro-stat count" title="Total cards">'
	      +'<i class="fa fa-hashtag" aria-hidden="true"></i> '
	      +'<span></span>'
	    +'</span>'
	  );

		// tasks count
	  $stats.prepend(
	    '<span class="tpro-stat checklist" title="Checklist Tasks">'
	      +'<i class="fa fa-check-square-o" aria-hidden="true"></i> '
	      +'<span></span>'
	    +'</span>');

	  // points
	  if(TrelloPro.settings['parse-points']) {
			$stats.prepend(
		    '<span class="tpro-stat points" title="Total Points">'
		      +'<i class="fa fa-star" aria-hidden="true"></i> '
		      +'<span></span>'
		    +'</span>');
	  }

		// progress bar
		if(TrelloPro.settings['show-list-stats-progressbar']) {
			$stats.append(
				'<div class="progress-bar-wrapper">'
					+'<div class="checklist-progress">'
						+'<span class="checklist-progress-percentage">0%</span>'
						+'<div class="checklist-progress-bar">'
							+'<div class="checklist-progress-bar-current" style="width: 0%;"></div>'
						+'</div>'
					+'</div>'
				+'</div>');
				$stats.css('height','35px');
		} else {
			$stats.css('height','25px');
		}

		$stats.insertBefore($list);
  }

  // card count
	$stats.find('.tpro-stat.count span').text(list.totalVisibleCards == list.totalCards
		? list.totalCards
		: list.totalVisibleCards + '/' + list.totalCards
	);

  // tasks count
	$stats.find('.tpro-stat.checklist span').text(list.completedTasks + '/' + list.totalTasks);

  // points
  if(TrelloPro.settings['parse-points']) {
		$stats.find('.tpro-stat.points span').text(list.totalVisiblePoints == list.totalPoints
			? list.totalPoints
			: list.totalVisiblePoints + '/' + list.totalPoints
		);
  }

	// progress bar
	if(TrelloPro.settings['show-list-stats-progressbar']) {
		let percentage = (list.totalTasks == 0) ? 100 : Math.floor((list.completedTasks*100)/list.totalTasks);
		$stats.find('.checklist-progress-bar-current').css('width',percentage+'%');
		$stats.find('.checklist-progress-percentage').text(percentage+'%');
	}
}

// -----------------------------------------------------------------------------
// Loaders
// -----------------------------------------------------------------------------

/**
 * Loads CSS styles for the current board
 *
 * @return {Promise}
 */
let loadCss = function(){
	return new Promise((resolve,reject) => {
		// label sizes CSS
		if(TrelloPro.settings['visible-labels']) {
			jQuery('body').addClass('tpro-card-labels-size-'+TrelloPro.settings['labels-size']);
		} else {
			jQuery('body').removeClass('tpro-card-labels-size-'+TrelloPro.settings['labels-size']);
		}

		// list stats CSS
		if(TrelloPro.settings['show-list-stats']) {
			jQuery('body').addClass('tpro-show-list-stats');
		} else {
			jQuery('body').removeClass('tpro-show-list-stats');
		}

		// custom background
		if (TrelloPro.settings['custom-background'] && TrelloPro.settings['custom-background-input'] !== "") {
			let $customBackgroundStyle = jQuery('<style id="tpro-custom-background-css">body, #classic-body { background-image: url("'+TrelloPro.settings['custom-background-input']+'") !important }</style>');
			jQuery('body').append($customBackgroundStyle);
		} else {
			let $customBackgroundStyle = jQuery("#tpro-custom-background-css");
			while(true) {
				$customBackgroundStyle.remove();
				$customBackgroundStyle = jQuery("#tpro-custom-background-css");
				if($customBackgroundStyle.length == 0) break;
			}
		}

		// custom CSS
		if (TrelloPro.settings['custom-css'] && TrelloPro.settings['custom-css-input'] != "") {
			jQuery('body').append('<style id="tpro-custom-css">' + TrelloPro.settings['custom-css-input'] + '</style>');
		}
		else {
			jQuery("#tpro-custom-css").remove();
		}

		toggleCssInject('visible-card-numbers');
		toggleCssInject('visible-labels');
		toggleCssInject('hide-activity-entries');
		//toggleCssInject('full-screen-cards');
		toggleCssInject('hide-add-list');
		toggleCssInject('beautify-markdown');
		toggleCssInject('compact-cards');

		resolve();
	});
};

/**
 * Applies settings to current cards
 *
 * @return {Promise}
 */
let parseCurrentCards = function() {
	log('Applying settings to current cards...');
	let $initCards = jQuery('.list-card-title');
	let promises = [];
	for(let i=0; i<$initCards.length; i++) {
		promises.push(processCardTitleChange(jQuery($initCards[i]),false));
	}
	return Promise.all(promises);
}

/**
 * Builds (prepares) initial data
 *
 * @return {Promise}
 */
let buildInitialData = function() {
	log('Building initial data...');
	return new Promise((resolve,reject) => {
		buildData();
		resolve();
	});
}

/**
 * Loads Pro4Trello
 */
let loadBoard = function () {
	// load for boards only
	if(window.location.href.split('/')[3] != 'b') return;

  // get board ID and title
  let boardId = window.location.href.split('/')[4];
  let boardTitle = jQuery.trim(jQuery('title').text());

	// prevent double loading
	if(TrelloPro.boardId == boardId) return;

	// identify for current board
	TrelloPro.boardId = boardId;
  TrelloPro.boardTitle = boardTitle;
	TrelloPro.loaded = false;
	log('Loading Pro4Trello#, board "' + boardId + '"...');

  // load settings
  TrelloPro.settings = TrelloPro.config.defaultSettings;
	// TODO get 'data_'+TrelloPro.boardId
  chrome.storage.sync.get(['defaults',TrelloPro.boardId], function (settings) {
		// set board-specific settings flag
		TrelloPro.settingsOverride = settings[TrelloPro.boardId] ? true : false;

		// get defaults and board-specific settings
		let defaults = settings['defaults'] ? settings['defaults'] : {};
		let boardSettings = settings[TrelloPro.boardId] ? settings[TrelloPro.boardId] : {};

		// merge settings
		TrelloPro.settings = jQuery.extend({}, TrelloPro.settings, defaults);
		TrelloPro.settings = jQuery.extend({}, TrelloPro.settings, boardSettings);

		// TODO set data?
		//TrelloPro.data = settings['data_'+TrelloPro.boardId] ? settings['data_'+TrelloPro.boardId] : null;

    setTimeout(function(){
			loadCss()
				.then(() => parseCurrentCards())
				.then(() => buildInitialData())
				.then(() => {
					TrelloPro.loaded = true;
					refreshListStats();
					buildProjectFilter();
					//buildLabelsFilter();
					rebuildDynamicStyles();
					buildSettingsPane();
					buildMenu();
					let myLabelProcess = function() {
						return new Promise((resolve, reject) => {
							let $labels =
								jQuery('.list-card-details .list-card-labels');
							let promises = [];
							for (let i = 0; i < $labels.length; i++) {
								let $label = jQuery($labels[i]);
								promises.push(processCustomCardLabel($label));
							}

							Promise.all(promises)
								.then(() => {
									resolve();
								});
						})
					};

					let labelProcessTask = function(callback) {
						setTimeout(function() {
							myLabelProcess()
								.then(function() {
									callback(callback);
								})
						}, 1000);
					};

					labelProcessTask(labelProcessTask);
				})
		}, 500);
  });
}

// -----------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------

/**
 * Initializes the content script
 */
let tpro = function(){
	log('Pro4Trello# intiialized...');
	TrelloPro.refreshing = false;

	// introduce dynamic styles
  TrelloPro.$dynamicStyles = jQuery('<style id="tpro-dynamic-css"></style>').appendTo(jQuery('body'));

  // introduce font awesome
  if(jQuery('#trello-pro-font-awesome').length == 0) {
    jQuery('body').append('<link id="trello-pro-font-awesome" href="'+chrome.runtime.getURL("lib/font-awesome/css/font-awesome.min.css")+'" rel="stylesheet">');
  }

	// bind ESC key
	jQuery(document).bind('keyup', function(e) {
		if(!TrelloPro.loaded) return;

		if(e.keyCode === 27) {

			// filter popup
			let $popup = jQuery('#tpro-filter-popup');
			if($popup.is(':visible')) {
				$popup.hide();
				return;
			}

			// settings
			let $settings = jQuery('.tpro-settings-wrapper');
			if($settings.is(':visible')) {
				$settings.find('.tpro-settings-close').click();
				return;
			}

		}
	});

	// bind mouse click
	jQuery(document).bind('mouseup', function (e){
		if(!TrelloPro.loaded) return;

		// filter popup
		let $popup = jQuery('#tpro-filter-popup');
		if (!$popup.is(e.target) && $popup.has(e.target).length === 0) {
				$popup.hide();
				return;
		}
	});

	// catch board changes
	jQuery('title').bind("DOMSubtreeModified",function(){
	  let title = jQuery.trim(jQuery(this).text());
	  let path = window.location.href.split('/');

	  if(path[3] != 'b') return; // works for boards only, not cards

		// check if board was changed
	  if(title == TrelloPro.boardTitle || TrelloPro.boardId == path[4]) {
			TrelloPro.loaded = true; // unlock everything
			return;
		}

	  loadBoard();
	});

	// bind card name processing to card title changes
	jQuery(document).on('DOMSubtreeModified', '.list-card-title', function (e) {
		//if(!TrelloPro.loaded) return;
		let $card = jQuery(this).parents('.list-card');
		if ($card.hasClass('placeholder') || $card.css('position') == 'absolute') return;
		//processCardTitleChange($card.find('.list-card-title'),true);
		processCardTitleChange($card.find('.list-card-title'),false);
	});

	// bind card name processing to card list changes
	jQuery(document).bind('DOMNodeInserted', function(e) {
		if(!TrelloPro.loaded) return;
		let $card = jQuery(e.target);
		if (!$card.hasClass('list-card') || $card.hasClass('placeholder') || $card.css('position') == 'absolute') return;
		//processCardTitleChange($card.find('.list-card-title'),true);
		processCardTitleChange($card.find('.list-card-title'),false);
	});

	// inject special event tracker
	let $changeTrigger = jQuery('<input type="hidden" id="trpo-history-state-change-trigger" value="" />');
	jQuery('body')
		.append($changeTrigger)
		.append(
			'<script type="text/javascript"> '
				+'var tproEvent = document.getElementById("trpo-history-state-change-trigger"); '
				+'let replaceStateOrigin = history.replaceState; '
				+'history.replaceState = function(state){ '
					+'tproEvent.value = "history.replaceState"; '
					+'let e = document.createEvent("HTMLEvents"); e.initEvent("change", false, true); tproEvent.dispatchEvent(e); '
					+'replaceStateOrigin.apply(history, arguments); '
				+'}; '
				+'let pushStateOrigin = history.pushState; '
				+'history.pushState = function(state){ '
					+'tproEvent.value = "history.pushState"; '
					+'let e = document.createEvent("HTMLEvents"); e.initEvent("change", false, true); tproEvent.dispatchEvent(e); '
					+'pushStateOrigin.apply(history, arguments); '
				+'}'
			+'</script>'
		);

	// handle events
	$changeTrigger.on('change',function(){
		if(!TrelloPro.loaded) return;

		let evt = jQuery(this).val();
		switch (evt) {
			case 'history.replaceState':
				log('history.replaceState detected.');
				// refresh data after Trello filter replaces state
				setTimeout(function(){ refreshData('history'); },54);
				return;
			case 'history.pushState':
				log('history.pushState detected.');
				// lock everything
				TrelloPro.loaded = false;
				return;
		}
	});

	// start loading the extension
	loadBoard();

	// trigger data refresh every 30 seconds
	(refresh = function() {
		refreshData('periodical');
		setTimeout(refresh,30000);
	})();

	// trigger stats every 7.5 seconds
	(refresh = function() {
		refreshListStats();
		setTimeout(refresh,7500);
	})();

	// // check if a card is opened directly
	// if(window.location.href.split('/')[3] == 'c') {
	//   chrome.storage.local.set({ 'tpro-redirect': window.location.href });
	//   setTimeout(function(){
	//     console.log(jQuery('.window-wrapper a.icon-close').get(0))
	//     jQuery('.window-wrapper a.icon-close').click();
	//   },2000) ;
	// }
	// else if(window.location.href.split('/')[3] == 'b') {
	//   // check for redirect
	//   chrome.storage.local.get('tpro-redirect',function(result){
	//     if(result['tpro-redirect'] && result['tpro-redirect'] != null) {
	//       chrome.storage.local.set({ 'tpro-redirect': null, 'tpro-board-id': window.location.href.split('/')[4] });
	//       history.pushState(null, null, result['tpro-redirect']);
	//     }
	//     else loadBoard();
	//   });
	// }
};

tpro();
