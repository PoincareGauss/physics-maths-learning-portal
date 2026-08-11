// Loads the content layer from JSON files.
// DATA keeps the same shape used by app.js, so the application remains decoupled from storage format.
async function loadContentData(){
  const manifest = await fetch('content/index.json').then(r=>r.json());
  const [subjects, exams, ...topicRecords] = await Promise.all([
    fetch('content/subjects.json').then(r=>r.json()),
    fetch('content/exams.json').then(r=>r.json()),
    ...manifest.topics.map(async entry => {
      const [topic, questions] = await Promise.all([
        fetch(`content/${entry.file}`).then(r=>r.json()),
        fetch(`content/${entry.questions}`).then(r=>r.json())
      ]);
      return { topic, questions };
    })
  ]);

  window.DATA = {
    subjects,
    exams,
    topics: topicRecords.map(x => x.topic),
    questions: topicRecords.flatMap(x => x.questions)
  };
  return window.DATA;
}
