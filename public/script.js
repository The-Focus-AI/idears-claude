class IdeasApp {
    constructor() {
        this.ideas = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadIdeas();
    }

    bindEvents() {
        const form = document.getElementById('ideaForm');
        form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        
        try {
            const response = await fetch('/api/ideas', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to create idea');
            }

            const idea = await response.json();
            this.ideas.unshift(idea);
            this.renderIdeas();
            e.target.reset();
            this.showMessage('Idea added successfully!', 'success');
        } catch (error) {
            this.showMessage('Error adding idea: ' + error.message, 'error');
        }
    }

    async loadIdeas() {
        try {
            const response = await fetch('/api/ideas');
            if (!response.ok) {
                throw new Error('Failed to load ideas');
            }
            
            this.ideas = await response.json();
            this.renderIdeas();
        } catch (error) {
            this.showMessage('Error loading ideas: ' + error.message, 'error');
        }
    }

    async voteOnIdea(ideaId) {
        try {
            const response = await fetch(`/api/ideas/${ideaId}/vote`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to vote');
            }

            const updatedIdea = await response.json();
            const ideaIndex = this.ideas.findIndex(idea => idea.id === ideaId);
            if (ideaIndex !== -1) {
                this.ideas[ideaIndex] = updatedIdea;
                this.ideas.sort((a, b) => b.votes - a.votes);
                this.renderIdeas();
            }
        } catch (error) {
            this.showMessage('Error voting: ' + error.message, 'error');
        }
    }

    async addNote(ideaId, noteText) {
        try {
            const response = await fetch(`/api/ideas/${ideaId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ note: noteText })
            });

            if (!response.ok) {
                throw new Error('Failed to add note');
            }

            const newNote = await response.json();
            const ideaIndex = this.ideas.findIndex(idea => idea.id === ideaId);
            if (ideaIndex !== -1) {
                this.ideas[ideaIndex].notes.push(newNote);
                this.renderIdeas();
            }
        } catch (error) {
            this.showMessage('Error adding note: ' + error.message, 'error');
        }
    }

    renderIdeas() {
        const container = document.getElementById('ideasContainer');
        
        if (this.ideas.length === 0) {
            container.innerHTML = '<p class="loading">No ideas yet. Add the first one!</p>';
            return;
        }

        container.innerHTML = this.ideas.map(idea => this.renderIdea(idea)).join('');
        this.bindIdeaEvents();
    }

    renderIdea(idea) {
        const createdDate = new Date(idea.createdAt).toLocaleDateString();
        const filesHtml = idea.files.length > 0 ? `
            <div class="idea-files">
                <strong>Attachments:</strong>
                <div class="file-list">
                    ${idea.files.map(file => `
                        <a href="/uploads/${file.filename}" class="file-link" target="_blank">
                            📎 ${file.originalname}
                        </a>
                    `).join('')}
                </div>
            </div>
        ` : '';

        const notesHtml = `
            <div class="notes-section">
                <div class="notes-header">
                    <strong>Notes (${idea.notes.length})</strong>
                </div>
                <div class="add-note-form">
                    <input type="text" placeholder="Add a note..." class="note-input" data-idea-id="${idea.id}">
                    <button type="button" class="add-note-btn" data-idea-id="${idea.id}">Add Note</button>
                </div>
                <div class="notes-list">
                    ${idea.notes.map(note => `
                        <div class="note">
                            <div class="note-text">${this.escapeHtml(note.text)}</div>
                            <div class="note-date">${new Date(note.createdAt).toLocaleString()}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        return `
            <div class="idea-card">
                <div class="idea-header">
                    <div class="idea-title">${this.escapeHtml(idea.title)}</div>
                    <div class="vote-section">
                        <button class="vote-btn" data-idea-id="${idea.id}">👍 Vote</button>
                        <span class="vote-count">${idea.votes} votes</span>
                    </div>
                </div>
                
                ${idea.description ? `<div class="idea-description">${this.escapeHtml(idea.description)}</div>` : ''}
                
                <div class="idea-meta">
                    Added on ${createdDate}
                </div>
                
                ${filesHtml}
                ${notesHtml}
            </div>
        `;
    }

    bindIdeaEvents() {
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ideaId = e.target.dataset.ideaId;
                this.voteOnIdea(ideaId);
            });
        });

        document.querySelectorAll('.add-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ideaId = e.target.dataset.ideaId;
                const input = document.querySelector(`.note-input[data-idea-id="${ideaId}"]`);
                const noteText = input.value.trim();
                
                if (noteText) {
                    this.addNote(ideaId, noteText);
                    input.value = '';
                }
            });
        });

        document.querySelectorAll('.note-input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const ideaId = e.target.dataset.ideaId;
                    const noteText = e.target.value.trim();
                    
                    if (noteText) {
                        this.addNote(ideaId, noteText);
                        e.target.value = '';
                    }
                }
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showMessage(message, type) {
        const existing = document.querySelector('.message');
        if (existing) {
            existing.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        
        document.querySelector('.container').insertBefore(messageDiv, document.querySelector('.add-idea'));
        
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new IdeasApp();
});