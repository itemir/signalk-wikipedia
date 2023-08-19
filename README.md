# NOAA Observations

Publishes nearby points of interest (POI) from Wikipedia under `pointsOfInterest.wikipedia.{id}`. Here is an example:

```
{
  "name": "Broughton Archipelago",
  "position": {
    "latitude": 50.666666666666664,
    "longitude": -126.5
  },
  "notes": "<p class=\"mw-empty-elt\">\n</p>\n<p><b>Broughton Archipelago</b> is a group of islands located at the eastern end of Queen Charlotte Strait in Mount Waddington Regional District, British Columbia. The archipelago is the traditional territory of the Musgamagw Dzawada'enuxw, Namgis, Ma'amtagila and Tlowitsis nations of the Kwakwaka'wakw peoples.\n</p>",
  "type": "",
  "url": "https://en.wikipedia.org/wiki?curid=10915310"
}
```

POIs are searched within roughly 50km radius of the current location.
