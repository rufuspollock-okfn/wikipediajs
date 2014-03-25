var WIKIPEDIA = function() {
  var my = {};

  // DBPedia SPARQL endpoint
  my.endpoint = 'http://dbpedia.org/sparql/';

  // ### getData
  //
  // Return structured information (via callback) on the provided Wikipedia URL by querying
  // the DBPedia SPARQL endpoint and then tidying the data up.
  //
  // @param: wikipediaUrlOrPageName. A wikipedia URL or pageName or an object
  // with following struture:
  //
  //     {
  //       url: wikipediaURLOrPageName,
  //       raw: false // do not include the raw data in what is returned
  //     }
  //
  // @return: Data is return in the form of the following hash:
  //
  //    {
  //      raw: the-raw-json-from-dbpedia,
  //      summary: a-cleaned-up-set-of-the-properties (see extractSummary),
  //      dbpediaUrl: dbpedia-resource-url e.g. http://dbpedia.org/resource/World_War_II
  //    }
  //
  // Function is asynchronous as we have to call out to DBPedia to get the
  // info.
  my.getData = function(wikipediaUrlOrPageName, callback, error) {
    var url = my._getDbpediaUrl(wikipediaUrlOrPageName);
    function onSuccess(data) {
      var out = {
        raw: data,
        dbpediaUrl: url,
        summary: null
      };
      if (data) {
        out.summary = my.extractSummary(url, data);
      } else {
        out.error = 'Failed to retrieve data. Is the URL or page name correct?';
      }
      callback(out);
    }
    my.getRawJson(url, onSuccess, error);
  };

  // ### _getDbpediaUrl
  //
  // Convert the incoming URL or page name to a DBPedia url
  my._getDbpediaUrl = function(url) {
    if (url.indexOf('wikipedia')!=-1) {
      var parts = url.split('/');
      var title = parts[parts.length-1];
      url = 'http://dbpedia.org/resource/' + title;
      return url;
    } else if (url.indexOf('dbpedia.org')!=-1) {
      return url;
    } else {
      url = 'http://dbpedia.org/resource/' + url.replace(/ /g, '_');
      return url;
    }
  };

  // ### getRawJson
  //
  // get raw RDF JSON for DBPedia resource from DBPedia SPARQL endpoint
  my.getRawJson = function(url, callback, error) {
    var sparqlQuery = 'DESCRIBE <{{url}}>'.replace('{{url}}', url);
    var jqxhr = $.ajax({
      url: my.endpoint,
      data: {
        query: sparqlQuery,
        // format: 'application/x-json+ld'
        format: 'application/rdf+json'
      },
      dataType: 'json',
      success: callback,
      error: error
    });
  };

  // Standard RDF namespace prefixes for use in lookupProperty function
  my.PREFIX = {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/terms/",
    foaf: "http://xmlns.com/foaf/0.1/",
    vcard: "http://www.w3.org/2006/vcard/ns#",
    dbp: "http://dbpedia.org/property/",
    dbo: "http://dbpedia.org/ontology/",
    geo: "http://www.geonames.org/ontology#",
    wgs: "http://www.w3.org/2003/01/geo/wgs84_pos#"
  };

  my._expandNamespacePrefix = function(uriWithPrefix) {
    for(var key in WIKIPEDIA.PREFIX) {
      if (uriWithPrefix.indexOf(key + ':') === 0) {
        uriWithPrefix = WIKIPEDIA.PREFIX[key] + uriWithPrefix.slice(key.length + 1);
      }
    }
    return uriWithPrefix;
  };

  // ### lookupProperty
  // 
  // lookup a property value given a standard RDF/JSON property dictionary
  // e.g. something like ...
  // 
  //       ...
  //       "http://dbpedia.org/property/regent": [
  //              {
  //                  "type": "uri",
  //                  "value": "http://dbpedia.org/resource/Richard_I_of_England"
  //              }
  //          ],
  //       ...
  my._lookupProperty = function(dict, property) {
    property = my._expandNamespacePrefix(property);
    var values = dict[property];
    for (var idx in values) {
      // only take english values if lang is present
      if (!values[idx]['lang'] || values[idx].lang == 'en') {
        return values[idx].value;
      }
    }
  };

  // Extract a standard set of attributes (e.g. title, description, dates etc
  // etc) from rdfJson and the given subject uri (url) e.g.
  // 
  //      extractSummary('http://dbpedia.org/resource/Rufus_Pollock', rdfJson object from dbpedia)
  my.extractSummary = function(subjectUri, rdfJson) {
    var properties = rdfJson[subjectUri];
    function lkup(attribs) {
      if (attribs instanceof Array) {
        var out = [];
        for (var idx in attribs) {
          var _tmp = my._lookupProperty(properties, attribs[idx]);
          if (_tmp) {
            out.push(_tmp);
          }
        }
        return out;
      } else {
        return my._lookupProperty(properties, attribs);
      }
    }

    var summaryInfo = {
      title: lkup('rdfs:label'),
      description: lkup('dbo:abstract'),
      summary: lkup('rdfs:comment'),
      startDates: lkup(['dbo:birthDate', 'dbo:formationDate', 'dbo:foundingYear']),
      endDates: lkup('dbo:deathDate'),
      // both dbp:date and dbo:date are usually present but dbp:date is
      // frequently "bad" (e.g. just a single integer rather than a date)
      // whereas ontology value is better
      date: lkup('dbo:date'),
      place: lkup('dbp:place'),
      birthPlace: lkup('dbo:birthPlace'),
      deathPlace: lkup('dbo:deathPlace'),
      source: lkup('foaf:page'),
      images: lkup(['dbo:thumbnail', 'foaf:depiction', 'foaf:img']),
      location: {
        lat: lkup('wgs:lat'),
        lon: lkup('wgs:long')
      },
      types: [],
      type: null
    };

    // getLastPartOfUrl
    function gl(url) {
      var parts = url.split('/');
      return parts[parts.length-1];
    }

    var typeUri = my._expandNamespacePrefix('rdf:type');
    var types = [];
    var typeObjs = properties[typeUri];
    for(var idx in typeObjs) {
      var value = typeObjs[idx].value;
      // let's be selective
      // ignore yago and owl stuff
      if (value.indexOf('dbpedia.org/ontology') != -1 || value.indexOf('schema.org') != -1 || value.indexOf('foaf/0.1') != -1) {
        // TODO: ensure uniqueness (do not push same thing ...)
        summaryInfo.types.push(gl(value));
        // use schema.org value as the default
        if (value.indexOf('schema.org') != -1) {
          summaryInfo.type = gl(value);
        }
      }
    }
    if (!summaryInfo.type && summaryInfo.types.length > 0) {
      summaryInfo.type = summaryInfo.types[0];
    }

    summaryInfo.start = summaryInfo.startDates.length > 0 ? summaryInfo.startDates[0] : summaryInfo.date;
    summaryInfo.end = summaryInfo.endDates;
    if (!summaryInfo.place) {
      // death place is more likely more significant than death place
      summaryInfo.place = summaryInfo.deathPlace || summaryInfo.birthPlace;
    }
    // if place a uri clean it up ...
    if (summaryInfo.place) {
      summaryInfo.place = gl(summaryInfo.place);
    }
    summaryInfo.location.title = summaryInfo.place;
    summaryInfo.image = summaryInfo.images ? summaryInfo.images[0] : null;

    return summaryInfo;
  };

  return my;
}();
