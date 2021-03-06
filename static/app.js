var playlist = $('#playlist'),
    song_id = -1,
    tracks = {},
    queueTimer,
    queue = [],
    searchTracks = [];

onMediaUpdate(function(isAlive) {
  if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING) {
    if (currentMediaSession.currentItemId != song_id &&
        currentMediaSession.currentTime > 1 &&
        currentMediaSession.currentTime < 5) {
      console.log('Detected oddly started song! Restarting. ' + currentMediaSession.currentTime);
      setMediaVolume(null, true);
      seek(function() { setMediaVolume(null, false) })(0, true);
    } else if (queue.length > 0) {
      console.log(queue);
      clearTimeout(queueTimer);
      queueAll(queue);
      queue = [];
    }
  }

  console.log('Media ' + currentMediaSession.playerState + ' @ ' + currentMediaSession.currentTime);
  updateStatus();
  if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING &&
      currentMediaSession.currentItemId != song_id) {
    song_id = currentMediaSession.currentItemId;
    updatePlayCount();
  }
});

onMediaDiscovery(function() {
  console.log('media discovered');
  song_id = currentMediaSession.currentItemId;
  updateStatus();
  updatePlayCount();
});

var playCount = {};
function updatePlayCount() {
  var item;
  if (currentMediaSession.items) {
    item = $.grep(currentMediaSession.items, function(element) {
      return element.itemId == currentMediaSession.currentItemId;
    })[0];
  } else {
    item = currentMediaSession;
  }
  var id = item.media.metadata.customData.id;

  playCount[id] = playCount[id] + 1 || 1;
}

function dumpQueue() {
  console.log($.map(currentMediaSession.items, function(element) {
    return element.media.metadata.title;
  }));
}

function dumpTracks(tracks, name) {
  trackNames = tracks.map(function(track) {
    return track.name;
  });
  console.log(trackNames);

  if (name) {
    console.log(trackNames.indexOf(name));
  }
}

function getItem(media, id) {
  var item = $.grep(currentMediaSession.items, function(element) {
    if (arguments.length > 1) {
      return element.itemId == id
    } else {
      return element.media.contentId == media.contentId;
    }
  })[0];

  console.log(currentMediaSession.items.indexOf(item));

  return item;
}

function extractQueue() {
  var queueItems = $.map(currentMediaSession.items, function(item) {
    return tracks[item.media.metadata.customData.id];
  });

  return queueItems;
}

function play(id) {
  if (!tracks[id]) {
    registerTrack($.grep(searchTracks, function(track) {
      return track.id == id;
    })[0]);
  }
  var track = tracks[id];

  if (currentMediaSession.items) {
    var currentItem = getItem(null, currentMediaSession.currentItemId);
    var queueItems = extractQueue();
    var start = Math.min(currentMediaSession.items.indexOf(currentItem) + 1, currentMediaSession.items.length);

    var played = queueItems.splice(0, start);
    queue = queueItems.concat(played);
    queueProcessed = false;
  }
  loadTrack(track);
}

function updateStatus() {
  if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING) {
    $('#playpause').removeClass('fa-play').addClass('fa-pause');
  } else if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PAUSED) {
    $('#playpause').removeClass('fa-pause').addClass('fa-play');
  }

  var media = {title: 'Start a song!', albumName: ''};
  if (currentMediaSession.items) {
    var item = $.grep(currentMediaSession.items, function(element) {
      return element.itemId == currentMediaSession.currentItemId;
    })[0];
    media = item.media.metadata;

    var next_index = currentMediaSession.items.indexOf(item) + 1;
    if (next_index < currentMediaSession.items.length) {
      var next = currentMediaSession.items[next_index].media.metadata;
      $('#next-up .title').text(next.title);
      $('#next-up .album').text(next.albumName);
    } else {
      $('#next-up .title').text('');
      $('#next-up .album').text('');
    }
  } else if (currentMediaSession.media) {
    media = currentMediaSession.media.metadata;
  }
  $('#now-playing .title').text(media.title);
  $('#now-playing .album').text(media.albumName);
  $('#volume').val(session.receiver.volume.level * 100);
}

function shuffleTracks(tracks) {
  var length = tracks.length;
  var shuffled = [];

  var minWeight = Math.min.apply(null, $.map(playCount, function(count) { return count }));

  var shuffleTrack = function(track) {
    // More plays = higher chance of being put in the back of the queue
    var weight = Math.max(1, (playCount[track.id] || 1) / minWeight);
    // Higher weight makes the index more likely to be a large number
    // Fancy algorithm that basically reduces the effect weight has the larger it is.
    var rand = Math.random();
    var index = (tracks.length - parseInt(rand * (tracks.length / Math.pow(weight, (1/7) * rand)))) - 1;

    if (shuffled[index]) {
      // Keep trying to assign it an index until it finds a place
      shuffleTrack(track);
    } else {
      shuffled[index] = track;
    }
  };

  for (var i = 0; i < length; i++) {
    var track = tracks[i];
    shuffleTrack(track);
  }

  return shuffled;
}

function shuffle() {
  var current_queue = $.map(tracks, function(track) { return track });
  var shuffled = shuffleTracks(current_queue);
  queueAll(shuffled);
}

function queueAll(trackList) {
  var queueOffset = 60;
  var initialized = false;
  var left = trackList.slice(0)
  var queueNext = function() {
    if (!initialized || (currentMediaSession && currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING)) {
      initialized = true;
      addTrack(left.shift());
    }

    if (left.length > 0) {
      queueTimer = setTimeout(queueNext, 250);
    }
  }

  queueNext();
}

function registerTrack(track) {
  tracks[track.id] = track;
}

function addTrackElement(track) {
  playlist.append($('<li>').append(
    $('<a>').attr('href', '#' + track.id).append(
      $('<img>').attr('src', track.cover)).append(
      $('<p>').attr('class', 'title').append(track.name)).append(
      $('<p>').attr('class', 'album').append(track.album)
  )));
}

$.getJSON('/playlist/iliekpie/5rZsjxKt6W8Sw9j7DXH9bH', function(data) {
  for (var i = 0; i < data.count; i++) {
    registerTrack(data.tracks[i]);
    addTrackElement(data.tracks[i]);
  }
});

playlist.on('click', 'a', function(e) {
  e.preventDefault();

  var id = $(this).attr('href').split('#')[1];

  console.log('Playing: ' + id)

  play(id);

  if (searchTracks.length > 0) {
    reset();
  }
});

$('#playpause').click(function(e) {
  e.preventDefault();

  if (currentMediaSession) {
    if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING) {
      currentMediaSession.pause();
    } else {
      currentMediaSession.play();
    }
  } else {
    shuffle();
  }
});

$('#next').click(function(e) {
  e.preventDefault();

  currentMediaSession.queueNext();
})

$('#volume').on('input change', function() {
  setVolume($(this).val());
});

var suggestion = $('#search-suggestion');
function reset() {
  suggestion.val('');
  $('#search').val('');
  searchTracks = [];
  if (playlist.children().length < Object.keys(tracks).length) {
    playlist.empty();
    for (track in tracks) {
      addTrackElement(tracks[track]);
    }
  }
}

function search(query) {
  if (!query || query.trim().length == 0) {
    reset();
    return;
  }

  console.log('new query: ' + query);

  $.getJSON('/search/' + encodeURIComponent(query), function(data) {
    playlist.empty();
    searchTracks = [];
    for (var i = 0; i < data.count; i++) {
      searchTracks.push(data.tracks[i]);
      addTrackElement(data.tracks[i]);
    }
  });
}

function getSuggestion(string) {
  if (!string || string.length == 0) {
    suggestion.val('');
    return;
  }

  $.getJSON('/search/' + encodeURIComponent(string) + '/1', function(data) {
    if (data.count == 1) {
      var name = data.tracks[0].name;
      var beginning = name.slice(0, string.length);
      var chunk = name.slice(string.length);

      if (beginning.localeCompare(string, 'en', { usage: 'search', sensitivity: 'base' }) == 0) {
        suggestion.val(string + chunk);
      } else {
        suggestion.val('');
      }
    }
  });
}

var searchTimeout;
$('#search').keydown(function(e) {
  if (e.which == 9) {
    // tab
    if (suggestion.val().trim().length > 0 && $(this).val() != suggestion.val()) {
      e.preventDefault();
      $(this).val(suggestion.val());
    }
  }
}).keyup(function(e) {
  if (e.which == 27 || e.which == 13) {
    // esc or enter
    e.preventDefault();
    this.blur();
    search($(this).val());
  } else if (e.which == 8) {
    // backspace
    getSuggestion($(this).val());

    if ($(this).val() == '') {
      reset();
    }
  }
}).keypress(function(e) {
  clearTimeout(searchTimeout);

  var character = String.fromCharCode(e.charCode);
  var string = $(this).val() + character;
  getSuggestion(string);

  searchTimeout = setTimeout(search, 500, string);
}).focus(function() {
  $(this).css('background-color', 'transparent');
  suggestion.fadeTo(0, 1);
}).blur(function() {
  $(this).css('background-color', 'white');
  suggestion.fadeTo(0, 0).text('');
});

$(window).keydown(function(e){
  if (e.metaKey || e.ctrlKey) {
    // ctrl/cmd
    if(e.which == 70 || e.which == 65){
      // f or a
      e.preventDefault();
      $('#search').show().focus();
      if (e.which == 65) {
        $('#search').select();
      }
    }
  }
}).load(function() {
  playCount = JSON.parse(localStorage.getItem('playCount')) || {};
  song_id = localStorage.getItem('currentSong') || -1;
}).unload(function() {
  localStorage.setItem('playCount', JSON.stringify(playCount));
  localStorage.setItem('currentSong', song_id);
});
