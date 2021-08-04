var FilterTypes = {
  VENUE: 0,
  CATEGORY: 1,
  CITY: 2,
  WEEKDAY: 3,
  HOUR: 4,
  MONTH: 5,
  WEEKDAY_AND_HOUR: 6
};

var wideHours = _.map(d3.range(0, 24, 3), function(i) { return i + '-' + (i+3); });

function hourDescFromKey(key) {
  var hour;
  if(typeof key === 'number') {
    hour = key % 12 || 12;
    var desc = hour + '-' + (hour + 1) % 12 + (key < 12 ? 'a' : 'p');
    if(key === 11)
      desc = '11a-12p';
    else if(key === 23)
      desc = '11p-12a';
    return desc;
  } else {
    hour = parseInt(key.substr(0, key.indexOf('-')), 10);
    if(hour === 0)
      return '12-3a';
    else if(hour === 9)
      return '9a-12p';
    else if(hour === 21)
      return '9p-12a';
    else {
      var shortHour = hour % 12 || 12;
      return shortHour + '-' + ((hour + 3) % 12) + (hour < 12 ? 'a' : 'p');
    }
  }
}

function Checkin(raw) {
  this.time = new Date(raw['createdAt'] * 1000);
  this.id = raw['id'];
  this.venue = raw['venue'];
}

function addToList(obj, key, val) {
  obj[key] = obj[key] || [];
  obj[key].push(val);
}

var Checkins = function(checkins, title, filters) {
  this.all = checkins;
  this.title = title;
  this.filters = filters || [];

  this.venueById = {};

  this.byDate = {};
  this.byWeekday = {};
  this.byHour = {};
  this.byWeekdayAndHour = {};
  this.byVenue = {};
  this.byCity = {};
  this.byCategory = {};
  this.byMonth = {};

  this.byWeekdayAndHour = (function() {
    var wh = {};
    _.each(d3.range(7), function(weekday) {
      wh[weekday] = {};
      _.each(d3.range(24), function(hour) {
        wh[weekday][hour] = [];
      });
      _.each(wideHours, function(hourSeg) {
        wh[weekday][hourSeg] = [];
      });
    });
    return wh;
  })();

  this.minDate = new Date(2100, 0, 1);
  this.maxDate = new Date(1900, 0, 1);
  this.count = 0;

  _.each(this.all, function(ci) {

  // _.groupBy
  addToList(this.byDate, d3.time.day(ci.time), ci);
  addToList(this.byMonth, d3.time.month(ci.time), ci);
  addToList(this.byWeekday, ci.time.getDay(), ci);
	var hour = ci.time.getHours();
	var hourSegment = 3 * Math.floor(hour / 3) + '-' + (3 * Math.floor(hour / 3) + 3);
  addToList(this.byHour, hour, ci);
  addToList(this.byHour, hourSegment, ci);
  this.byWeekdayAndHour[ci.time.getDay()][hour].push(ci);
  this.byWeekdayAndHour[ci.time.getDay()][hourSegment].push(ci);

  if(ci.venue) {
    addToList(this.byVenue, ci.venue['id'], ci);

    if(!this.venueById[ci.venue['id']])
      this.venueById[ci.venue['id']] = ci.venue;

    addToList(this.byCity, ci.venue['location']['city'] + ', ' + ci.venue['location']['state'], ci);

    // apparently some venues don't have any categories
    // TODO use 'primary' key
    if(ci.venue['categories'] && ci.venue['categories'].length)
      addToList(this.byCategory, ci.venue['categories'][0]['name'], ci);
  }

  // can't use _.keys because it casts dates to strings
  if(ci.time < this.minDate)
    this.minDate = ci.time;
  if(ci.time > this.maxDate)
    this.maxDate = ci.time;

  }.bind(this));

  this.count = this.all ? this.all.length : 0;
};

Checkins.fromRawData = function(raw, title) {
  return new Checkins(
    _.map(raw, function(raw) { return new Checkin(raw); }),
    title
  );
};

Checkins.prototype.filter = function(filterType, key) {
  if(filterType === FilterTypes.VENUE) {
    return new Checkins(
      this.byVenue[key],
      this.venueById[key]['name'],
      _.clone(this.filters).concat([filterType])
    );
  } else if(filterType === FilterTypes.CATEGORY) {
    return new Checkins(
      this.byCategory[key],
      key,
      _.clone(this.filters).concat([filterType])
    );
  } else if(filterType === FilterTypes.CITY) {
    return new Checkins(
      this.byCity[key],
      key,
      _.clone(this.filters).concat([filterType])
    );
  } else if(filterType === FilterTypes.WEEKDAY) {
    return new Checkins(
      this.byWeekday[key],
      ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][key],
      _.clone(this.filters).concat([filterType])
    );
  } else if(filterType === FilterTypes.HOUR) {
    return new Checkins(
      this.byHour[key],
      hourDescFromKey(key) + ' PST',
      _.clone(this.filters).concat([filterType])
    );
  } else if(filterType === FilterTypes.WEEKDAY_AND_HOUR) {
    var weekdayKey = key[0];
    var hourKey = key[1];
    return new Checkins(
      this.byWeekdayAndHour[weekdayKey][hourKey],
      ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][weekdayKey] + ' ' + hourDescFromKey(hourKey) + ' PST',
      _.clone(this.filters).concat([filterType])
    );
  } else if(filterType === FilterTypes.MONTH) {
    return new Checkins(
      this.byMonth[key],
      d3.time.format('%B %Y')(key),
      _.clone(this.filters).concat([filterType])
    );
  }
};

Checkins.prototype.hasFilter = function(filterType) {
  return _.indexOf(this.filters, filterType) !== -1;
};
