// Upload samples_gee.csv as a WGS84 point table before running.
var ASSET = 'projects/YOUR_PROJECT/assets/riverwatch_samples';
var START = '2023-11-01';
var END = '2024-05-01';  // Exclusive
var RADIUS_M = 25;      // Must match sample_radius_m in config.json
var NDWI_MIN = 0.05;

var points = ee.FeatureCollection(ASSET);
var scenes = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(points.geometry().bounds())
  .filterDate(START, END)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80))
  .sort('system:time_start');

var nested = scenes.toList(scenes.size().max(1)).map(function(item) {
  var im = ee.Image(item);
  var scl = im.select('SCL');
  var clear = scl.eq(4).or(scl.eq(5)).or(scl.eq(6));
  var water = im.normalizedDifference(['B3', 'B8']).gt(NDWI_MIN);
  var ndti = im.normalizedDifference(['B4', 'B3'])
      .rename('ndti').updateMask(clear.and(water));

  return points.filterBounds(im.geometry()).map(function(point) {
    var region = point.geometry().buffer(RADIUS_M);
    var stats = ndti.reduceRegion({
      reducer: ee.Reducer.median(),
      geometry: region, scale: 10, maxPixels: 1000
    });
    var count = ndti.reduceRegion({
      reducer: ee.Reducer.count(),
      geometry: region, scale: 10, maxPixels: 1000
    });
    return ee.Feature(null, {
      pair_id: point.get('pair_id'),
      side: point.get('side'),
      date: im.date().format('yyyy-MM-dd'),
      scene_id: im.get('system:index'),
      ndti: stats.get('ndti'),
      water_px: count.get('ndti'),
      radius_m: RADIUS_M
    });
  });
});

var rows = ee.FeatureCollection(nested).flatten()
    .filter(ee.Filter.notNull(['ndti', 'water_px']));
print('Sample points', points.size());
print('Candidate scenes', scenes.size());
Map.centerObject(points);
Map.addLayer(points, {color: 'cyan'}, 'Upstream/downstream samples');

Export.table.toDrive({
  collection: rows,
  description: 'riverwatch_obs',
  fileNamePrefix: 'riverwatch_obs',
  fileFormat: 'CSV',
  selectors: ['pair_id', 'side', 'date', 'scene_id', 'ndti', 'water_px', 'radius_m']
});
