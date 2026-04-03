// Data migration system
// Increment DATA_VERSION when localStorage schema changes.
// Add a migration function for each version bump.

const DATA_VERSION = 1;
const VERSION_KEY = 'hh-data-version';

const migrations = {
  // Example for future use:
  // 2: () => {
  //   // Migrate from v1 to v2
  //   const weeks = JSON.parse(localStorage.getItem('hh-weeks') || '[]');
  //   weeks.forEach(w => { w.newField = w.newField || 'default'; });
  //   localStorage.setItem('hh-weeks', JSON.stringify(weeks));
  // },
};

export function runMigrations() {
  const current = parseInt(localStorage.getItem(VERSION_KEY) || '0');

  if (current >= DATA_VERSION) return; // up to date

  console.log(`Migrating data from v${current} to v${DATA_VERSION}`);

  for (let v = current + 1; v <= DATA_VERSION; v++) {
    if (migrations[v]) {
      try {
        migrations[v]();
        console.log(`Migration v${v} complete`);
      } catch (e) {
        console.error(`Migration v${v} failed:`, e);
        // Don't update version — retry next load
        return;
      }
    }
  }

  localStorage.setItem(VERSION_KEY, String(DATA_VERSION));
}

// Schema documentation for all localStorage keys:
//
// hh-data-version    - integer, current data schema version
// hh-weeks           - array of { id, weekStart, label, planData }
// hh-workout-logs    - { "planId_dayIdx": { exIdx: { setIdx: { weight, reps } } } }
// hh-meal-checks     - { "planId_dayIdx": { mealKey: boolean } }
// hh-grocery-checks  - { "planId": { "category_itemIdx": boolean } }
// hh-stretch-checks  - { "planId_dayIdx_type_stretchIdx": boolean }
// hh-rpe             - { "planId_dayIdx_rpe_exIdx": string }
// hh-day-notes       - { "planId_dayIdx_notes": string }
// hh-bodyweight      - array of { date, weight }
// hh-bodyfat         - array of { date, value }
