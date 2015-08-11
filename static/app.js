var playlist = $('#playlist'),
    song_id = -1,
    tracks = {},
    queueProcessed = true,
    queue = [];

Storage.prototype.setObj = function(key, obj) {
  return this.setItem(key, JSON.stringify(obj))
}

Storage.prototype.getObj = function(key) {
  return JSON.parse(this.getItem(key))
}

onMediaUpdate(function(isAlive) {
  if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING) {
    if (currentMediaSession.currentItemId != song_id &&
        currentMediaSession.currentTime > 1 &&
        currentMediaSession.currentTime < 4) {
      console.log('Detected oddly started song! Restarting. ' + currentMediaSession.currentTime);
      setMediaVolume(null, true);
      seek(function() { setMediaVolume(null, false) })(0, true);
    } else if (!queueProcessed && queue.length > 0) {
      queueProcessed = true;
      console.log(queue);
      queueAll(queue);
    }
  }

  console.log('Media ' + currentMediaSession.playerState + ' @ ' + currentMediaSession.currentTime);
  updateStatus();
  if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING) {
    song_id = currentMediaSession.currentItemId;
  }
});

onMediaDiscovery(function() {
  console.log('media discovered');
  updateStatus();
});

function dumpQueue() {
  console.log($.map(currentMediaSession.items, function(element) {
    return element.media.metadata.title;
  }));
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

function shuffleArray(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function shuffle(forced) {
  if (currentMediaSession && currentMediaSession.items && !forced) {
    var current_queue = $.map(currentMediaSession.items, function(element) {
      return element.itemId
    });
    shuffleArray(current_queue);

    var request = new chrome.cast.media.QueueReorderItemsRequest(current_queue);
    currentMediaSession.queueReorderItems(request);
  } else {
    var current_queue = $.map(tracks, function(track) { return track });
    shuffleArray(current_queue);
    queueAll(current_queue);
  }
}

function queueAll(trackList) {
  var queueOffset = 60;
  var initialized = false;
  var queueNext = function() {
    if (!initialized || (currentMediaSession && currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING)) {
      initialized = true;
      addTrack(trackList.shift());
    }

    if (trackList.length > 0 &&
        (!currentMediaSession || (currentMediaSession.items && currentMediaSession.items.length < (MAX_QUEUE_LENGTH - queueOffset)))) {
      setTimeout(queueNext, 500);
    }
  }

  queueNext();
}

function addTrackElement(track) {
  tracks[track.id] = track;
  playlist.append($('<li>').append(
    $('<a>').attr('href', '#' + track.id).append(
      $('<img>').attr('src', track.cover)).append(
      $('<p>').attr('class', 'title').append(track.name)).append(
      $('<p>').attr('class', 'album').append(track.album)
  )));
}

$.getJSON('/playlist/iliekpie/5rZsjxKt6W8Sw9j7DXH9bH', function(data) {
  for (var i = 0; i < data.count; i++) {
    addTrackElement(data.tracks[i]);
  }
});

playlist.on('click', 'a', function(e) {
  e.preventDefault();

  var id = $(this).attr('href').split('#')[1];

  console.log('Playing: ' + id)

  play(id);
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

$('#volume').change(function(level) {
  setVolume($(this).val());
});
