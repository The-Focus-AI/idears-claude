const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || './data';
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

async function ensureDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/ideas', async (req, res) => {
  try {
    const ideas = await getIdeas();
    res.json(ideas);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ideas' });
  }
});

app.post('/api/ideas', upload.array('files'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const files = req.files || [];
    
    const idea = {
      id: uuidv4(),
      title,
      description: description || '',
      votes: 0,
      notes: [],
      files: files.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        size: file.size
      })),
      createdAt: new Date().toISOString()
    };
    
    await saveIdea(idea);
    res.status(201).json(idea);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create idea' });
  }
});

app.post('/api/ideas/:id/vote', async (req, res) => {
  try {
    const ideas = await getIdeas();
    const idea = ideas.find(i => i.id === req.params.id);
    
    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    
    idea.votes += 1;
    await saveIdeas(ideas);
    res.json(idea);
  } catch (error) {
    res.status(500).json({ error: 'Failed to vote on idea' });
  }
});

app.post('/api/ideas/:id/notes', async (req, res) => {
  try {
    const { note } = req.body;
    const ideas = await getIdeas();
    const idea = ideas.find(i => i.id === req.params.id);
    
    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    
    const newNote = {
      id: uuidv4(),
      text: note,
      createdAt: new Date().toISOString()
    };
    
    idea.notes.push(newNote);
    await saveIdeas(ideas);
    res.json(newNote);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add note' });
  }
});

async function getIdeas() {
  try {
    const data = await fs.readFile(path.join(DATA_DIR, 'ideas.json'), 'utf8');
    return JSON.parse(data).sort((a, b) => b.votes - a.votes);
  } catch (error) {
    return [];
  }
}

async function saveIdeas(ideas) {
  await fs.writeFile(
    path.join(DATA_DIR, 'ideas.json'),
    JSON.stringify(ideas, null, 2)
  );
}

async function saveIdea(idea) {
  const ideas = await getIdeas();
  ideas.push(idea);
  await saveIdeas(ideas);
}

async function startServer() {
  await ensureDirectories();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, getIdeas, saveIdeas, saveIdea };