# Weekly Plan JSON Format

This is the exact JSON structure to paste into the app's Import feature. All fields marked **(required)** must be present. Fields marked **(optional)** can be omitted.

---

## Top-Level Structure

```json
{
  "weekStart": "2026-04-06",
  "workouts": [ ... ],
  "meals": { ... },
  "grocery": { ... }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `weekStart` | string | Yes | Date of Monday in `YYYY-MM-DD` format. Must be a Monday. |
| `workouts` | array | Yes | Array of workout day objects. At least one entry. Days without workouts (rest days) are simply omitted. |
| `meals` | object | Yes | Keyed by meal slot (e.g. `breakfast`, `snack1`, `lunch`, `snack2`, `dinner`). Same meals apply to every day of the week unless overridden. |
| `grocery` | object | Yes | Keyed by category name. Each value is an array of grocery items. |

---

## Workout Day Object

```json
{
  "day": 0,
  "dayName": "Monday",
  "title": "Upper Push",
  "type": "Upper Push",
  "duration": "~55 min",
  "tip": "Focus on controlled reps today. Quality over quantity.",
  "exercises": [ ... ],
  "warmup": [ ... ],
  "cooldown": [ ... ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `day` | integer 0-6 | Yes | 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday |
| `dayName` | string | Yes | Human-readable day name |
| `title` | string | Yes | Workout session title |
| `type` | string | Optional | Badge label (e.g. "Upper Push", "Lower — Quad Focus", "Cardio Day"). Falls back to `title`. |
| `duration` | string | Optional | Estimated duration (e.g. "~55 min") |
| `tip` | string | Optional | General daily tip shown at the top of the workout view. Should be motivational or general guidance, not exercise-specific. |
| `exercises` | array | Yes | Array of exercise objects. Can be empty for cardio-only days. |
| `warmup` | array | Optional | Array of stretch objects for warm-up. If present, Warm-Up sub-tab appears. |
| `cooldown` | array | Optional | Array of stretch objects for cool-down. If present, Cool-Down sub-tab appears. |

---

## Exercise Object

```json
{
  "name": "Barbell Bench Press",
  "sets": 4,
  "reps": "8",
  "equipment": "barbell",
  "notes": "Pause at the bottom for 1 second. Keep shoulder blades retracted.",
  "restBetweenSets": "90 sec",
  "restBetweenExercises": "2 min"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Exercise name. **Must be consistent across weeks** for progress tracking (e.g. always "Barbell Bench Press", not sometimes "Flat Bench"). |
| `sets` | integer | Yes | Target number of sets (>= 1) |
| `reps` | string | Yes | Target reps as a string (e.g. "8", "8-10", "12/leg", "AMRAP", "20 min", "45 sec") |
| `equipment` | string | Optional | Equipment type. Determines weight input labels. |
| `notes` | string | Optional | Exercise-specific coaching cues shown inside the expandable card. |
| `restBetweenSets` | string | Optional | Rest time between sets (e.g. "90 sec", "2 min"). Shows a timer. |
| `restBetweenExercises` | string | Optional | Rest time before the next exercise (e.g. "2 min", "3 min"). Shows after last set. |

### Equipment Types

| Value | Weight Input Label | Placeholder | Badge |
|-------|-------------------|-------------|-------|
| `barbell` | Weight (bar total) | bar lbs | barbell |
| `dumbbell` | Weight (per DB) | lbs/ea | dumbbell |
| `cable` | Weight (stack) | stack | cable |
| `cable-single` | Weight (per arm) | lbs/arm | cable |
| `machine` | Weight (lbs) | lbs | machine |
| `machine-single` | Weight (per arm) | lbs/arm | iso machine |
| `bodyweight` | *(hidden)* | *(hidden)* | BW |
| *(omitted)* | Weight (lbs) | lbs | *(none)* |

---

## Stretch Object (for warmup/cooldown arrays)

```json
{
  "name": "Leg Swings (front-back)",
  "duration": "30 sec/leg",
  "notes": "Hold a wall for balance"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Stretch/exercise name |
| `duration` | string | Optional | Duration or reps (e.g. "30 sec/leg", "10 reps") |
| `notes` | string | Optional | Coaching cue |

---

## Meal Object

```json
{
  "breakfast": {
    "name": "Scrambled Eggs & Oatmeal",
    "time": "7-8 AM",
    "items": "4 scrambled eggs · 1.5 cups oatmeal · 1 banana",
    "calories": 605,
    "protein": 33,
    "carbs": 69,
    "fat": 24,
    "recipe": {
      "ingredients": [
        "4 large eggs",
        "1.5 cups rolled oats",
        "1 banana, sliced",
        "Pinch of salt"
      ],
      "instructions": "1. Cook oats with water per package directions.\n2. Scramble eggs in a buttered pan over medium heat.\n3. Top oatmeal with sliced banana.",
      "prepTime": "5 min",
      "cookTime": "10 min"
    }
  }
}
```

The `meals` object is keyed by slot name. Common keys: `breakfast`, `snack1`, `lunch`, `snack2`, `dinner`. You can use any keys.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Meal name |
| `time` | string | Optional | Suggested time (e.g. "7-8 AM") |
| `items` | string | Optional | Short description of ingredients separated by ` · ` |
| `calories` | number | Optional | Total calories |
| `protein` | number | Optional | Grams of protein |
| `carbs` | number | Optional | Grams of carbs |
| `fat` | number | Optional | Grams of fat |
| `recipe` | object | Optional | Expandable recipe details (see below) |

### Recipe Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ingredients` | string[] | Optional | List of ingredients with quantities |
| `instructions` | string | Optional | Step-by-step cooking instructions. Use `\n` for line breaks. |
| `prepTime` | string | Optional | Prep time (e.g. "5 min") |
| `cookTime` | string | Optional | Cook time (e.g. "10 min") |

---

## Grocery Object

```json
{
  "Produce": [
    { "name": "Bananas", "qty": "7" },
    { "name": "Apples", "qty": "7" }
  ],
  "Protein": [
    { "name": "Eggs", "qty": "2 dozen" },
    { "name": "Chicken breast", "qty": "~2.6 lbs" }
  ],
  "Pantry": [
    { "name": "Rolled oats", "qty": "1 large canister" }
  ]
}
```

Keyed by category name (e.g. "Produce", "Protein", "Pantry", "Dairy", "Other"). Each value is an array of items.

### Grocery Item

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Item name |
| `qty` | string | Optional | Quantity description |

Items can also be plain strings (e.g. `"Bananas - 7"`) but the object format with `name` and `qty` is preferred for cleaner display.

---

## Single-Day Override Formats

Used with the "Replace" button to swap a single day without affecting the rest of the week.

### Workout Override (paste into Replace modal on workout tab)

```json
{
  "title": "Home Dumbbell Workout",
  "type": "Upper Push (Home)",
  "duration": "~40 min",
  "tip": "Limited equipment today - focus on time under tension.",
  "exercises": [
    { "name": "DB Floor Press", "sets": 4, "reps": "10", "equipment": "dumbbell", "notes": "Slow negatives" }
  ],
  "warmup": [ ... ],
  "cooldown": [ ... ]
}
```

Same structure as a workout day object, but without `day` and `dayName` (the app fills those in based on which day you're replacing).

### Meals Override (paste into Replace modal on meals tab)

```json
{
  "breakfast": { "name": "Protein Smoothie", "calories": 400, "protein": 35, "carbs": 45, "fat": 10 },
  "lunch": { "name": "Chicken Salad", "calories": 550, "protein": 42, "carbs": 20, "fat": 28 },
  "dinner": { "name": "Steak & Veggies", "calories": 600, "protein": 50, "carbs": 25, "fat": 30 }
}
```

Same structure as the `meals` object. Only affects the selected day. Does not change the grocery list.

---

## Full Example

```json
{
  "weekStart": "2026-04-06",
  "workouts": [
    {
      "day": 0,
      "dayName": "Monday",
      "title": "Upper Push",
      "type": "Upper Push",
      "duration": "~55 min",
      "tip": "Focus on controlled reps. Quality over quantity.",
      "warmup": [
        { "name": "Arm Circles", "duration": "30 sec each direction" },
        { "name": "Band Pull-Aparts", "duration": "15 reps" },
        { "name": "Push-Up to Downward Dog", "duration": "8 reps" }
      ],
      "exercises": [
        {
          "name": "Barbell Bench Press",
          "sets": 4,
          "reps": "8",
          "equipment": "barbell",
          "notes": "Pause at the bottom. Keep shoulder blades retracted.",
          "restBetweenSets": "2 min",
          "restBetweenExercises": "2 min"
        },
        {
          "name": "Incline Dumbbell Press",
          "sets": 3,
          "reps": "10",
          "equipment": "dumbbell",
          "notes": "30-degree incline. Full range of motion.",
          "restBetweenSets": "90 sec",
          "restBetweenExercises": "90 sec"
        },
        {
          "name": "Cable Lateral Raises",
          "sets": 3,
          "reps": "15",
          "equipment": "cable-single",
          "notes": "Light weight, squeeze at the top.",
          "restBetweenSets": "60 sec",
          "restBetweenExercises": "90 sec"
        },
        {
          "name": "Tricep Rope Pushdown",
          "sets": 3,
          "reps": "12",
          "equipment": "cable",
          "notes": "Spread the rope at the bottom.",
          "restBetweenSets": "60 sec"
        }
      ],
      "cooldown": [
        { "name": "Chest Doorway Stretch", "duration": "30 sec/side" },
        { "name": "Overhead Tricep Stretch", "duration": "30 sec/arm" },
        { "name": "Cross-Body Shoulder Stretch", "duration": "30 sec/arm" }
      ]
    },
    {
      "day": 2,
      "dayName": "Wednesday",
      "title": "Cardio + Core",
      "type": "Cardio",
      "duration": "~45 min",
      "tip": "Keep heart rate in zone 2. You should be able to hold a conversation.",
      "exercises": [
        { "name": "Stationary Bike", "sets": 1, "reps": "30 min", "equipment": "machine", "notes": "Steady conversational pace" },
        { "name": "Plank", "sets": 3, "reps": "45 sec", "equipment": "bodyweight" },
        { "name": "Dead Bug", "sets": 3, "reps": "12/side", "equipment": "bodyweight" }
      ]
    }
  ],
  "meals": {
    "breakfast": {
      "name": "Scrambled Eggs & Oatmeal",
      "time": "7-8 AM",
      "items": "4 scrambled eggs · 1.5 cups oatmeal · 1 banana",
      "calories": 605,
      "protein": 33,
      "carbs": 69,
      "fat": 24,
      "recipe": {
        "ingredients": ["4 large eggs", "1.5 cups rolled oats", "1 banana", "Salt & pepper"],
        "instructions": "1. Cook oats with water per package directions.\n2. Scramble eggs in a buttered pan over medium heat.\n3. Slice banana on top of oatmeal.",
        "prepTime": "5 min",
        "cookTime": "10 min"
      }
    },
    "snack1": {
      "name": "Protein Shake",
      "time": "10 AM",
      "items": "1 scoop whey protein · 1 apple",
      "calories": 215,
      "protein": 25,
      "carbs": 28,
      "fat": 2
    },
    "lunch": {
      "name": "Grilled Chicken & Rice",
      "time": "12:30 PM",
      "items": "6oz grilled chicken · 1 cup white rice · 1 cup broccoli · 1 tbsp olive oil",
      "calories": 660,
      "protein": 53,
      "carbs": 56,
      "fat": 20,
      "recipe": {
        "ingredients": ["6 oz chicken breast", "1 cup white rice", "1 cup broccoli", "1 tbsp olive oil", "Salt, pepper, garlic powder"],
        "instructions": "1. Season chicken and grill 6-7 min per side.\n2. Cook rice per package.\n3. Steam broccoli 3-4 min, drizzle with olive oil.",
        "prepTime": "10 min",
        "cookTime": "20 min"
      }
    },
    "snack2": {
      "name": "Cottage Cheese",
      "time": "3:30 PM",
      "items": "1 cup low-fat cottage cheese",
      "calories": 160,
      "protein": 28,
      "carbs": 6,
      "fat": 2
    },
    "dinner": {
      "name": "Baked Salmon",
      "time": "7 PM",
      "items": "6oz baked salmon · 1 medium sweet potato · 1 cup steamed broccoli",
      "calories": 525,
      "protein": 40,
      "carbs": 41,
      "fat": 22,
      "recipe": {
        "ingredients": ["6 oz salmon fillet", "1 medium sweet potato", "1 cup broccoli", "1 tsp olive oil", "Lemon, salt, pepper"],
        "instructions": "1. Preheat oven to 400F.\n2. Season salmon with olive oil, lemon, salt, pepper. Bake 12-15 min.\n3. Microwave sweet potato 5-7 min.\n4. Steam broccoli 3-4 min.",
        "prepTime": "5 min",
        "cookTime": "15 min"
      }
    }
  },
  "grocery": {
    "Produce": [
      { "name": "Bananas", "qty": "7" },
      { "name": "Apples", "qty": "7" },
      { "name": "Broccoli (frozen)", "qty": "2 large bags" },
      { "name": "Sweet potatoes", "qty": "4 medium" },
      { "name": "Lemons", "qty": "2" }
    ],
    "Protein": [
      { "name": "Eggs", "qty": "2 dozen" },
      { "name": "Chicken breast", "qty": "~2.6 lbs" },
      { "name": "Salmon fillets", "qty": "4 x 6oz" },
      { "name": "Whey protein powder", "qty": "7 scoops" },
      { "name": "Low-fat cottage cheese", "qty": "Two 24oz tubs" }
    ],
    "Pantry": [
      { "name": "Rolled oats", "qty": "1 large canister" },
      { "name": "White rice", "qty": "1 bag" },
      { "name": "Olive oil", "qty": "1 bottle" }
    ]
  }
}
```
