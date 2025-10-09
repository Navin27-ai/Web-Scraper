from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import urllib.parse
import os
import json
import tempfile
import zipfile
from urllib.parse import urljoin, urlparse
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)

class WebScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def fetch_page(self, url):
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            raise Exception(f"Error fetching the webpage: {str(e)}")
    
    def extract_text_content(self, soup):
        for script in soup(["script", "style"]):
            script.decompose()

        text = soup.get_text()

        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return text
    
    def extract_links(self, soup, base_url):
        links = []

        for link in soup.find_all('a', href=True):
            href = link['href']
            absolute_url = urljoin(base_url, href)
            link_text = link.get_text().strip()
            
            links.append({
                'url': absolute_url,
                'text': link_text,
                'original_href': href
            })
        
        return links
    
    def extract_images(self, soup, base_url):
        images = []

        for img in soup.find_all('img'):
            src = img.get('src')
            if src:
                absolute_url = urljoin(base_url, src)
                alt_text = img.get('alt', 'No alt text')
                title = img.get('title', 'No title')
                
                images.append({
                    'url': absolute_url,
                    'alt': alt_text,
                    'title': title,
                    'original_src': src
                })
        
        return images
    
    def download_images(self, images, max_downloads=10):
        downloaded_images = []
        
        if not images:
            return downloaded_images

        temp_dir = tempfile.mkdtemp()
        
        downloaded_count = 0
        for img in images[:max_downloads]:
            try:
                img_url = img['url']
                response = self.session.get(img_url, timeout=10)
                response.raise_for_status()

                parsed_url = urlparse(img_url)
                filename = os.path.basename(parsed_url.path)
                if not filename or '.' not in filename:
                    filename = f"image_{downloaded_count + 1}.jpg"
                
                filepath = os.path.join(temp_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                
                downloaded_images.append({
                    'filename': filename,
                    'filepath': filepath,
                    'url': img_url,
                    'alt': img['alt'],
                    'title': img['title']
                })
                
                downloaded_count += 1
                
            except Exception as e:
                print(f"Failed to download {img['url']}: {e}")
        
        return downloaded_images, temp_dir
    
    def scrape_website(self, url, options):
        response = self.fetch_page(url)

        soup = BeautifulSoup(response.content, 'html.parser')
        
        result = {
            'url': url,
            'timestamp': datetime.now().isoformat(),
            'text': '',
            'links': [],
            'images': [],
            'downloaded_images': []
        }
        
        if options.get('extract_text', True):
            result['text'] = self.extract_text_content(soup)
        
        if options.get('extract_links', True):
            result['links'] = self.extract_links(soup, url)
        
        if options.get('extract_images', True):
            result['images'] = self.extract_images(soup, url)
        
        if options.get('download_images', False) and result['images']:
            downloaded_images, temp_dir = self.download_images(result['images'])
            result['downloaded_images'] = downloaded_images
            result['temp_dir'] = temp_dir
        
        return result

# Initialize scraper
scraper = WebScraper()

@app.route('/api/scrape', methods=['POST'])
def scrape_endpoint():
    try:
        data = request.get_json()
        
        if not data or 'url' not in data:
            return jsonify({'error': 'URL is required'}), 400
        
        url = data['url'].strip()
        
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        try:
            parsed = urlparse(url)
            if not parsed.netloc:
                return jsonify({'error': 'Invalid URL format'}), 400
        except Exception:
            return jsonify({'error': 'Invalid URL format'}), 400
        
        options = {
            'extract_text': data.get('extract_text', True),
            'extract_links': data.get('extract_links', True),
            'extract_images': data.get('extract_images', True),
            'download_images': data.get('download_images', False)
        }
        
        result = scraper.scrape_website(url, options)
        
        if 'temp_dir' in result:
            del result['temp_dir']
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<file_type>', methods=['POST'])
def download_file(file_type):
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt')
        
        if file_type == 'text':
            temp_file.write(data.get('text', ''))
            filename = 'extracted_text.txt'
        elif file_type == 'links':
            links = data.get('links', [])
            content = '\n'.join([f"{i+1}. {link.get('text', 'No text')} -> {link.get('url', '')}" 
                               for i, link in enumerate(links)])
            temp_file.write(content)
            filename = 'extracted_links.txt'
        elif file_type == 'images':
            images = data.get('images', [])
            content = '\n'.join([f"{i+1}. Alt: {img.get('alt', 'No alt text')} | Title: {img.get('title', 'No title')} | URL: {img.get('url', '')}" 
                               for i, img in enumerate(images)])
            temp_file.write(content)
            filename = 'extracted_images.txt'
        else:
            return jsonify({'error': 'Invalid file type'}), 400
        
        temp_file.close()

        return send_file(temp_file.name, as_attachment=True, download_name=filename)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download-all', methods=['POST'])
def download_all():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json')
        json.dump(data, temp_file, indent=2)
        temp_file.close()
        
        return send_file(temp_file.name, as_attachment=True, download_name='scraping_results.json')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

@app.route('/', methods=['GET'])
def serve_index():
    return send_file('index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    if filename in ['styles.css', 'script.js']:
        return send_file(filename)
    return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    print("Starting Web Scraper API...")
    print("Open your browser and go to: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)



