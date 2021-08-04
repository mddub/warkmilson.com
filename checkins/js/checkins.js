var page;

function loadCheckins(url, title) {

  $(document).ready(function() {

    $.getJSON(url)
      .error(function() {
        $('.alert').removeClass('alert-info').text('oops, something went wrong.');
      })
      .success(function(data) {
        initPage(data, title);
      });

  });

}

function initPage(data, title) {
  //TODO use events instead of this global
  page = new Page($('.container'));
  var checkins = Checkins.fromRawData(data, title);
  page.update(checkins);
  $('.container.loading').fadeOut(function() {
    $('.container.main').fadeIn();
  });
}
