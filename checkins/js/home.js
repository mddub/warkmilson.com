function showAlert(alert) {
  $('.bad-alert').html(alert).fadeIn();
}

function hideAlert() {
  $('.bad-alert').hide();
}

$(document).ready(function() {

  var form = $('#user-name-form');
  var working = false;

  form.submit(function(evt) {
    evt.preventDefault();

    if(working) return;

    var userName = $('#user-name').val();
    if(!userName) {
      showAlert('you should probably at least enter a name.');
      return;
    }

    working = true;
    $('.user-name-section').addClass('working');
    $('.alert-info').text('Loading...').fadeIn();

    $.getJSON('/exists/' + userName)
      .complete(function() {
        working = false;
        $('.user-name-section').removeClass('working');
        $('.alert-info').hide();
      })
      .error(function() { showAlert('oops, something broke.'); })
      .success(function(exists) {
        if(!exists) {
          showAlert("pretty sure that name doesn't exist, sorry.");
        } else {
          document.location = '/' + userName;
        }
      });
  });

});
