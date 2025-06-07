const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');
const { app, getIdeas, saveIdeas, saveIdea } = require('./server');

const TEST_DATA_DIR = './test-data';
const TEST_IDEAS_FILE = path.join(TEST_DATA_DIR, 'ideas.json');

describe('Ideas API', () => {
  beforeEach(async () => {
    process.env.DATA_DIR = TEST_DATA_DIR;
    try {
      await fs.mkdir(TEST_DATA_DIR, { recursive: true });
      await fs.mkdir(path.join(TEST_DATA_DIR, 'uploads'), { recursive: true });
      await fs.writeFile(TEST_IDEAS_FILE, JSON.stringify([]));
    } catch (error) {
      console.error('Setup error:', error);
    }
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('GET /', () => {
    it('should serve the main page', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
    });
  });

  describe('GET /api/ideas', () => {
    it('should return empty array when no ideas exist', async () => {
      const response = await request(app).get('/api/ideas');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return ideas sorted by votes descending', async () => {
      const testIdeas = [
        { id: '1', title: 'Idea 1', votes: 5, notes: [], files: [], createdAt: '2023-01-01' },
        { id: '2', title: 'Idea 2', votes: 10, notes: [], files: [], createdAt: '2023-01-02' },
        { id: '3', title: 'Idea 3', votes: 2, notes: [], files: [], createdAt: '2023-01-03' }
      ];
      
      await saveIdeas(testIdeas);
      
      const response = await request(app).get('/api/ideas');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      expect(response.body[0].votes).toBe(10);
      expect(response.body[1].votes).toBe(5);
      expect(response.body[2].votes).toBe(2);
    });
  });

  describe('POST /api/ideas', () => {
    it('should create a new idea with title only', async () => {
      const ideaData = {
        title: 'Test Idea'
      };

      const response = await request(app)
        .post('/api/ideas')
        .field('title', ideaData.title);

      expect(response.status).toBe(201);
      expect(response.body.title).toBe(ideaData.title);
      expect(response.body.description).toBe('');
      expect(response.body.votes).toBe(0);
      expect(response.body.notes).toEqual([]);
      expect(response.body.files).toEqual([]);
      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    it('should create a new idea with title and description', async () => {
      const ideaData = {
        title: 'Test Idea',
        description: 'This is a test idea description'
      };

      const response = await request(app)
        .post('/api/ideas')
        .field('title', ideaData.title)
        .field('description', ideaData.description);

      expect(response.status).toBe(201);
      expect(response.body.title).toBe(ideaData.title);
      expect(response.body.description).toBe(ideaData.description);
    });

    it('should require title field', async () => {
      const response = await request(app)
        .post('/api/ideas')
        .field('description', 'No title provided');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/ideas/:id/vote', () => {
    it('should increment vote count for existing idea', async () => {
      const testIdea = {
        id: 'test-id',
        title: 'Test Idea',
        description: '',
        votes: 5,
        notes: [],
        files: [],
        createdAt: '2023-01-01'
      };

      await saveIdea(testIdea);

      const response = await request(app)
        .post(`/api/ideas/${testIdea.id}/vote`);

      expect(response.status).toBe(200);
      expect(response.body.votes).toBe(6);
      expect(response.body.id).toBe(testIdea.id);
    });

    it('should return 404 for non-existent idea', async () => {
      const response = await request(app)
        .post('/api/ideas/non-existent-id/vote');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Idea not found');
    });
  });

  describe('POST /api/ideas/:id/notes', () => {
    it('should add note to existing idea', async () => {
      const testIdea = {
        id: 'test-id',
        title: 'Test Idea',
        description: '',
        votes: 0,
        notes: [],
        files: [],
        createdAt: '2023-01-01'
      };

      await saveIdea(testIdea);

      const noteText = 'This is a test note';
      const response = await request(app)
        .post(`/api/ideas/${testIdea.id}/notes`)
        .send({ note: noteText });

      expect(response.status).toBe(200);
      expect(response.body.text).toBe(noteText);
      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();

      const ideas = await getIdeas();
      const updatedIdea = ideas.find(idea => idea.id === testIdea.id);
      expect(updatedIdea.notes).toHaveLength(1);
      expect(updatedIdea.notes[0].text).toBe(noteText);
    });

    it('should return 404 for non-existent idea when adding note', async () => {
      const response = await request(app)
        .post('/api/ideas/non-existent-id/notes')
        .send({ note: 'Test note' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Idea not found');
    });
  });

  describe('Data persistence functions', () => {
    describe('getIdeas', () => {
      it('should return empty array when file does not exist', async () => {
        await fs.rm(TEST_IDEAS_FILE, { force: true });
        const ideas = await getIdeas();
        expect(ideas).toEqual([]);
      });

      it('should return parsed ideas from file', async () => {
        const testIdeas = [
          { id: '1', title: 'Idea 1', votes: 5 },
          { id: '2', title: 'Idea 2', votes: 3 }
        ];
        
        await fs.writeFile(TEST_IDEAS_FILE, JSON.stringify(testIdeas));
        const ideas = await getIdeas();
        expect(ideas).toHaveLength(2);
        expect(ideas[0].votes).toBe(5);
        expect(ideas[1].votes).toBe(3);
      });
    });

    describe('saveIdeas', () => {
      it('should save ideas to file', async () => {
        const testIdeas = [
          { id: '1', title: 'Idea 1', votes: 2 },
          { id: '2', title: 'Idea 2', votes: 8 }
        ];

        await saveIdeas(testIdeas);
        
        const fileContent = await fs.readFile(TEST_IDEAS_FILE, 'utf8');
        const savedIdeas = JSON.parse(fileContent);
        expect(savedIdeas).toEqual(testIdeas);
      });
    });

    describe('saveIdea', () => {
      it('should add new idea to existing ideas', async () => {
        const existingIdeas = [
          { id: '1', title: 'Existing Idea', votes: 1 }
        ];
        await saveIdeas(existingIdeas);

        const newIdea = { id: '2', title: 'New Idea', votes: 0 };
        await saveIdea(newIdea);

        const ideas = await getIdeas();
        expect(ideas).toHaveLength(2);
        expect(ideas.some(idea => idea.id === '2')).toBe(true);
      });
    });
  });
});