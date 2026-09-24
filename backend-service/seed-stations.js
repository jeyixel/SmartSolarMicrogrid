// Seed data for the SolarStationInfo collection.
//
// Run with the MongoDB shell against the project database:
//   mongosh "<your connection string>" seed-stations.js
//
// Stations are spread across the Colombo area with genuine coordinates so the
// map demo looks like a real deployment rather than a fixture. Re-running
// replaces the same documents rather than creating duplicates.

const now = new Date();

const weekdayHours = [
  { dayOfWeek: 'Monday', openTime: '06:00', closeTime: '20:00', isClosed: false },
  { dayOfWeek: 'Tuesday', openTime: '06:00', closeTime: '20:00', isClosed: false },
  { dayOfWeek: 'Wednesday', openTime: '06:00', closeTime: '20:00', isClosed: false },
  { dayOfWeek: 'Thursday', openTime: '06:00', closeTime: '20:00', isClosed: false },
  { dayOfWeek: 'Friday', openTime: '06:00', closeTime: '20:00', isClosed: false },
  { dayOfWeek: 'Saturday', openTime: '08:00', closeTime: '17:00', isClosed: false },
  { dayOfWeek: 'Sunday', openTime: '00:00', closeTime: '00:01', isClosed: true }
];

const allWeekHours = weekdayHours.map(h =>
  h.dayOfWeek === 'Sunday'
    ? { dayOfWeek: 'Sunday', openTime: '08:00', closeTime: '18:00', isClosed: false }
    : h);

const stations = [
  ['CMB-FORT-01', 'Colombo Fort Exchange Hub', 'Basement level, commuter plaza', 'Olcott Mawatha, Colombo 11', 6.9344, 79.8428, 420.0, 30, 12, 'Active', allWeekHours],
  ['CMB-NORTH-02', 'Colombo North Solar Hub', 'Rooftop array, Block B', '45 Galle Road, Colombo 03', 6.9271, 79.8612, 250.5, 20, 7, 'Active', weekdayHours],
  ['CMB-BORE-03', 'Borella Community Node', 'Adjacent to the public market', 'Baseline Road, Borella', 6.9147, 79.8776, 180.0, 16, 9, 'Active', weekdayHours],
  ['CMB-DEHI-04', 'Dehiwala Coastal Node', 'Beachfront installation', 'Galle Road, Dehiwala', 6.8510, 79.8650, 120.0, 10, 4, 'Active', weekdayHours],
  ['CMB-MTLV-05', 'Mount Lavinia Grid Point', null, 'Hotel Road, Mount Lavinia', 6.8389, 79.8653, 95.5, 8, 8, 'Active', weekdayHours],
  ['CMB-NUGE-06', 'Nugegoda Interchange Hub', 'Multi-storey car park, level 2', 'High Level Road, Nugegoda', 6.8649, 79.8997, 310.0, 24, 15, 'Active', allWeekHours],
  ['CMB-RAJA-07', 'Rajagiriya Office Park Node', null, 'Sri Jayawardenepura Mawatha, Rajagiriya', 6.9097, 79.8940, 200.0, 18, 6, 'Active', weekdayHours],
  ['CMB-BATT-08', 'Battaramulla Civic Node', 'Beside the municipal offices', 'Pelawatta, Battaramulla', 6.8982, 79.9187, 165.0, 14, 11, 'Active', weekdayHours],
  ['CMB-KOTT-09', 'Kottawa Transit Hub', 'Park-and-ride facility', 'High Level Road, Kottawa', 6.8410, 79.9650, 275.0, 22, 3, 'Active', allWeekHours],
  ['CMB-MORA-10', 'Moratuwa University Node', 'Faculty of Engineering campus', 'Katubedda, Moratuwa', 6.7960, 79.9010, 340.0, 26, 18, 'Active', weekdayHours],
  ['CMB-NEGO-11', 'Negombo Coastal Array', 'Seasonal peak capacity', 'Lewis Place, Negombo', 7.2083, 79.8358, 150.0, 12, 5, 'Maintenance', weekdayHours],
  ['CMB-WELL-12', 'Wellawatte Retired Node', 'Decommissioned pending inverter replacement', 'Galle Road, Wellawatte', 6.8721, 79.8595, 80.0, 6, 6, 'Inactive', weekdayHours]
];

const collection = db.getCollection('SolarStationInfo');

let inserted = 0;
let updated = 0;

stations.forEach(function (s) {
  const [code, name, description, addressLine, latitude, longitude,
    capacityKWh, totalBatterySlots, availableBatterySlots, status, schedule] = s;

  const doc = {
    stationCode: code,
    name: name,
    latitude: latitude,
    longitude: longitude,
    capacityKWh: capacityKWh,
    totalBatterySlots: totalBatterySlots,
    availableBatterySlots: availableBatterySlots,
    status: status,
    operationalSchedule: schedule,
    contactPhone: '+94112345678',
    createdAtUtc: now,
    createdByUserId: 'seed-script'
  };

  // Optional fields are omitted rather than stored as null, matching what the
  // API writes.
  if (description) { doc.description = description; }
  if (addressLine) { doc.addressLine = addressLine; }

  if (status === 'Inactive') {
    doc.deactivatedAtUtc = now;
    doc.deactivationReason = 'Inverter replacement scheduled';
  }

  const result = collection.replaceOne({ stationCode: code }, doc, { upsert: true });

  if (result.upsertedCount > 0) { inserted += 1; } else { updated += 1; }
});

// Matches the indexes the API creates at startup; creating them here too means
// a freshly seeded database is ready before the API has ever run.
collection.createIndex({ stationCode: 1 }, { name: 'ux_stationCode', unique: true });
collection.createIndex({ status: 1 }, { name: 'ix_status' });
collection.createIndex({ status: 1, latitude: 1, longitude: 1 }, { name: 'ix_status_lat_lon' });

print('Seed complete: ' + inserted + ' inserted, ' + updated + ' replaced.');
print('Total stations in collection: ' + collection.countDocuments({}));
print('  Active:      ' + collection.countDocuments({ status: 'Active' }));
print('  Inactive:    ' + collection.countDocuments({ status: 'Inactive' }));
print('  Maintenance: ' + collection.countDocuments({ status: 'Maintenance' }));
