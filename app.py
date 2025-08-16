from flask import Flask, render_template, request, jsonify
import sqlite3
import os
import re
import requests
from urllib.parse import urlparse, parse_qs
import json

app = Flask(__name__)

# Ensure data directory exists
DATA_DIR = 'data'
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

DATABASE = os.path.join(DATA_DIR, 'videos.db')

def init_db():
    """Initialize the database with the videos table."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            thumbnail TEXT,
            source_url TEXT NOT NULL,
            video_url TEXT,
            embed_html TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def get_db_connection():
    """Get database connection."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def extract_video_info(url):
    """Extract video information from various platforms."""
    # YouTube
    youtube_pattern = r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]+)'
    youtube_match = re.search(youtube_pattern, url)
    if youtube_match:
        video_id = youtube_match.group(1)
        return {
            'title': f'YouTube Video {video_id}',
            'thumbnail': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg',
            'video_url': f'https://www.youtube.com/embed/{video_id}',
            'embed_html': f'<iframe width="100%" height="400" src="https://www.youtube.com/embed/{video_id}" frameborder="0" allowfullscreen></iframe>'
        }
    
    # Vimeo
    vimeo_pattern = r'vimeo\.com/(\d+)'
    vimeo_match = re.search(vimeo_pattern, url)
    if vimeo_match:
        video_id = vimeo_match.group(1)
        try:
            # Try to get video info from Vimeo API
            api_url = f'https://vimeo.com/api/v2/video/{video_id}.json'
            response = requests.get(api_url, timeout=5)
            if response.status_code == 200:
                data = response.json()[0]
                return {
                    'title': data.get('title', f'Vimeo Video {video_id}'),
                    'thumbnail': data.get('thumbnail_large', ''),
                    'video_url': f'https://player.vimeo.com/video/{video_id}',
                    'embed_html': f'<iframe src="https://player.vimeo.com/video/{video_id}" width="100%" height="400" frameborder="0" allowfullscreen></iframe>'
                }
        except:
            pass
        
        return {
            'title': f'Vimeo Video {video_id}',
            'thumbnail': '',
            'video_url': f'https://player.vimeo.com/video/{video_id}',
            'embed_html': f'<iframe src="https://player.vimeo.com/video/{video_id}" width="100%" height="400" frameborder="0" allowfullscreen></iframe>'
        }
    
    # Generic video files
    video_extensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov']
    if any(url.lower().endswith(ext) for ext in video_extensions):
        return {
            'title': os.path.basename(urlparse(url).path),
            'thumbnail': '',
            'video_url': url,
            'embed_html': f'<video width="100%" height="400" controls><source src="{url}" type="video/mp4">Your browser does not support the video tag.</video>'
        }
    
    return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/library')
def library():
    return render_template('library.html')

@app.route('/api/preview', methods=['POST'])
def preview_video():
    """Preview a video from URL."""
    data = request.get_json()
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    video_info = extract_video_info(url)
    if not video_info:
        return jsonify({'error': 'Unsupported video URL or unable to extract video information'}), 400
    
    return jsonify(video_info)

@app.route('/api/videos', methods=['GET'])
def get_videos():
    """Get all saved videos."""
    conn = get_db_connection()
    videos = conn.execute('SELECT * FROM videos ORDER BY created_at DESC').fetchall()
    conn.close()
    
    return jsonify([dict(video) for video in videos])

@app.route('/api/videos', methods=['POST'])
def save_video():
    """Save a video to the library."""
    data = request.get_json()
    
    required_fields = ['title', 'source_url', 'video_url', 'embed_html']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO videos (title, thumbnail, source_url, video_url, embed_html)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        data['title'],
        data.get('thumbnail', ''),
        data['source_url'],
        data['video_url'],
        data['embed_html']
    ))
    conn.commit()
    video_id = cursor.lastrowid
    conn.close()
    
    return jsonify({'id': video_id, 'message': 'Video saved successfully'})

@app.route('/api/videos/<int:video_id>', methods=['DELETE'])
def delete_video(video_id):
    """Delete a video from the library."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM videos WHERE id = ?', (video_id,))
    conn.commit()
    affected_rows = cursor.rowcount
    conn.close()
    
    if affected_rows == 0:
        return jsonify({'error': 'Video not found'}), 404
    
    return jsonify({'message': 'Video deleted successfully'})

@app.route('/api/videos/<int:video_id>', methods=['GET'])
def get_video(video_id):
    """Get a specific video by ID."""
    conn = get_db_connection()
    video = conn.execute('SELECT * FROM videos WHERE id = ?', (video_id,)).fetchone()
    conn.close()
    
    if not video:
        return jsonify({'error': 'Video not found'}), 404
    
    return jsonify(dict(video))

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
