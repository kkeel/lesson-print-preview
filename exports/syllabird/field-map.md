# Syllabird CSV Export Field Map – Draft 1

## Source Repo Responsibility

The Syllabird export is generated from the lesson-writing repository and is intentionally independent from:

- public planning app JSON
- PDF rendering logic
- interleaved print packet structures

The export should represent standalone app courses/topics suitable for direct scheduling inside Syllabird.

Export folder target:

```text
exports/syllabird/courses.csv
exports/syllabird/assignments.csv
exports/syllabird/out.csv
exports/syllabird/metadata.json
```

## Sample Pattern Notes

From the provided Syllabird sample files:

- `courses.csv` has one row per Syllabird course.
- `assignments.csv` has one row per lesson/assignment.
- `out.csv` repeats the course columns on every assignment row.
- `course_gradingStyle` is consistently `UNGRADED` in the samples.
- `assignment_graded` is consistently `FALSE` in the samples.
- `assignment_duration` is consistently `0` in the samples.
- `course_picture` and `course_credits` are blank in the samples.
- `assignment_type` values present in the sample exports are `Lesson`, `Exam`, and `Lab`.
- `assignment_custom_id` in the sample is not unique per individual lesson. It appears to function like an assignment type/category identifier:
  - all `Lesson` rows share one custom id
  - all `Exam` rows share one custom id
  - all `Lab` rows share one custom id

## Export Stability Rules

- Export rows should not depend on visible titles remaining unchanged.
- Airtable record IDs should be preferred internally where stable identifiers are needed.
- Parent interleaving structures should not affect exported topic sequencing.
- Topic exports should remain stable even if PDF packet structures change later.

## Course Row Rule

For the Syllabird app export, we should not export the interleaved PDF course structure.

### Implementation filter

- Export records where `Course Type` is `Course` or `Topic`.
- Require the `Lessons` linked-record field to contain at least one connected lesson.
- Do not export `Course w/Topics` parent records in phase 1, because those exist primarily for PDF/interleaved packet structures.

### Recommended rule

| Alveary structure | Syllabird export behavior |
|---|---|
| Course with no topics | Export the course as one Syllabird course row |
| Course with topics and no direct lessons | Do not export the parent course as a Syllabird course row |
| Topic under a course | Export the topic as its own Syllabird course row |
| Parent course with its own lessons plus topics | Export the parent course only if it has direct lessons |

## Course CSV Field Map

| Syllabird column | Alveary source / rule | Default | Notes |
|---|---|---|---|
| `course_name` | Course name if no topics; topic display name if topic-level export | required | This is the main visible title in Syllabird. |
| `course_custom_id` | Stable Airtable-based course/topic identifier | recommended | Future-safe relational key for syncing and renaming stability. |
| `course_numberOfDaysPerWeek` | Count of true weekdays from the selected schedule pattern | infer from schedule | For topic rows, use the first valid linked course schedule pattern in phase 1. |
| `course_numberOfWeeks` | Number of weeks represented by lessons | `36` | Sample also includes `24` for some courses. We can infer from max lesson week if needed. |
| `course_subjects` | Subject name(s), plus `Beginner` where sample expects it | blank if unknown | Sample uses comma-separated values like `English,Language Study,Beginner`. |
| `course_gradeYears` | Convert Alveary grade labels to Syllabird enum list | required | Format appears to be Python-style list string, e.g. `['SEVENTHGRADE']`. |
| `course_defaultDaysOfTheWeek` | Convert selected schedule pattern into weekday true/false object | blank or Monday fallback | Format appears to be Python-style dict string using capitalized booleans. |
| `course_gradingStyle` | Static value | `UNGRADED` | Matches sample. |
| `course_color` | Subject color mapping | blank initially | Syllabird sample uses values like `BERRY`, `SUNSETORANGE`, `DOLPHIN`. We can map by subject later. |
| `course_picture` | Not currently provided | blank | Leave blank unless Syllabird requests image URLs. |
| `course_credits` | Not currently provided | blank | Likely owned by Syllabird or not needed. |
| `course_description` | About/course/topic description converted to HTML | blank | Existing PDF export already has most of this content. |
| `course_introduction` | Planning & Prep + Books/Resources + Quick Links converted to HTML | blank | Existing PDF/header data can be reused or adapted. |

## Assignment CSV Field Map

| Syllabird column | Alveary source / rule | Default | Notes |
|---|---|---|---|
| `assignment_week` | Lesson week number | required | Numeric string. |
| `assignment_day` | Sequential lesson position within that Syllabird course for the week | required | For topic courses, this should be the topic lesson day, not the interleaved PDF slot. |
| `assignment_name` | Lesson title/name with time prefix if desired | required | Sample includes names like `30m Architecture - Lesson 1`. |
| `assignment_description` | Lesson body converted to HTML | blank | Preserve paragraphs, line breaks, links, bold, italics where possible. |
| `assignment_teachersNote` | Teacher notes converted to HTML | blank | Blank is acceptable. |
| `assignment_type` | Lesson type mapping | `Lesson` | Existing sample values: `Lesson`, `Exam`, `Lab`. Tracker lessons need a rule. |
| `assignment_duration` | Lesson duration minutes if available | `0` | Sample uses `0` everywhere. |
| `assignment_graded` | Static value | `FALSE` | Sample uses `FALSE` everywhere. |
| `assignment_custom_id` | Stable Airtable lesson identifier OR Syllabird assignment category id, pending partner clarification | blank or type id | Sample indicates this is not lesson-unique. Ask Syllabird before using Airtable lesson record IDs here. |
| `course_custom_id` | Stable exported course identifier | recommended | Allows assignments to safely connect to exported course rows even if titles change later. |

## Tracker Lesson Rule – Open Item

Tracker lessons should not be treated as normal lesson rows until we confirm how Syllabird wants them represented.

Possible phase 1 rule:

| Alveary tracker state | Syllabird export |
|---|---|
| Normal lesson | `assignment_type = Lesson` |
| Exam lesson | `assignment_type = Exam` |
| Lab lesson | `assignment_type = Lab` |
| Tracker lesson | `assignment_type = Lesson` for now, with tracker-specific text in description OR use a new type if Syllabird supports it |

Question for Syllabird:

> Does `assignment_custom_id` identify the assignment type/template, or should we use it as our stable external assignment id?

## Phase 1 Implementation Plan

1. Create the folder:

```text
exports/syllabird/
```

2. Add this field map:

```text
exports/syllabird/field-map.md
```

3. Build the first script to generate only:

```text
exports/syllabird/courses.csv
```

4. Validate course rows before adding assignments:

- correct number of exported course/topic rows
- parent courses excluded when they only exist for interleaving
- topic rows included as standalone courses
- grades converted correctly
- subjects converted correctly
- schedule pattern converted correctly
- descriptions/introduction populated acceptably

5. After `courses.csv` is stable, add:

```text
exports/syllabird/assignments.csv
exports/syllabird/out.csv
exports/syllabird/metadata.json
```
