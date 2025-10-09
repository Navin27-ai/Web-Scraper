import requests
from bs4 import BeautifulSoup
import urllib.parse
import os
from urllib.parse import urljoin, urlparse
import time

class WebScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def get_website_url(self):
        while True:
            url = input("Enter the website URL to scrape: ").strip()
            if not url:
                print("Please enter a valid URL.")
                continue
            
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url
            
            try:
                parsed = urlparse(url)
                if parsed.netloc:
                    return url
                else:
                    print("Invalid URL format. Please try again.")
            except Exception:
                print("Invalid URL format. Please try again.")
    
    def fetch_page(self, url):
        try:
            print(f"Fetching content from: {url}")
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            print(f"Error fetching the webpage: {e}")
            return None
    
    def extract_text_content(self, soup):
        print("\n" + "="*50)
        print("TEXT CONTENT EXTRACTION")
        print("="*50)
        
        for script in soup(["script", "style"]):
            script.decompose()
        
        text = soup.get_text()
        
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        print(f"Total text length: {len(text)} characters")
        print(f"First 500 characters:\n{text[:500]}...")
        
        with open('extracted_text.txt', 'w', encoding='utf-8') as f:
            f.write(text)
        print("Full text content saved to 'extracted_text.txt'")
        
        return text
    
    def extract_links(self, soup, base_url):
        print("\n" + "="*50)
        print("LINKS EXTRACTION")
        print("="*50)
        
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
        
        print(f"Found {len(links)} links")
        
        for i, link in enumerate(links[:10]):
            print(f"{i+1}. {link['text'][:50]}... -> {link['url']}")
        
        if len(links) > 10:
            print(f"... and {len(links) - 10} more links")
        
        with open('extracted_links.txt', 'w', encoding='utf-8') as f:
            for i, link in enumerate(links, 1):
                f.write(f"{i}. {link['text']} -> {link['url']}\n")
        print("All links saved to 'extracted_links.txt'")
        
        return links
    
    def extract_images(self, soup, base_url):
        print("\n" + "="*50)
        print("IMAGES EXTRACTION")
        print("="*50)
        
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
        
        print(f"Found {len(images)} images")
        
        for i, img in enumerate(images[:10]):
            print(f"{i+1}. {img['alt'][:30]}... -> {img['url']}")
        
        if len(images) > 10:
            print(f"... and {len(images) - 10} more images")
        
        with open('extracted_images.txt', 'w', encoding='utf-8') as f:
            for i, img in enumerate(images, 1):
                f.write(f"{i}. Alt: {img['alt']} | Title: {img['title']} | URL: {img['url']}\n")
        print("All images saved to 'extracted_images.txt'")
        
        return images
    
    def download_images(self, images, max_downloads=5):
        if not images:
            return
        
        print(f"\nDownloading first {min(max_downloads, len(images))} images...")
        
        if not os.path.exists('downloaded_images'):
            os.makedirs('downloaded_images')
        
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
                
                filepath = os.path.join('downloaded_images', filename)
                
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                
                print(f"Downloaded: {filename}")
                downloaded_count += 1
                
            except Exception as e:
                print(f"Failed to download {img['url']}: {e}")
        
        print(f"Successfully downloaded {downloaded_count} images to 'downloaded_images' folder")
    
    def scrape_website(self):
        print("Web Scraper - Extract Text, Links, and Images")
        print("=" * 50)
        
        url = self.get_website_url()
        
        response = self.fetch_page(url)
        if not response:
            return
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        text_content = self.extract_text_content(soup)
        links = self.extract_links(soup, url)
        images = self.extract_images(soup, url)
        
        download_choice = input("\nDo you want to download images? (y/n): ").lower().strip()
        if download_choice in ['y', 'yes']:
            self.download_images(images)
        
        print("\n" + "="*50)
        print("SCRAPING SUMMARY")
        print("="*50)
        print(f"Website: {url}")
        print(f"Text content: {len(text_content)} characters")
        print(f"Links found: {len(links)}")
        print(f"Images found: {len(images)}")
        print("\nFiles created:")
        print("- extracted_text.txt")
        print("- extracted_links.txt")
        print("- extracted_images.txt")
        if download_choice in ['y', 'yes']:
            print("- downloaded_images/ (folder)")

def main():
    scraper = WebScraper()
    
    try:
        scraper.scrape_website()
    except KeyboardInterrupt:
        print("\nScraping interrupted by user.")
    except Exception as e:
        print(f"An error occurred: {e}")
    
    print("\nScraping completed!")

if __name__ == "__main__":
    main()



