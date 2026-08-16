# Trickbank — Student Portal v3

A pattern-first Math & Physics learning portal built from the supplied Trickbank content.

## Student experience

- Dashboard with subject-level progress and curriculum overview
- Exam modes using the exams represented in the current question bank
- Topic → toolkit → question → drill workflow
- Question search and filters
- Bookmarks for revision
- Mistake Notebook for questions that need another attempt
- Timed test generator: Quick 5, Standard 10, Challenge 15
- Test timer, review/skip state, score summary, and solved tracking
- Formula sheets per live topic
- Technique drill mastery and progress tracking
- Browser persistence via localStorage (with optional host `window.storage` support)

## Content architecture

```text
content/
├── index.json
├── subjects.json
├── exams.json
├── topics/*.json
└── questions/*.json
```

The application loads this content dynamically through `js/data-loader.js`. This keeps the UI/application code independent from the content files and makes future expansion easier.

## Run locally

Because the content is loaded with `fetch()`, use a local web server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Important content boundary

This release uses the supplied question/topic bank as its source of truth. Topics marked as coming soon remain placeholders rather than being populated with invented questions.

## Next production step

For a multi-user deployment, replace browser-only persistence with an API/database for accounts, attempts, bookmarks, mistakes, test history, and analytics. The current content JSON layer can remain as the seed/import format.


## Limits expansion
The Limits question bank now includes 50 additional original JEE Main/JEE Advanced-style practice problems, increasing the live Limits bank from 88 to 138 questions.
