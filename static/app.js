var playlist = $('#playlist');

function addTrack(track) {
  playlist.append($('<li>').append(
    $('<a>').attr('href', '#' + track.id).append(
      $('<img>').attr('src', track.cover)).append(
      $('<p>').attr('class', 'title').append(track.name)).append(
      $('<p>').attr('class', 'album').append(track.album)
  )));
}

$.getJSON('/playlist/iliekpie/5rZsjxKt6W8Sw9j7DXH9bH', function(data) {
  for (var i = 0; i < data.count; i++) {
    addTrack(data.tracks[i]);
  }
});

playlist.on('click', 'a', function(e) {
  e.preventDefault();

  source = $(this).attr('href').split('#')[1];

  console.log('Playing: ' + source)

  playTrack(source);
});