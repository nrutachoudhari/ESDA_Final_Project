// Google Earth Engine Script
// Export MODIS Land Cover (MCD12Q1) for Maranhão, Brazil
// Years: 2001-2024 (MODIS data starts in 2001, no 2000 available)

// Defining Maranhão boundary using EXACT coordinates from GADM shapefile
// Maranhão bounds (EPSG:4326): -48.755, -10.262, -41.796, -1.049
var maranhao = ee.Geometry.Rectangle([-48.75515073699995, -10.261764701999937, 
                                       -41.796069069999874, -1.0493281209999736]);

// Center map on Maranhão
Map.centerObject(maranhao, 7);
Map.addLayer(ee.Image().paint(maranhao, 0, 2), {palette: 'red'}, 'Maranhão Boundary', true);

// Load MCD12Q1 data (LC_Type1 = IGBP classification)
// NOTE: MODIS data starts in 2001, not 2000
var mcd12 = ee.ImageCollection('MODIS/061/MCD12Q1')
  .select('LC_Type1')
  .filterDate('2001-01-01', '2024-12-31');

print('Total images available:', mcd12.size());
print('NOTE: MODIS MCD12Q1 starts in 2001 (no 2000 data available)');

// Test: Show 2020 land cover
var lc2020 = mcd12.filter(ee.Filter.calendarRange(2020, 2020, 'year'))
  .first()
  .clip(maranhao);

var lcVis = {
  min: 1, max: 17,
  palette: ['05450a', '086a10', '54a708', '78d203', '009900', 'c6b044', 
            'dcd159', 'dade48', 'fbff13', 'b6ff05', '27ff87', 'c24f44', 
            'a5a5a5', 'ff6d4c', '69fff8', 'f9ffa4', '1c0dff']
};
Map.addLayer(lc2020, lcVis, 'Land Cover 2020', true);

// Check what land cover classes exist
print('Checking problematic years:');
var problematicYears = [2007, 2013, 2016, 2020];

function analyzeLandCover(year) {
  var image = mcd12.filter(ee.Filter.calendarRange(year, year, 'year'))
    .first()
    .clip(maranhao);
  
  // Get histogram of land cover classes
  var histogram = image.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: maranhao,
    scale: 500,
    maxPixels: 1e13
  });
  
  print('Year ' + year + ' - Land Cover Classes:', histogram.get('LC_Type1'));
  
  // Calculate forest area (classes 1-5)
  var forest = image.gte(1).and(image.lte(5));
  
  var forestStats = forest.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: maranhao,
    scale: 500,
    maxPixels: 1e13
  });
  
  // Each pixel is 500m x 500m = 0.25 km²
  var forestPixelCount = ee.Number(forestStats.get('LC_Type1'));
  var forestAreaKm2 = forestPixelCount.multiply(0.25);
  
  print('Year ' + year + ' - Forest pixels:', forestPixelCount);
  print('Year ' + year + ' - Forest area (km²):', forestAreaKm2);
  
  // Calculate savanna/shrub (classes 6-9)
  var savanna = image.gte(6).and(image.lte(9));
  var savannaStats = savanna.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: maranhao,
    scale: 500,
    maxPixels: 1e13
  });
  var savannaAreaKm2 = ee.Number(savannaStats.get('LC_Type1')).multiply(0.25);
  print('Year ' + year + ' - Savanna/Shrub area (km²):', savannaAreaKm2);
  
  // Calculate agriculture (class 12, 14)
  var cropland = image.eq(12).or(image.eq(14));
  var cropStats = cropland.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: maranhao,
    scale: 500,
    maxPixels: 1e13
  });
  var cropAreaKm2 = ee.Number(cropStats.get('LC_Type1')).multiply(0.25);
  print('Year ' + year + ' - Agriculture area (km²):', cropAreaKm2);
}

// Analyze key years
print('=== ANALYZING KEY YEARS ===');
[2001, 2005, 2010, 2015, 2020, 2024].forEach(analyzeLandCover);

// Function to export each year
function exportYear(year) {
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = startDate.advance(1, 'year');
  
  var image = mcd12
    .filterDate(startDate, endDate)
    .first()
    .clip(maranhao);
  
  // Export to Google Drive
  Export.image.toDrive({
    image: image,
    description: 'MCD12Q1_Maranhao_' + year,
    folder: 'MODIS_Land_Cover_Maranhao',
    fileNamePrefix: 'MCD12Q1_Maranhao_' + year,
    region: maranhao,
    scale: 500,  // 500m resolution
    crs: 'EPSG:4326',  // WGS84
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF'
  });
}

// Export all years
print('=== READY TO EXPORT ===');
print('Click the Tasks tab and run each export task');

// Or export all years:
var years = ee.List.sequence(2001, 2024);
years.evaluate(function(yearList) {
  yearList.forEach(exportYear);
});

// LAND COVER CLASSES (IGBP - LC_Type1):
// FORESTS (1-5):
// 1: Evergreen Needleleaf Forests
// 2: Evergreen Broadleaf Forests
// 3: Deciduous Needleleaf Forests
// 4: Deciduous Broadleaf Forests
// 5: Mixed Forests
//
// SAVANNA/SHRUB (6-9):
// 6: Closed Shrublands
// 7: Open Shrublands
// 8: Woody Savannas
// 9: Savannas
//
// GRASSLAND/AGRICULTURE (10-14):
// 10: Grasslands
// 11: Permanent Wetlands
// 12: Croplands
// 13: Urban and Built-up Lands
// 14: Cropland/Natural Vegetation Mosaics
//
// OTHER (15-17):
// 15: Permanent Snow and Ice
// 16: Barren
// 17: Water Bodies