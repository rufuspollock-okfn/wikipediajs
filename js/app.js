jQuery(function() {
  var q = parseQueryString(window.location.search);
  if (q.url) {
    $('input[name="url"]').val(q.url);

    $('.loading').show();

    var display = function(info) {
      $('.loading').hide();
      $('.results').show();

      rawData = info.raw;
      var summaryInfo = info.summary;
      var properties = rawData[info.dbpediaUrl];

      for (key in summaryInfo) {
        $('.summary .' + key).text(summaryInfo[key]);
      }
      $('.summary .thumbnail').attr('src', summaryInfo.image);
      var dataAsJson = JSON.stringify(summaryInfo, null, '    ')
      $('.summary .raw').val(dataAsJson);

      // Raw Data Summary
      var count = 0;
      for (key in properties) {
        count += 1;
        $('.data-summary .properties').append(key + '\n');
      }
      $('.data-summary .count').text(count);

      // raw JSON
      var dataAsJson = JSON.stringify(rawData, null, '    ')
      $('.results-json').val(dataAsJson);

      $('html,body').animate({
        scrollTop: $('#demo').offset().top
        },
        'slow'
      );
    };

    WIKIPEDIA.getData(q.url, display, function(error) {
        alert(error);
      }
    );
  }

  $('.js-data-summary').click(function(e) {
    $('.data-summary').show();
  });
});

// TODO: search of wikipedia
// http://en.wikipedia.org/w/api.php?action=query&format=json&callback=test&list=search&srsearch=%richard%

// Parse a URL query string (?xyz=abc...) into a dictionary.
parseQueryString = function(q) {
  if (!q) {
    return {};
  }
  var urlParams = {},
    e, d = function (s) {
      return unescape(s.replace(/\+/g, " "));
    },
    r = /([^&=]+)=?([^&]*)/g;

  if (q && q.length && q[0] === '?') {
    q = q.slice(1);
  }
  while (e = r.exec(q)) {
    // TODO: have values be array as query string allow repetition of keys
    urlParams[d(e[1])] = d(e[2]);
  }
  return urlParams;
};
