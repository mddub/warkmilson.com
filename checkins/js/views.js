function showHovercard(el, title, items) {
  var hovercard = $('.hovercard');
  hovercard.find('.title').html(title);

  hovercard.find('ul').html(_.map(items, function(item) {
    return '<li>' + item + '</li>';
  }));

  hovercard
    .css('left', el.offset()['left'] + (el.width() || parseInt(el.attr('width'), 10)) / 2)
    .css('top', el.offset()['top'] - hovercard.height() - 8);

  hovercard.show();
}

function hideHovercard() {
  $('.hovercard').hide();
}

var Page = function(container) {
  this.container = container;

  this.filterUpLinks = container.find('.filter-up-links');
  this.title = container.find('.title');
  this.summaryBox = container.find('.summary');

  this.stack = [];

  this.venuesBox = new VenuesBox(container.find('.venues'));
  this.timeGrid = new TimeGrid(container.find('.time-grid'));
  this.calendar = new Calendar(container.find('.calendar'));

  this.container.delegate('.filter-up', 'click', this.filterUpClick.bind(this));
};

Page.prototype.summaryTemplate = _.template('<%= total %> checkins from <%= start %> to <%= end %>');
Page.prototype.summaryTemplateSingular = _.template('1 checkin on <%= start %>');

Page.prototype.filterUpTemplate = _.template($('#filter-up-template').html());

Page.prototype.filterDownAttempt = function(filterType, key) {
  var canFilter = !this.checkins.hasFilter(filterType);
  if(filterType === FilterTypes.WEEKDAY_AND_HOUR &&
      this.checkins.hasFilter(FilterTypes.WEEKDAY) &&
      this.checkins.hasFilter(FilterTypes.HOUR))
    canFilter = false;
  if(this.checkins.hasFilter(FilterTypes.WEEKDAY_AND_HOUR) &&
      (filterType === FilterTypes.WEEKDAY || filterType === FilterTypes.HOUR))
    canFilter = false;

  if(canFilter) {
    var filtered = this.checkins.filter(filterType, key);
    if(filtered.count)
      this.filterDown(filtered);
  }
};

Page.prototype.filterDown = function(checkins) {
  this.stack.push(this.checkins);
  this.filterUpLinks.append(
    this.filterUpTemplate({
      name: this.checkins.title,
      index: this.stack.length - 1
    })
  );

  this.update(checkins);
};

Page.prototype.filterUpClick = function(evt) {
  evt.preventDefault();
  var index = parseInt($(evt.currentTarget).data('index'), 10);
  var checkins;
  while(this.stack.length > index) {
    checkins = this.stack.pop();
    this.filterUpLinks.find('.filter-up').last().remove();
  }
  this.update(checkins);
};

Page.prototype.update = function(checkins) {
  this.checkins = checkins;

  this.title.html(checkins.title);
  var template = checkins.count === 1 ? this.summaryTemplateSingular : this.summaryTemplate;
  this.summaryBox.text(template({
    total: checkins.count,
    start: d3.time.format('%B %e, %Y')(checkins.minDate),
    end: d3.time.format('%B %e, %Y')(checkins.maxDate)
  }));

  this.venuesBox.update(checkins);
  this.timeGrid.update(checkins);
  this.calendar.update(checkins);
};

var VenuesBox = function(container) {
  this.firstRows = container.find('.first-rows');
  this.restRows = container.find('.rest-rows');
  this.viewAll = container.find('.view-all');
  this.viewLess = container.find('.view-less');

  this.chooserLinks = $('.chooser-links');

  this.viewAll.click(function() {
    this.restRows.fadeIn();
    this.viewAll.hide();
    this.viewLess.show();
  }.bind(this));

  this.viewLess.click(function() {
    this.viewLess.hide();
    this.restRows.fadeOut(function() {
      this.viewAll.fadeIn();
    }.bind(this));
  }.bind(this));

  this.chooserLinks.delegate('span', 'click', this.chooserClick.bind(this));
};

VenuesBox.prototype.mode = 'byCity';
VenuesBox.prototype.rowTemplate = _.template($('#top-row-template').html());

VenuesBox.prototype.modeToFilter = {
  'byVenue': FilterTypes.VENUE,
  'byCity': FilterTypes.CITY,
  'byCategory': FilterTypes.CATEGORY
};

VenuesBox.prototype.chooserClick = function(evt) {
  evt.preventDefault();
  var clicked = $(evt.currentTarget);
  if(clicked.data('mode') !== this.mode) {
    this.mode = clicked.data('mode');
    this.update(this.checkins, true);
  }
};

VenuesBox.prototype.makeRow = function(venuePair, maxCount) {
  var name;
  if(this.mode === 'byVenue')
    name = this.checkins.venueById[venuePair[0]]['name'];
  else
    name = venuePair[0];

  return $(this.rowTemplate({
    proportion: 1.0 * venuePair[1].length / maxCount,
    count: venuePair[1].length,
    name: name
  }));
};

VenuesBox.prototype.update = function(checkins, wasChooserClick) {
  this.checkins = checkins;

  if(!wasChooserClick) {
    // switch to the other dimension with the most choices
    // which has not yet been filtered on
    var modes = ['byVenue', 'byCategory', 'byCity'];
    var newMode = _.find(modes, function(m) {
      return !checkins.hasFilter(this.modeToFilter[m]);
    }.bind(this)) || 'byVenue';

    _.each(modes, function(otherMode) {
      if(_.keys(checkins[otherMode]).length > _.keys(checkins[newMode]).length &&
          otherMode !== this.mode)
        newMode = otherMode;
    }.bind(this));

    this.mode = newMode;
  }

  this.venuePairs = _.sortBy(_.pairs(checkins[this.mode]), function(pair) { return -1 * pair[1].length; });
  this.maxCount = _.max(_.map(_.values(checkins[this.mode]), function(cis) { return cis.length; }));

  this.render();
};

VenuesBox.prototype.render = function() {
  this.chooserLinks.find('span').removeClass('active');
  this.chooserLinks.find('[data-mode=' + this.mode + ']').addClass('active');

  this.firstRows.empty();
  this.restRows.empty().hide();
  this.viewLess.hide();

  _.each(this.venuePairs, function(venuePair, i) {
    var row = this.makeRow(venuePair, this.maxCount);

    var target = i < 10 ? this.firstRows : this.restRows;
    target.append(row);

    row.click(function() {
      if(this.mode === 'byVenue')
        //TODO just trigger an event
        page.filterDownAttempt(FilterTypes.VENUE, venuePair[0]);
      else if(this.mode === 'byCategory')
        page.filterDownAttempt(FilterTypes.CATEGORY, venuePair[0]);
      else if(this.mode === 'byCity')
        page.filterDownAttempt(FilterTypes.CITY, venuePair[0]);
    }.bind(this));
  }.bind(this));

  this.viewAll.toggle(this.venuePairs.length > 10);
};

var TimeGrid = function(container) {
  this.container = container;
  this.hoursFine = true;
  this.hourSegments = d3.range(24);

  this.boxes = {};

  this.drawAndBind();

  $('.hour-finer').click(this.hoursFiner.bind(this));
  $('.hour-less-fine').click(this.hoursLessFine.bind(this));
};

TimeGrid.prototype.drawAndBind = function() {
  this.container.empty();

  this.container.append('<span class="box">');
  _.each(this.hourSegments, function(seg) {
    this.container.append($(
      '<span class="box filter-hour" data-hour="' + seg + '">' +
      (this.hoursFine ? (seg % 12 || 12) : hourDescFromKey(seg)) +
      '</span>'
	));
  }.bind(this));
  this.container.append('<br>');

  for(var weekday = 0; weekday < 7; weekday++) {
    this.container.append(
      $('<span class="box filter-weekday" data-weekday="' + weekday + '">' + ['Su','M','T','W','Th','F','Sa'][weekday] + '</span>')
    );
    this.boxes[weekday] = {};
    _.each(this.hourSegments, function(seg) {
      var box = $('<span class="box filter-weekday-hour filled">');
      this.container.append(box);
      this.boxes[weekday][seg] = box;
      (function(weekday, seg) {
        box.click(function() {
          page.filterDownAttempt(FilterTypes.WEEKDAY_AND_HOUR, [weekday, seg]);
        });
      })(weekday, seg);
    }.bind(this));
    this.container.append('<br>');
  }

  //TODO trigger event
  this.container.find('.filter-weekday').click(function(evt) {
    page.filterDownAttempt(FilterTypes.WEEKDAY, $(evt.currentTarget).data('weekday'));
  }.bind(this));

  this.container.find('.filter-hour').click(function(evt) {
    page.filterDownAttempt(FilterTypes.HOUR, $(evt.currentTarget).data('hour'));
  }.bind(this));
};

TimeGrid.prototype.update = function(checkins) {
  this.checkins = checkins;

  this.max = 0;
  for(var weekday = 0; weekday < 7; weekday++) {
    _.each(this.hourSegments, function(hourSeg) {
      this.max = Math.max(this.max, checkins.byWeekdayAndHour[weekday][hourSeg].length);
    }.bind(this));
  }

  this.render();
};

TimeGrid.prototype.render = function() {
  this.container.toggleClass('weekdays-filtered',
    this.checkins.hasFilter(FilterTypes.WEEKDAY) || this.checkins.hasFilter(FilterTypes.WEEKDAY_AND_HOUR));
  this.container.toggleClass('hours-filtered', this.checkins.hasFilter(FilterTypes.HOUR) || this.checkins.hasFilter(FilterTypes.WEEKDAY_AND_HOUR));

  for(var weekday = 0; weekday < 7; weekday++) {
    _.each(this.hourSegments, function(hourSeg) {
      this.boxes[weekday][hourSeg].removeClass('v0 v1 v2 v3 v4 v5 v6 v7 v8');
      this.boxes[weekday][hourSeg].addClass('v' + Math.ceil(8.0 * this.checkins.byWeekdayAndHour[weekday][hourSeg].length / this.max));
    }.bind(this));
  }
};

TimeGrid.prototype.hoursLessFine = function() {
  if(!this.hoursFine || this.checkins.hasFilter(FilterTypes.HOUR))
    return;

  this.hourSegments = wideHours;
  this.hoursFine = false;
  this.container.addClass('wide-hours');
  $('.toggle-hour-fine').addClass('wide-hours');
  this.drawAndBind();
  this.update(this.checkins);
};

TimeGrid.prototype.hoursFiner = function() {
  if(this.hoursFine || this.checkins.hasFilter(FilterTypes.HOUR))
    return;

  this.hourSegments = d3.range(24);
  this.hoursFine = true;
  this.container.removeClass('wide-hours');
  $('.toggle-hour-fine').removeClass('wide-hours');
  this.drawAndBind();
  this.update(this.checkins);
};

var Calendar = function(container) {
  this.container = container;
};

Calendar.prototype.monthTemplate = $('#month-template').html();

Calendar.prototype.update = function(checkins) {
  this.checkins = checkins;
  this.render();
};

Calendar.prototype.render = function() {
  this.container.toggleClass('months-filtered', this.checkins.hasFilter(FilterTypes.MONTH));
  this.container.empty();

  // add some leading space so the months are aligned in 6-month chunks
  var dummyMonths = this.checkins.minDate.getMonth() % 6;
  for(var i = 0; i < dummyMonths; i++) {
    this.container.append(this.makeMonth(new Date()).css('visibility', 'hidden'));
  }

  _.each(d3.time.months(d3.time.month(this.checkins.minDate), this.checkins.maxDate), function(month) {
    this.container.append(this.makeMonth(month));
  }.bind(this));
};

Calendar.prototype.makeMonth = function(start) {
  var dayCellSize = 14;
  var dayCellSpacing = 2;

  var day = d3.time.format('%w');
  var week = d3.time.format('%U');

  var div = $(this.monthTemplate);

  div.find('.month-name')
    .text(d3.time.format("%b %Y")(start))
    .click(function() {
      page.filterDownAttempt(FilterTypes.MONTH, start);
    });

  var svg = div.find('svg')[0];

  $(svg).attr({
    height: 6 * (dayCellSize + dayCellSpacing),
    width: 7 * (dayCellSize + dayCellSpacing)
  });

  var firstWeek = week(start);
  var r = d3.select(svg).selectAll('g')
    .data(d3.time.days(start, d3.time.month.offset(start, 1)));

  r.enter().append('g')
    .attr('transform', function(d) {
      return 'translate(' +
        (day(d)) * (dayCellSize + dayCellSpacing) +
        ', ' +
        (week(d) - firstWeek) * (dayCellSize + dayCellSpacing) +
        ')';
    });

  d3.select(svg).selectAll('g').append('rect')
    .attr('width', dayCellSize)
    .attr('height', dayCellSize)
    .datum(function(d) { return d; });

  d3.select(svg).selectAll('rect')
    .attr('class', function(d) {
      return 'v' + (this.checkins.byDate[d] ? Math.min(4, this.checkins.byDate[d].length) : 0);
    }.bind(this));

  div.find('rect').mouseenter(function(evt) {
    var date = d3.select(evt.currentTarget).datum();
    var checkins = this.checkins.byDate[date];
    if(checkins) {
      showHovercard(
        $(evt.currentTarget),
        d3.time.format('%a %b %d %Y')(date),
        _.map(this.checkins.byDate[date], function(checkin) {
          return d3.time.format('%I:%M %p')(checkin.time) + ' ' + checkin['venue']['name'];
        })
      );
    }
  }.bind(this));

  div.find('rect').mouseleave(hideHovercard);

  return div;
};
