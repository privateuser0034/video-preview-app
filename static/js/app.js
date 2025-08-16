class VideoPreviewApp {
    constructor() {
        this.currentVideoData = null;
        this.init();
    }

    init() {
        this.bindEvents();
        if (window.location.pathname === '/library') {
            this.loadLibrary();
        }
    }

    bindEvents() {
        // Home page events
        const previewBtn = document.getElementById('previewBtn');
        const videoUrlInput = document.getElementById('videoUrl');
        const saveVideoBtn = document.getElementById('saveVideoBtn');
        const speedControl = document.getElementById('speedControl');

        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewVideo());
        }

        if (videoUrlInput) {
            videoUrlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.previewVideo();
                }
            });
        }

        if (saveVideoBtn) {
            saveVideoBtn.addEventListener('click', () => this.saveVideo());
        }

        if (speedControl) {
            speedControl.addEventListener('change', (e) => this.changePlaybackSpeed(e.target.value));
        }

        // Library page events
        const modalClose = document.querySelector('.modal-close');
        const modal = document.getElementById('videoModal');
        const modalSpeedControl = document.getElementById('modalSpeedControl');

        if (modalClose) {
            modalClose.addEventListener('click', () => this.closeModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }

        if (modalSpeedControl) {
            modalSpeedControl.addEventListener('change', (e) => this.changeModalPlaybackSpeed(e.target.value));
        }
    }

    async previewVideo() {
        const urlInput = document.getElementById('videoUrl');
        const previewBtn = document.getElementById('previewBtn');
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const videoPreview = document.getElementById('videoPreview');

        const url = urlInput.value.trim();
        if (!url) {
            this.showError('Please enter a video URL');
            return;
        }

        // Show loading state
        previewBtn.disabled = true;
        previewBtn.textContent = 'Loading...';
        loading.classList.remove('hidden');
        error.classList.add('hidden');
        videoPreview.classList.add('hidden');

        try {
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to preview video');
            }

            this.currentVideoData = { ...data, source_url: url };
            this.displayVideoPreview(this.currentVideoData);

        } catch (err) {
            this.showError(err.message);
        } finally {
            // Reset button state
            previewBtn.disabled = false;
            previewBtn.textContent = 'Preview';
            loading.classList.add('hidden');
        }
    }

    displayVideoPreview(videoData) {
        const videoPreview = document.getElementById('videoPreview');
        const videoPlayer = document.getElementById('videoPlayer');
        const videoTitle = document.getElementById('videoTitle');
        const videoSource = document.getElementById('videoSource');

        // Display video
        videoPlayer.innerHTML = videoData.embed_html;
        videoTitle.textContent = videoData.title;
        videoSource.textContent = videoData.source_url;

        // Show preview section
        videoPreview.classList.remove('hidden');

        // Scroll to video
        videoPreview.scrollIntoView({ behavior: 'smooth' });
    }

    changePlaybackSpeed(speed) {
        const iframe = document.querySelector('#videoPlayer iframe');
        const video = document.querySelector('#videoPlayer video');

        if (video) {
            video.playbackRate = parseFloat(speed);
        }

        // For YouTube iframes, we would need to use the YouTube API
        // For now, this only works with direct video elements
    }

    changeModalPlaybackSpeed(speed) {
        const iframe = document.querySelector('#modalVideoPlayer iframe');
        const video = document.querySelector('#modalVideoPlayer video');

        if (video) {
            video.playbackRate = parseFloat(speed);
        }
    }

    async saveVideo() {
        if (!this.currentVideoData) {
            this.showError('No video to save');
            return;
        }

        const saveBtn = document.getElementById('saveVideoBtn');
        const originalText = saveBtn.textContent;

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const response = await fetch('/api/videos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.currentVideoData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save video');
            }

            saveBtn.textContent = 'Saved!';
            saveBtn.classList.remove('btn-success');
            saveBtn.classList.add('btn-primary');

            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.classList.remove('btn-primary');
                saveBtn.classList.add('btn-success');
                saveBtn.disabled = false;
            }, 2000);

        } catch (err) {
            this.showError(err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    async loadLibrary() {
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const emptyLibrary = document.getElementById('emptyLibrary');
        const videoGrid = document.getElementById('videoGrid');

        loading.classList.remove('hidden');
        error.classList.add('hidden');
        emptyLibrary.classList.add('hidden');

        try {
            const response = await fetch('/api/videos');
            const videos = await response.json();

            if (!response.ok) {
                throw new Error('Failed to load library');
            }

            if (videos.length === 0) {
                emptyLibrary.classList.remove('hidden');
            } else {
                this.displayVideoGrid(videos);
            }

        } catch (err) {
            this.showError(err.message);
        } finally {
            loading.classList.add('hidden');
        }
    }

    displayVideoGrid(videos) {
        const videoGrid = document.getElementById('videoGrid');
        
        videoGrid.innerHTML = videos.map(video => `
            <div class="video-card" onclick="app.openVideoModal(${video.id})">
                <div class="video-card-thumbnail">
                    ${video.thumbnail ? 
                        `<img src="${video.thumbnail}" alt="${video.title}" onerror="this.style.display='none'">` : 
                        '🎥'
                    }
                </div>
                <div class="video-card-content">
                    <h3>${this.escapeHtml(video.title)}</h3>
                    <p>${this.escapeHtml(this.truncateUrl(video.source_url))}</p>
                    <div class="video-card-actions">
                        <span class="video-date">${this.formatDate(video.created_at)}</span>
                        <button class="btn btn-danger" onclick="event.stopPropagation(); app.deleteVideo(${video.id})">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async openVideoModal(videoId) {
        try {
            const response = await fetch(`/api/videos/${videoId}`);
            const video = await response.json();

            if (!response.ok) {
                throw new Error('Failed to load video');
            }

            const modal = document.getElementById('videoModal');
            const modalTitle = document.getElementById('modalVideoTitle');
            const modalPlayer = document.getElementById('modalVideoPlayer');

            modalTitle.textContent = video.title;
            modalPlayer.innerHTML = video.embed_html;
            modal.classList.remove('hidden');

        } catch (err) {
            this.showError(err.message);
        }
    }

    closeModal() {
        const modal = document.getElementById('videoModal');
        const modalPlayer = document.getElementById('modalVideoPlayer');
        
        modal.classList.add('hidden');
        modalPlayer.innerHTML = ''; // Stop video playback
    }

    async deleteVideo(videoId) {
        if (!confirm('Are you sure you want to delete this video?')) {
            return;
        }

        try {
            const response = await fetch(`/api/videos/${videoId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete video');
            }

            // Reload the library
            this.loadLibrary();

        } catch (err) {
            this.showError(err.message);
        }
    }

    showError(message) {
        const error = document.getElementById('error');
        if (error) {
            error.textContent = message;
            error.classList.remove('hidden');
        } else {
            alert(message);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateUrl(url, maxLength = 50) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength) + '...';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }
}

## Setup Instructions

### Local Development

1. **Clone/Create the project directory:**
   ```bash
   mkdir video-preview-app
   cd video-preview-app
