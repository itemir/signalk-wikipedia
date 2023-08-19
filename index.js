/*
 * Copyright 2023 Ilker Temir <ilker@ilkertemir.com>
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const request = require('request');
const poiKey = 'pointsOfInterest.wikipedia';
userAgent = 'Signal K Wikipedia Plugin';
const checkEveryNMinutes = 15;

module.exports = function(app) {
  var plugin = {};
  var pois = {};

  plugin.id = "wikipedia";
  plugin.name = "Wikipedia";
  plugin.description = "Publishes Wikipedia Points of Interest";

  plugin.start = function(options) {
    // Position data is not immediately available, delay it
    setTimeout( function() {
      checkAndPublishPois();
    }, 8000);

    setInterval( function() {
      checkAndPublishPois();
    }, checkEveryNMinutes * 60 * 1000);
  }

  plugin.stop =  function() {
  };

  plugin.schema = {
    type: 'object',
    required: [],
    properties: {
    }
  }

  function checkAndPublishPois() {
    let position = app.getSelfPath('navigation.position');
    if (!position) {
      app.debug(JSON.stringify(position));
      return;
    }
    let lat = position.value.latitude;
    let lng = position.value.longitude;
    retrievePois(lat,lng);
  }

  function emitSignalKMessage(poi) {
    let poiData = {
      name: poi.name,
      position: poi.position,
      notes: poi.notes,
      type: '', // We don't have type for Wikipedia locations
      url: poi.url,
    }
    let values = [{
         path: `${poiKey}.${poi.id}`,
         value: poiData
    }]
    app.handleMessage(plugin.id, {
       updates: [
         {
           values: values
         }
       ]
    });
   }

   function retrievePoiDetails(poi) {
    if (poi.pageid in pois) {
      app.debug(`POI details for ID ${poi.pageid} already known, used cached values`);
      emitSignalKMessage(pois[poi.pageid]);
      return;
    }
    app.debug(`Retrieving POI details for ID ${poi.pageid} and will cache`);
    let url=`https://en.wikipedia.org/w/api.php`;
    request.get({
      url: url,
      json: true,
      headers: {
        'User-Agent': userAgent,
      },
      qs: {
        'action': 'query',
        'format': 'json',
        'prop': 'extracts',
        'exlimit': 'max',
        'exintro': true,
        'pageids': poi.pageid
      }
    }, function(error, response, data) {
      if (!error && response.statusCode == 200) {
        if ((!data.query) || (!data.query.pages) || (!data.query.pages[poi.pageid])) {
          app.debug(`Cannot decode response for POI ${poi.pageid}: ${JSON.stringify(data)}`);
          return;
        }

        pois[poi.pageid] = {
          id: poi.pageid,
          name: data.query.pages[poi.pageid].title,
          position: {
            latitude: poi.lat,
            longitude: poi.lon
          },
          notes: data.query.pages[poi.pageid].extract,
          url: `https://en.wikipedia.org/wiki?curid=${poi.pageid}`
        }
        emitSignalKMessage(pois[poi.pageid]);
        app.debug(`Published details for POI ${poi.pageid}`);
      } else {
        app.debug(`Error retrieving ${url}: ${JSON.stringify(response)}`);
      }
    });
  }

  function retrievePois(lat, lng) {
    let url=`https://en.wikipedia.org/w/api.php`;
    // Calculate the coordinates of the "box" that we will use to retrieve the POIs
    // This is a rectangle with X diagonal length
    const radius = 20;
    const nCoords = calculateNewPosition(lat, lng, 0, radius);
    const nwCoords = calculateNewPosition(lat, lng, -45, radius);
    const wCoords = calculateNewPosition(lat, lng, -90, radius);
    const swCoords = calculateNewPosition(lat, lng, -135, radius);
    const sCoords = calculateNewPosition(lat, lng, 180, radius);
    const seCoords = calculateNewPosition(lat, lng, 135, radius);
    const eCoords = calculateNewPosition(lat, lng, 90, radius);
    const neCoords = calculateNewPosition(lat, lng, 45, radius);

    // Wikipedia only allows a 10km radius search, this extends it a bit
    const coordinates = [
      { latitude: lat,
        longitude: lng },
      { latitude: nCoords.latitude,
        longitude: nCoords.longitude },
      { latitude: nwCoords.latitude,
        longitude: nwCoords.longitude },
      { latitude: wCoords.latitude,
        longitude: wCoords.longitude },
      { latitude: swCoords.latitude,
        longitude: swCoords.longitude },
      { latitude: sCoords.latitude,
        longitude: sCoords.longitude },
      { latitude: seCoords.latitude,
        longitude: seCoords.longitude },
      { latitude: eCoords.latitude,
        longitude: eCoords.longitude },
      { latitude: neCoords.latitude,
        longitude: neCoords.longitude }
    ];
    coordinates.map( coord => { 
      request.get({
        url: url,
        json: true,
        headers: {
          'User-Agent': userAgent,
        },
        qs: {
          'action': 'query',
  	  'format': 'json',
	  'list': 'geosearch',
	  'formatversion': 2,
          //'gsbbox': `${nwCoords.latitude}|${nwCoords.longitude}|${seCoords.latitude}|${seCoords.longitude}`,
	  'gscoord': `${coord.latitude}|${coord.longitude}`,
	  'gsradius': 10000, // 10km
	  'gslimit': 100
        }
      }, function(error, response, data) {
        if (!error && response.statusCode == 200) {
          app.debug(`POIs received ${JSON.stringify(data)}`);
          if ((!data.query) || (!data.query.geosearch)) {
            return;
          }
          data.query.geosearch.map( poiSummary => {
            retrievePoiDetails(poiSummary); 
          });
        } else {
          app.debug(`Error retrieving stations ${JSON.stringify(response)}`);
        }
      });
    });
  }

  function calculateNewPosition(latitude, longitude, bearing, distance) {
    const earthRadius = 6371; // Radius of the Earth in kilometers
    const latitudeRad = toRadians(latitude);
    const longitudeRad = toRadians(longitude);
    const bearingRad = toRadians(bearing);

    const newLatitudeRad = Math.asin(Math.sin(latitudeRad) * Math.cos(distance / earthRadius) +
      Math.cos(latitudeRad) * Math.sin(distance / earthRadius) * Math.cos(bearingRad));

    const newLongitudeRad = longitudeRad + Math.atan2(Math.sin(bearingRad) * Math.sin(distance / earthRadius) * Math.cos(latitudeRad),
      Math.cos(distance / earthRadius) - Math.sin(latitudeRad) * Math.sin(newLatitudeRad));

    const newLatitude = toDegrees(newLatitudeRad);
    const newLongitude = toDegrees(newLongitudeRad);

    return { latitude: newLatitude, longitude: newLongitude };
  }

  function toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  function toDegrees(radians) {
    return radians * 180 / Math.PI;
  }

  return plugin;
}
